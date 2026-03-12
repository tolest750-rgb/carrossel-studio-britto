import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";

interface EdgeResult {
  imageUrl?: string;
  error?: string;
  isRetryable?: boolean;
}

const MAX_CLIENT_RETRIES = 3;

async function callEdgeFunction(promptText: string, faceB64?: string): Promise<EdgeResult> {
  const googleApiKey = localStorage.getItem("googleApiKey") || undefined;
  const body: Record<string, string | undefined> = { prompt: promptText, faceB64, googleApiKey };
  const result = await supabase.functions.invoke("generate-image", { body });

  if (result.error) {
    const msg = typeof result.error === "string" ? result.error : result.error.message || "Edge Function error";
    return { error: msg, isRetryable: true };
  }

  return result.data as EdgeResult;
}

export async function callGemini(sl: ProcessedSlide, varIdx: number, faceB64: string): Promise<string | null> {
  const promptText = [
    sl.prompt.pos + VAR_HINTS[varIdx],
    "",
    "NEGATIVE — Strictly avoid the following in the generated image:",
    sl.prompt.neg,
  ]
    .filter(Boolean)
    .join("\n");

  const sendFace = sl.useFaceRef && faceB64 ? faceB64 : undefined;

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    const result = await callEdgeFunction(promptText, sendFace);

    if (result.imageUrl) return result.imageUrl;

    if (!result.isRetryable || attempt === MAX_CLIENT_RETRIES) {
      throw new Error(result.error || "Erro desconhecido na geração de imagem");
    }

    // Wait before retry
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }

  throw new Error("Falha após múltiplas tentativas");
}
