import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: object) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DEFAULT_MODEL = "gemini-2.5-flash-preview-image-generation";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return ok({ error: "Invalid request body" });
    }

    // ── ACTION: list-models ──
    if (body.action === "list-models") {
      const apiKey = body.geminiApiKey;
      if (!apiKey) return ok({ error: "Missing geminiApiKey" });

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`
        );
        if (!res.ok) {
          const text = await res.text();
          console.error("List models error:", res.status, text);
          if (text.includes("API_KEY_INVALID") || text.includes("API key expired")) {
            return ok({ error: "API_KEY_INVALID", errorType: "API_KEY_INVALID" });
          }
          return ok({ error: `Failed to list models: ${res.status}`, errorType: "UNKNOWN" });
        }
        const data = await res.json();
        const imageModels = (data.models || [])
          .filter((m: any) => {
            const methods = m.supportedGenerationMethods || [];
            return methods.includes("generateContent");
          })
          .map((m: any) => ({
            id: m.name?.replace("models/", "") || m.name,
            displayName: m.displayName || m.name,
            description: m.description || "",
            inputTokenLimit: m.inputTokenLimit,
            outputTokenLimit: m.outputTokenLimit,
          }));
        return ok({ models: imageModels, status: "valid" });
      } catch (e) {
        console.error("List models fetch error:", e);
        return ok({ error: "Network error listing models", errorType: "NETWORK" });
      }
    }

    // ── ACTION: generate (default) ──
    const prompt = body.prompt;
    const faceB64 = body.faceB64;
    const geminiApiKey = body.geminiApiKey;
    const geminiModel = body.geminiModel;

    if (!prompt) return ok({ error: "Missing prompt" });

    // ── USER KEY PATH ──
    if (geminiApiKey) {
      return await callGoogleGemini(prompt, faceB64, geminiApiKey, geminiModel || DEFAULT_MODEL);
    }

    // ── DEFAULT PATH: Lovable AI Gateway ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return ok({ error: "LOVABLE_API_KEY not configured" });

    const content: any[] = [{ type: "text", text: prompt }];
    if (faceB64) {
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${faceB64}` } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      if (status === 429) return ok({ error: "Rate limit exceeded.", isRetryable: true, errorType: "RESOURCE_EXHAUSTED" });
      if (status === 402) return ok({ error: "AI credits exhausted.", isRetryable: true, errorType: "RESOURCE_EXHAUSTED" });
      return ok({ error: `AI gateway error: ${status}`, isRetryable: true, errorType: "UNKNOWN" });
    }

    const rawText = await response.text();
    if (!rawText) return ok({ error: "Empty response from AI gateway", isRetryable: true });

    let data: any;
    try { data = JSON.parse(rawText); } catch {
      console.error("Failed to parse AI gateway response:", rawText.substring(0, 200));
      return ok({ error: "Malformed response from AI gateway", isRetryable: true });
    }

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) return ok({ error: "No image generated", isRetryable: true });

    return ok({ imageUrl });
  } catch (e) {
    console.error("generate-image error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error", isRetryable: true });
  }
});

// ── Google Gemini direct call ──
async function callGoogleGemini(prompt: string, faceB64: string | undefined, apiKey: string, model: string) {
  const parts: any[] = [{ text: prompt }];
  if (faceB64) {
    parts.push({ inline_data: { mime_type: "image/jpeg", data: faceB64 } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      }),
    });
  } catch (e) {
    console.error("Google Gemini fetch error:", e);
    return ok({ error: "Network error calling Gemini API", isRetryable: true, errorType: "NETWORK" });
  }

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    console.error("Google Gemini error:", status, text);

    let errorType = "UNKNOWN";
    if (text.includes("API_KEY_INVALID") || text.includes("API key expired")) {
      errorType = "API_KEY_INVALID";
    } else if (status === 404 || text.includes("NOT_FOUND")) {
      errorType = "MODEL_NOT_FOUND";
    } else if (text.includes("does not support") && text.includes("response modalities")) {
      errorType = "MODEL_NOT_FOUND"; // treat as model issue so client tries next model
    } else if (status === 429 || text.includes("RESOURCE_EXHAUSTED")) {
      errorType = "RESOURCE_EXHAUSTED";
    } else if (status === 403) {
      errorType = "PERMISSION_DENIED";
    }

    return ok({ error: `Gemini API error: ${status}`, isRetryable: true, errorType });
  }

  let data: any;
  try {
    const rawText = await response.text();
    if (!rawText) return ok({ error: "Empty response from Gemini", isRetryable: true });
    data = JSON.parse(rawText);
  } catch {
    return ok({ error: "Malformed response from Gemini", isRetryable: true });
  }

  const candidates = data.candidates;
  if (!candidates?.length) {
    // Check for safety block
    if (data.promptFeedback?.blockReason) {
      return ok({ error: `Blocked: ${data.promptFeedback.blockReason}`, isRetryable: false, errorType: "SAFETY_BLOCKED" });
    }
    return ok({ error: "No candidates in Gemini response", isRetryable: true });
  }

  // Search all candidates for an image
  for (const candidate of candidates) {
    const contentParts = candidate?.content?.parts;
    if (!contentParts?.length) continue;
    const imagePart = contentParts.find((p: any) => p.inline_data?.mime_type?.startsWith("image/"));
    if (imagePart) {
      const b64 = imagePart.inline_data.data;
      const mime = imagePart.inline_data.mime_type;
      return ok({ imageUrl: `data:${mime};base64,${b64}` });
    }
  }

  return ok({ error: "No image in Gemini response", isRetryable: true });
}
