import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";
import {
  getKeys, getNextKey, markKeyFailed, resetAllFailCounts, AllKeysExhaustedError,
  getSelectedModel, setActiveKeyName, clearActiveKeyName,
} from "./api-keys";

interface EdgeResult {
  imageUrl?: string;
  error?: string;
  isRetryable?: boolean;
}

async function callEdgeFunction(
  promptText: string,
  faceB64?: string,
  geminiApiKey?: string,
  geminiModel?: string,
): Promise<EdgeResult> {
  const body: Record<string, string | undefined> = { prompt: promptText, faceB64, geminiApiKey, geminiModel };
  const result = await supabase.functions.invoke("generate-image", { body });

  if (result.error) {
    const msg = typeof result.error === "string" ? result.error : result.error.message || "Edge Function error";
    return { error: msg, isRetryable: true };
  }

  return result.data as EdgeResult;
}

export async function callGemini(sl: ProcessedSlide, varIdx: number, faceB64: string): Promise<string | null> {
  if (varIdx > 0) {
    await new Promise((r) => setTimeout(r, varIdx * 3000));
  }

  const promptText = [
    sl.prompt.pos + VAR_HINTS[varIdx],
    "",
    "NEGATIVE — Strictly avoid the following in the generated image:",
    sl.prompt.neg,
  ]
    .filter(Boolean)
    .join("\n");

  const sendFace = sl.useFaceRef && faceB64 ? faceB64 : undefined;
  const selectedModel = getSelectedModel();

  // ── Try user keys first with rotation ──
  const userKeys = getKeys();
  if (userKeys.length > 0) {
    const triedIds: string[] = [];

    while (true) {
      const key = getNextKey(triedIds);
      if (!key) break;

      triedIds.push(key.id);
      setActiveKeyName(key.name);

      const result = await callEdgeFunction(promptText, sendFace, key.key, selectedModel);

      if (result.imageUrl) {
        resetAllFailCounts();
        clearActiveKeyName();
        return result.imageUrl;
      }

      markKeyFailed(key.id);
      console.warn(`[gemini] Key "${key.name}" failed: ${result.error}. Trying next...`);
    }
  }

  // ── Fallback: default LOVABLE_API_KEY ──
  setActiveKeyName("LOVABLE (padrão)");
  const result = await callEdgeFunction(promptText, sendFace);
  clearActiveKeyName();

  if (result.imageUrl) return result.imageUrl;

  if (userKeys.length > 0) {
    throw new AllKeysExhaustedError();
  }

  throw new Error(result.error || "Unknown error generating image");
}
