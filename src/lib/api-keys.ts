const STORAGE_KEY = "gemini_api_keys";

export interface GeminiKeyEntry {
  id: string;
  name: string;
  key: string;
  addedAt: string;
  failCount: number;
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
