import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: object) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Google Direct API ────────────────────────────────────────

const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GOOGLE_MODEL = "gemini-2.0-flash-exp";

async function generateWithGoogle(
  prompt: string,
  faceB64: string | undefined,
  googleApiKey: string,
): Promise<{ imageUrl?: string; error?: string; isRetryable?: boolean }> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const parts: any[] = [{ text: prompt }];
      if (faceB64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: faceB64 } });
      }

      const response = await fetch(
        `${GOOGLE_API_URL}/${GOOGLE_MODEL}:generateContent?key=${googleApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
      );

      if (response.status === 429) {
        const text = await response.text();
        console.warn(`[generate-image] Google 429 (attempt ${attempt + 1}):`, text.substring(0, 200));
        if (attempt < MAX_RETRIES - 1) { await sleep(3000); continue; }
        return { error: "Rate limit do Google. Aguarde alguns segundos.", isRetryable: true };
      }

      if (response.status === 400 || response.status === 403) {
        const text = await response.text();
        console.error(`[generate-image] Google ${response.status}:`, text.substring(0, 300));
        return { error: `Erro na API Key do Google (${response.status}). Verifique se a key é válida.`, isRetryable: false };
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`[generate-image] Google error ${response.status}:`, text.substring(0, 300));
        if (attempt < MAX_RETRIES - 1) { await sleep(2000); continue; }
        return { error: `Erro Google API: ${response.status}`, isRetryable: true };
      }

      const data = await response.json();
      const imageUrl = extractFromGoogleResponse(data);
      if (imageUrl) {
        console.log(`[generate-image] Success with Google Direct (${GOOGLE_MODEL})`);
        return { imageUrl };
      }

      console.warn(`[generate-image] No image in Google response (attempt ${attempt + 1}):`,
        JSON.stringify({
          hasCandidates: !!data?.candidates?.length,
          partsCount: data?.candidates?.[0]?.content?.parts?.length || 0,
          partTypes: data?.candidates?.[0]?.content?.parts?.map((p: any) => Object.keys(p)) || [],
        })
      );

      if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
    } catch (e) {
      console.error(`[generate-image] Google network error:`, e);
      if (attempt < MAX_RETRIES - 1) { await sleep(2000); continue; }
    }
  }

  return { error: "Google API não retornou imagem. Tente novamente.", isRetryable: true };
}

function extractFromGoogleResponse(data: any): string | null {
  const candidates = data?.candidates;
  if (!candidates?.length) return null;

  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (part?.inlineData?.mimeType?.startsWith("image/")) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null;
}

// ── Lovable AI Gateway (fallback) ────────────────────────────

const IMAGE_MODELS = [
  "google/gemini-3-pro-image-preview",
  "google/gemini-2.5-flash-image",
];

const MAX_RETRIES = 2;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractRetryDelay(text: string): number {
  const match = text.match(/retry\s*(?:in|after)\s*(\d+(?:\.\d+)?)\s*s/i);
  if (match) return Math.ceil(parseFloat(match[1])) * 1000;
  const jsonMatch = text.match(/"retryDelay"\s*:\s*"(\d+)s?"/);
  if (jsonMatch) return parseInt(jsonMatch[1]) * 1000;
  return 5000;
}

function extractImageFromGatewayResponse(data: any): string | null {
  const choices = data?.choices;
  if (!choices?.length) return null;

  for (const choice of choices) {
    const msg = choice?.message;
    if (!msg) continue;

    if (msg.images?.length) {
      for (const img of msg.images) {
        if (img?.image_url?.url) return img.image_url.url;
        if (img?.url) return img.url;
      }
    }

    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part?.type === "image_url" && part?.image_url?.url) return part.image_url.url;
        if (part?.type === "image" && part?.url) return part.url;
        if (part?.type === "image" && part?.data) {
          return `data:image/png;base64,${part.data}`;
        }
      }
    }

    if (typeof msg.content === "string" && msg.content.startsWith("data:image")) {
      return msg.content;
    }
  }

  return null;
}

async function generateWithGateway(
  prompt: string,
  faceB64: string | undefined,
  apiKey: string,
): Promise<{ imageUrl?: string; error?: string; isRetryable?: boolean }> {

  for (const model of IMAGE_MODELS) {
    console.log(`[generate-image] Trying model: ${model}`);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const content: any[] = [{ type: "text", text: prompt }];
      if (faceB64) {
        content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${faceB64}` } });
      }

      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
          }),
        });

        if (response.status === 429) {
          const text = await response.text();
          const delay = extractRetryDelay(text);
          console.warn(`[generate-image] 429 on ${model}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          if (attempt < MAX_RETRIES - 1) { await sleep(delay); continue; }
          break;
        }

        if (response.status === 402) {
          return { error: "Créditos de IA esgotados. Adicione créditos em Settings → Workspace → Usage.", isRetryable: false };
        }

        if (!response.ok) {
          const text = await response.text();
          console.error(`[generate-image] ${model} error ${response.status}:`, text.substring(0, 300));
          break;
        }

        const rawText = await response.text();
        if (!rawText) {
          console.error(`[generate-image] Empty response from ${model}`);
          if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
          break;
        }

        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          console.error(`[generate-image] Malformed JSON from ${model}:`, rawText.substring(0, 200));
          if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
          break;
        }

        const imageUrl = extractImageFromGatewayResponse(data);
        if (imageUrl) {
          console.log(`[generate-image] Success with ${model}`);
          return { imageUrl };
        }

        const msg = data?.choices?.[0]?.message;
        console.warn(`[generate-image] No image extracted from ${model} (attempt ${attempt + 1}/${MAX_RETRIES}). Structure:`,
          JSON.stringify({
            hasChoices: !!data?.choices?.length,
            messageKeys: msg ? Object.keys(msg) : [],
            contentType: typeof msg?.content,
            contentIsArray: Array.isArray(msg?.content),
            contentLength: Array.isArray(msg?.content) ? msg.content.length : (typeof msg?.content === "string" ? msg.content.length : 0),
            hasImages: !!msg?.images?.length,
            imagesCount: msg?.images?.length || 0,
          })
        );

        if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
        break;

      } catch (e) {
        console.error(`[generate-image] Network error on ${model}:`, e);
        if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
        break;
      }
    }
  }

  return { error: "Nenhum modelo conseguiu gerar a imagem. Tente novamente em alguns instantes.", isRetryable: true };
}

// ── Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return ok({ error: "Invalid request body" });
    }

    const prompt = body.prompt;
    if (!prompt) return ok({ error: "Missing prompt" });

    const faceB64 = body.faceB64;
    const googleApiKey = body.googleApiKey;

    // Path 1: Google Direct (user's own key, free)
    if (googleApiKey) {
      console.log("[generate-image] Using Google Direct API");
      const result = await generateWithGoogle(prompt, faceB64, googleApiKey);
      return ok(result);
    }

    // Path 2: Lovable AI Gateway (fallback)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return ok({ error: "LOVABLE_API_KEY not configured" });

    const result = await generateWithGateway(prompt, faceB64, LOVABLE_API_KEY);
    return ok(result);

  } catch (e) {
    console.error("generate-image error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error", isRetryable: true });
  }
});
