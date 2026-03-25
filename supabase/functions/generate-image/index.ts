import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: object) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Google Direct API ────────────────────────────────────────

const GOOGLE_MODEL = "gemini-2.0-flash-exp";
const GOOGLE_MAX_RETRIES = 2;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateWithGoogleDirect(
  prompt: string,
  faceB64: string | undefined,
  googleApiKey: string,
): Promise<{ imageUrl?: string; error?: string; isRetryable?: boolean; rateLimited?: boolean }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_MODEL}:generateContent?key=${googleApiKey}`;

  for (let attempt = 0; attempt < GOOGLE_MAX_RETRIES; attempt++) {
    try {
      const parts: any[] = [{ text: prompt }];
      if (faceB64) {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: faceB64 } });
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (response.status === 429) {
        console.warn(`[google-direct] 429, retry ${attempt + 1}/${GOOGLE_MAX_RETRIES}`);
        if (attempt < GOOGLE_MAX_RETRIES - 1) { await sleep(5000 * (attempt + 1)); continue; }
        return { error: "Rate limit Google API. Aguarde alguns segundos.", isRetryable: true, rateLimited: true };
      }

      if (response.status === 400 || response.status === 403) {
        const text = await response.text();
        console.error(`[google-direct] ${response.status}:`, text.substring(0, 300));
        return { error: `Erro Google API (${response.status}): verifique sua API Key.`, isRetryable: false };
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`[google-direct] ${response.status}:`, text.substring(0, 300));
        if (attempt < GOOGLE_MAX_RETRIES - 1) { await sleep(2000); continue; }
        return { error: `Erro Google API: ${response.status}`, isRetryable: true };
      }

      const data = await response.json();
      const candidates = data?.candidates;
      if (!candidates?.length) {
        console.warn("[google-direct] No candidates in response");
        if (attempt < GOOGLE_MAX_RETRIES - 1) { await sleep(1500); continue; }
        return { error: "Nenhum candidato retornado pelo Google.", isRetryable: true };
      }

      // Extract image from candidates
      for (const candidate of candidates) {
        const contentParts = candidate?.content?.parts;
        if (!Array.isArray(contentParts)) continue;
        for (const part of contentParts) {
          if (part?.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            console.log(`[google-direct] Success with ${GOOGLE_MODEL}`);
            return { imageUrl: `data:${mime};base64,${part.inlineData.data}` };
          }
        }
      }

      console.warn("[google-direct] No image found in response parts");
      if (attempt < GOOGLE_MAX_RETRIES - 1) { await sleep(1500); continue; }
      return { error: "Google retornou resposta sem imagem.", isRetryable: true };

    } catch (e) {
      console.error("[google-direct] Network error:", e);
      if (attempt < GOOGLE_MAX_RETRIES - 1) { await sleep(2000); continue; }
      return { error: "Erro de rede ao chamar Google API.", isRetryable: true };
    }
  }

  return { error: "Falha após retentativas com Google API.", isRetryable: true };
}

// ── Lovable AI Gateway ───────────────────────────────────────

const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
  "google/gemini-2.5-flash-image",
];

const MAX_RETRIES = 2;

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
        if (img?.data) return `data:image/png;base64,${img.data}`;
      }
    }

    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part?.type === "image_url" && part?.image_url?.url) return part.image_url.url;
        if (part?.type === "image" && part?.url) return part.url;
        if (part?.type === "image" && part?.data) return `data:image/png;base64,${part.data}`;
        if (part?.inline_data?.data) {
          const mime = part.inline_data.mime_type || "image/png";
          return `data:${mime};base64,${part.inline_data.data}`;
        }
      }
    }

    if (typeof msg.content === "object" && msg.content !== null && !Array.isArray(msg.content)) {
      const c = msg.content as any;
      if (c.image_url?.url) return c.image_url.url;
      if (c.url) return c.url;
      if (c.data && typeof c.data === "string") {
        const mime = c.mime_type || "image/png";
        return `data:${mime};base64,${c.data}`;
      }
      if (c.inline_data?.data) {
        const mime = c.inline_data.mime_type || "image/png";
        return `data:${mime};base64,${c.inline_data.data}`;
      }
      if (Array.isArray(c.parts)) {
        for (const part of c.parts) {
          if (part?.inline_data?.data) {
            const mime = part.inline_data.mime_type || "image/png";
            return `data:${mime};base64,${part.inline_data.data}`;
          }
          if (part?.image_url?.url) return part.image_url.url;
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
): Promise<{ imageUrl?: string; error?: string; isRetryable?: boolean; creditsExhausted?: boolean; rateLimited?: boolean }> {

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
          console.warn(`[generate-image] 429 on ${model}, retrying in ${delay}ms`);
          if (attempt < MAX_RETRIES - 1) { await sleep(delay); continue; }
          return { error: "Rate limit atingido.", isRetryable: true, rateLimited: true };
        }

        if (response.status === 402) {
          return { error: "Créditos de IA esgotados.", isRetryable: false, creditsExhausted: true };
        }

        if (!response.ok) {
          const text = await response.text();
          console.error(`[generate-image] ${model} error ${response.status}:`, text.substring(0, 300));
          break;
        }

        const rawText = await response.text();
        if (!rawText) {
          if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
          break;
        }

        let data: any;
        try { data = JSON.parse(rawText); } catch {
          if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
          break;
        }

        const imageUrl = extractImageFromGatewayResponse(data);
        if (imageUrl) {
          console.log(`[generate-image] Success with ${model}`);
          return { imageUrl };
        }

        if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
        break;

      } catch (e) {
        console.error(`[generate-image] Network error on ${model}:`, e);
        if (attempt < MAX_RETRIES - 1) { await sleep(1500); continue; }
        break;
      }
    }
  }

  return { error: "Nenhum modelo conseguiu gerar a imagem.", isRetryable: true };
}

// ── Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try { body = await req.json(); } catch {
      return ok({ error: "Invalid request body" });
    }

    const prompt = body.prompt;
    if (!prompt) return ok({ error: "Missing prompt" });

    const faceB64 = body.faceB64;
    const googleApiKey = body.googleApiKey;

    // If user provided their own Google API Key, use direct route
    if (googleApiKey && typeof googleApiKey === "string" && googleApiKey.trim()) {
      console.log("[generate-image] Using Google Direct route");
      const result = await generateWithGoogleDirect(prompt, faceB64, googleApiKey.trim());
      return ok(result);
    }

    // Fallback to Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return ok({ error: "LOVABLE_API_KEY not configured" });

    const result = await generateWithGateway(prompt, faceB64, LOVABLE_API_KEY);
    return ok(result);

  } catch (e) {
    console.error("generate-image error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error", isRetryable: true });
  }
});
