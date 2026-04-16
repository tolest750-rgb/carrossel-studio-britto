import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EdgeResult {
  imageUrl?: string;
  error?: string;
  isRetryable?: boolean;
  rateLimited?: boolean;
  needsKey?: boolean;
  paywall?: boolean;
}

export interface GeminiResult {
  imageUrl: string | null;
  finalPrompt: string;
}

const MAX_CLIENT_RETRIES = 2;

async function callEdgeFunction(prompt: string, faceB64?: string, model?: string): Promise<EdgeResult> {
  const result = await supabase.functions.invoke("generate-image", {
    body: { prompt, faceB64, model },
  });
  if (result.error) {
    return {
      error: typeof result.error === "string" ? result.error : result.error.message || "Edge Function error",
      isRetryable: true,
    };
  }
  return result.data as EdgeResult;
}

export async function callGemini(
  sl: ProcessedSlide,
  varIdx: number,
  faceB64: string,
  model?: string,
): Promise<GeminiResult> {
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
    const result = await callEdgeFunction(promptText, sendFace, model);

    if (result.paywall) {
      toast({
        title: "Assinatura inativa",
        description: "Acesse a página de planos para assinar.",
        variant: "destructive",
      });
      throw new Error("PAYWALL");
    }
    if (result.needsKey) {
      toast({
        title: "Chave Google API necessária",
        description: "Configure sua chave em Configurações.",
        variant: "destructive",
      });
      throw new Error("NEEDS_KEY");
    }

    if (result.imageUrl) return { imageUrl: result.imageUrl, finalPrompt: promptText };

    if (!result.isRetryable || attempt === MAX_CLIENT_RETRIES) {
      throw new Error(result.error || "Erro desconhecido na geração");
    }
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  throw new Error("Falha após múltiplas tentativas");
}
