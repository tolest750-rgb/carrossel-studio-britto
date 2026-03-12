import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface EdgeResult {
  imageUrl?: string;
  error?: string;
  isRetryable?: boolean;
  creditsExhausted?: boolean;
  rateLimited?: boolean;
}

const MAX_CLIENT_RETRIES = 3;

function incrementTodayCount() {
  const today = new Date().toISOString().slice(0, 10);
  const stored = localStorage.getItem("ai_usage");
  let data = stored ? JSON.parse(stored) : { date: today, count: 0 };
  if (data.date !== today) data = { date: today, count: 0 };
  data.count++;
  localStorage.setItem("ai_usage", JSON.stringify(data));
  window.dispatchEvent(new Event("ai_usage_updated"));
}

async function callEdgeFunction(promptText: string, faceB64?: string): Promise<EdgeResult> {
  const body: Record<string, string | undefined> = { prompt: promptText, faceB64 };
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

    if (result.creditsExhausted) {
      toast({
        title: "⚠️ Créditos esgotados",
        description: "Seus créditos de IA acabaram. Adicione mais créditos nas configurações do workspace.",
        variant: "destructive",
      });
      throw new Error("Créditos de IA esgotados");
    }

    if (result.rateLimited) {
      toast({
        title: "⏳ Rate limit",
        description: "Muitas requisições. Aguarde alguns segundos...",
      });
    }

    if (result.imageUrl) {
      incrementTodayCount();
      return result.imageUrl;
    }

    if (!result.isRetryable || attempt === MAX_CLIENT_RETRIES) {
      throw new Error(result.error || "Erro desconhecido na geração de imagem");
    }

    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }

  throw new Error("Falha após múltiplas tentativas");
}
