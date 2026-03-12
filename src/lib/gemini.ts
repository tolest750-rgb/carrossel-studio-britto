import type { ProcessedSlide } from "./parser";
import { VAR_HINTS } from "./prompts";
import { supabase } from "@/integrations/supabase/client";
import {
  getKeys, getNextKey, markKeyFailed, markKeyExpired, resetAllFailCounts,
  AllKeysExhaustedError, getSelectedModel, setActiveKeyName, clearActiveKeyName,
  pickBestModel, IMAGE_MODEL_PRIORITY,
} from "./api-keys";

interface EdgeResult {
  imageUrl?: string;
  error?: string;
  isRetryable?: boolean;
  errorType?: string; // API_KEY_INVALID | MODEL_NOT_FOUND | RESOURCE_EXHAUSTED | PERMISSION_DENIED | UNKNOWN
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
    return { error: msg, isRetryable: true, errorType: "UNKNOWN" };
  }

  return result.data as EdgeResult;
}

// Model fallback list for when selected model gives 404
function getModelFallbacks(selectedModel: string): string[] {
  const fallbacks = IMAGE_MODEL_PRIORITY.filter(m => m !== selectedModel);
  return [selectedModel, ...fallbacks];
}

export async function callGemini(sl: ProcessedSlide, varIdx: number, faceB64: string): Promise<string | null> {
  // No artificial delay needed - generation is now sequential

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

  // ── Try user keys first with smart rotation ──
  const userKeys = getKeys();
  const failReasons: string[] = [];

  if (userKeys.length > 0) {
    const triedKeyIds: string[] = [];

    while (true) {
      const key = getNextKey(triedKeyIds);
      if (!key) break;

      triedKeyIds.push(key.id);
      setActiveKeyName(key.name);

      // Try models in priority order for this key
      const modelsToTry = key.availableModels
        ? [pickBestModel(selectedModel, key.availableModels)]
        : getModelFallbacks(selectedModel);

      let keyFullyFailed = false;

      for (const model of modelsToTry) {
        const result = await callEdgeFunction(promptText, sendFace, key.key, model);

        if (result.imageUrl) {
          resetAllFailCounts();
          clearActiveKeyName();
          return result.imageUrl;
        }

        const errorType = result.errorType || "UNKNOWN";

        // API_KEY_INVALID: mark expired, skip to next key
        if (errorType === "API_KEY_INVALID") {
          markKeyExpired(key.id);
          failReasons.push(`${key.name}: chave expirada`);
          keyFullyFailed = true;
          break;
        }

        // MODEL_NOT_FOUND: try next model on same key
        if (errorType === "MODEL_NOT_FOUND") {
          console.warn(`[gemini] Model "${model}" not found for key "${key.name}", trying next model...`);
          continue;
        }

        // RESOURCE_EXHAUSTED: skip to next key immediately
        if (errorType === "RESOURCE_EXHAUSTED") {
          markKeyFailed(key.id);
          failReasons.push(`${key.name}: limite/créditos esgotados`);
          keyFullyFailed = true;
          break;
        }

        // PERMISSION_DENIED: skip to next key
        if (errorType === "PERMISSION_DENIED") {
          markKeyFailed(key.id);
          failReasons.push(`${key.name}: permissão negada`);
          keyFullyFailed = true;
          break;
        }

        // UNKNOWN: try next model, then next key
        console.warn(`[gemini] Key "${key.name}" model "${model}" failed: ${result.error}`);
        continue;
      }

      if (!keyFullyFailed) {
        // All models tried, none worked
        markKeyFailed(key.id);
        failReasons.push(`${key.name}: nenhum modelo compatível`);
      }
    }
  }

  // ── Fallback: default LOVABLE_API_KEY ──
  setActiveKeyName("LOVABLE (padrão)");
  const result = await callEdgeFunction(promptText, sendFace);
  clearActiveKeyName();

  if (result.imageUrl) return result.imageUrl;

  if (userKeys.length > 0) {
    throw new AllKeysExhaustedError(failReasons);
  }

  throw new Error(result.error || "Unknown error generating image");
}
