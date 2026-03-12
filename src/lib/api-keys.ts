const STORAGE_KEY = "gemini_api_keys";
const MODEL_KEY = "gemini_selected_model";
const ACTIVE_KEY_KEY = "gemini_active_key_name";
const KEY_MODELS_KEY = "gemini_key_models"; // cache of models per key

export type KeyStatus = "valid" | "expired" | "unknown" | "checking";

export interface GeminiKeyEntry {
  id: string;
  name: string;
  key: string;
  addedAt: string;
  failCount: number;
  status?: KeyStatus;
  availableModels?: string[];
}

export interface DiscoveredModel {
  id: string;
  displayName: string;
  description: string;
}

// Valid image generation models (June 2026)
export const IMAGE_MODEL_PRIORITY = [
  "gemini-2.5-flash-preview-image-generation",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-2.0-flash-exp",
];

// Legacy models that should be migrated
const LEGACY_MODELS = [
  "gemini-2.0-flash-exp",
  "gemini-2.0-flash-preview-image-generation",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-pro-preview-06-05",
  "gemini-2.0-flash",
];

const DEFAULT_MODEL = "gemini-2.5-flash-preview-image-generation";

export function getSelectedModel(): string {
  const stored = localStorage.getItem(MODEL_KEY);
  // Migrate legacy model
  if (!stored || LEGACY_MODELS.includes(stored)) {
    localStorage.setItem(MODEL_KEY, DEFAULT_MODEL);
    return DEFAULT_MODEL;
  }
  return stored;
}

export function setSelectedModel(model: string): void {
  localStorage.setItem(MODEL_KEY, model);
}

export function getActiveKeyName(): string {
  return localStorage.getItem(ACTIVE_KEY_KEY) || "";
}

export function setActiveKeyName(name: string): void {
  localStorage.setItem(ACTIVE_KEY_KEY, name);
  window.dispatchEvent(new CustomEvent("active-key-changed"));
}

export function clearActiveKeyName(): void {
  localStorage.removeItem(ACTIVE_KEY_KEY);
  window.dispatchEvent(new CustomEvent("active-key-changed"));
}

export function getKeys(): GeminiKeyEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveKeys(keys: GeminiKeyEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function addKey(name: string, key: string): GeminiKeyEntry {
  const entry: GeminiKeyEntry = {
    id: crypto.randomUUID(),
    name,
    key: key.trim(),
    addedAt: new Date().toISOString(),
    failCount: 0,
    status: "unknown",
  };
  const keys = getKeys();
  keys.push(entry);
  saveKeys(keys);
  return entry;
}

export function removeKey(id: string): void {
  saveKeys(getKeys().filter((k) => k.id !== id));
}

export function getNextKey(excludeIds: string[]): GeminiKeyEntry | null {
  const keys = getKeys();
  return keys.find((k) => !excludeIds.includes(k.id) && k.status !== "expired") ?? null;
}

export function markKeyFailed(id: string): void {
  const keys = getKeys();
  const k = keys.find((x) => x.id === id);
  if (k) k.failCount++;
  saveKeys(keys);
}

export function markKeyExpired(id: string): void {
  const keys = getKeys();
  const k = keys.find((x) => x.id === id);
  if (k) k.status = "expired";
  saveKeys(keys);
}

export function updateKeyModels(id: string, models: string[]): void {
  const keys = getKeys();
  const k = keys.find((x) => x.id === id);
  if (k) {
    k.availableModels = models;
    k.status = "valid";
  }
  saveKeys(keys);
}

export function resetAllFailCounts(): void {
  const keys = getKeys();
  keys.forEach((k) => (k.failCount = 0));
  saveKeys(keys);
}

/** Pick the best model for a key given user preference */
export function pickBestModel(selectedModel: string, availableModels?: string[]): string {
  if (!availableModels || availableModels.length === 0) return selectedModel;
  if (availableModels.includes(selectedModel)) return selectedModel;
  for (const m of IMAGE_MODEL_PRIORITY) {
    if (availableModels.includes(m)) return m;
  }
  return availableModels[0] || selectedModel;
}

export class AllKeysExhaustedError extends Error {
  public reasons: string[];
  constructor(reasons: string[] = []) {
    const msg = reasons.length > 0
      ? `Todas as chaves falharam: ${[...new Set(reasons)].join(", ")}`
      : "Todas as chaves API foram tentadas e falharam. Adicione uma nova chave para continuar.";
    super(msg);
    this.name = "AllKeysExhaustedError";
    this.reasons = reasons;
  }
}
