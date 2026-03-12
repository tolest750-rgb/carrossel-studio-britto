import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: object) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ── Lovable AI Gateway ───────────────────────────────────────

const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
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

    // 1. Check msg.images array
    if (msg.images?.length) {
      for (const img of msg.images) {
        if (img?.image_url?.url) return img.image_url.url;
        if (img?.url) return img.url;
        if (img?.data) return `data:image/png;base64,${img.data}`;
      }
    }

    // 2. Check msg.content as array
    if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part?.type === "image_url" && part?.image_url?.url) return part.image_url.url;
        if (part?.type === "image" && part?.url) return part.url;
        if (part?.type === "image" && part?.data) {
          return `data:image/png;base64,${part.data}`;
        }
        // inline_data format (Gemini native)
        if (part?.inline_data?.data) {
          const mime = part.inline_data.mime_type || "image/png";
          return `data:${mime};base64,${part.inline_data.data}`;
        }
      }
    }

    // 3. Check msg.content as plain object (non-array)
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
      // Recursively check nested parts
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

    // 4. Check msg.content as base64 string
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
          console.warn(`[generate-image] 429 on ${model}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          if (attempt < MAX_RETRIES - 1) { await sleep(delay); continue; }
          return { error: "Rate limit atingido. Aguarde alguns segundos e tente novamente.", isRetryable: true, rateLimited: true };
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
        const rawContent = msg?.content;
        let contentPreview = "";
        try {
          contentPreview = typeof rawContent === "string" ? rawContent.substring(0, 200) : JSON.stringify(rawContent)?.substring(0, 200);
        } catch { contentPreview = "[unserializable]"; }

        console.warn(`[generate-image] No image extracted from ${model} (attempt ${attempt + 1}/${MAX_RETRIES}). Structure:`,
          JSON.stringify({
            hasChoices: !!data?.choices?.length,
            messageKeys: msg ? Object.keys(msg) : [],
            contentType: typeof msg?.content,
            contentIsArray: Array.isArray(msg?.content),
            hasImages: !!msg?.images?.length,
            imagesCount: msg?.images?.length || 0,
          }),
          `\nContent preview: ${contentPreview}`
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return ok({ error: "LOVABLE_API_KEY not configured" });

    const result = await generateWithGateway(prompt, faceB64, LOVABLE_API_KEY);
    return ok(result);

  } catch (e) {
    console.error("generate-image error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error", isRetryable: true });
  }
});
