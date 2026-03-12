const STORAGE_KEY = "gemini_api_keys";
const MODEL_KEY = "gemini_selected_model";
const ACTIVE_KEY_KEY = "gemini_active_key_name";

export interface GeminiKeyEntry {
  id: string;
  name: string;
  key: string;
  addedAt: string;
  failCount: number;
}

export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash", desc: "Rápido, suporta imagem" },
  { id: "gemini-2.5-flash-preview-05-20", label: "Gemini 2.5 Flash", desc: "Equilibrado, multimodal" },
  { id: "gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro", desc: "Mais capaz, mais lento" },
] as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[number]["id"];

export function getSelectedModel(): GeminiModelId {
  const stored = localStorage.getItem(MODEL_KEY);
  if (stored && GEMINI_MODELS.some((m) => m.id === stored)) return stored as GeminiModelId;
  return "gemini-2.0-flash-exp";
}

export function setSelectedModel(model: GeminiModelId): void {
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
  return keys.find((k) => !excludeIds.includes(k.id)) ?? null;
}

export function markKeyFailed(id: string): void {
  const keys = getKeys();
  const k = keys.find((x) => x.id === id);
  if (k) k.failCount++;
  saveKeys(keys);
}

export function resetAllFailCounts(): void {
  const keys = getKeys();
  keys.forEach((k) => (k.failCount = 0));
  saveKeys(keys);
}

export class AllKeysExhaustedError extends Error {
  constructor() {
    super("Todas as chaves API foram tentadas e falharam. Adicione uma nova chave para continuar.");
    this.name = "AllKeysExhaustedError";
  }
}
