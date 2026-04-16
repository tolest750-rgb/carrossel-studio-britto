import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, ok } from "../_shared/cors.ts";
import {
  decryptKeyForUser,
  getSelectedModelForUser,
  userHasActiveSubscription,
} from "../_shared/google-key.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_RETRIES = 2;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateWithGoogle(
  prompt: string,
  faceB64: string | undefined,
  apiKey: string,
  model: string,
): Promise<{ imageUrl?: string; error?: string; isRetryable?: boolean; rateLimited?: boolean }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const parts: any[] = [{ text: prompt }];
      if (faceB64) parts.push({ inlineData: { mimeType: "image/jpeg", data: faceB64 } });

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES - 1) {
          await sleep(5000 * (attempt + 1));
          continue;
        }
        return { error: "Rate limit Google API. Aguarde alguns segundos.", isRetryable: true, rateLimited: true };
      }

      if (response.status === 400 || response.status === 403) {
        const text = await response.text();
        console.error(`[google] ${response.status}:`, text.substring(0, 300));
        return { error: `Erro Google API (${response.status}): verifique sua chave e modelo.`, isRetryable: false };
      }

      if (!response.ok) {
        const text = await response.text();
        console.error(`[google] ${response.status}:`, text.substring(0, 300));
        if (attempt < MAX_RETRIES - 1) {
          await sleep(2000);
          continue;
        }
        return { error: `Erro Google API: ${response.status}`, isRetryable: true };
      }

      const data = await response.json();
      const candidates = data?.candidates;
      if (!candidates?.length) {
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1500);
          continue;
        }
        return { error: "Nenhum candidato retornado pelo Google.", isRetryable: true };
      }

      for (const candidate of candidates) {
        const contentParts = candidate?.content?.parts;
        if (!Array.isArray(contentParts)) continue;
        for (const part of contentParts) {
          if (part?.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            return { imageUrl: `data:${mime};base64,${part.inlineData.data}` };
          }
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(1500);
        continue;
      }
      return { error: "Google retornou resposta sem imagem (provavelmente filtro de segurança).", isRetryable: false };
    } catch (e) {
      console.error("[google] Network error:", e);
      if (attempt < MAX_RETRIES - 1) {
        await sleep(2000);
        continue;
      }
      return { error: "Erro de rede ao chamar Google API.", isRetryable: true };
    }
  }

  return { error: "Falha após retentativas.", isRetryable: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return ok({ error: "Você precisa estar logado." }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return ok({ error: "Sessão inválida." }, 401);

    // Subscription gate
    const hasSub = await userHasActiveSubscription(user.id);
    if (!hasSub) {
      return ok({ error: "Assinatura inativa. Assine para gerar imagens.", paywall: true }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = body.prompt;
    if (!prompt) return ok({ error: "Missing prompt" });
    const faceB64 = body.faceB64;

    const apiKey = await decryptKeyForUser(user.id);
    if (!apiKey) {
      return ok({
        error: "Configure sua chave Google API em Configurações antes de gerar.",
        needsKey: true,
      }, 400);
    }

    const model = body.model || (await getSelectedModelForUser(user.id));
    const result = await generateWithGoogle(prompt, faceB64, apiKey, model);
    return ok(result);
  } catch (e) {
    console.error("generate-image error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error", isRetryable: true });
  }
});
