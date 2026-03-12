import { useState, useEffect } from "react";
import { getKeys, addKey, removeKey, type GeminiKeyEntry } from "@/lib/api-keys";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ApiKeyManager({ open, onClose }: Props) {
  const [keys, setKeys] = useState<GeminiKeyEntry[]>([]);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (open) setKeys(getKeys());
  }, [open]);

  if (!open) return null;

  const handleAdd = () => {
    if (!apiKey.trim()) return;
    addKey(name.trim() || `Chave ${keys.length + 1}`, apiKey);
    setKeys(getKeys());
    setName("");
    setApiKey("");
  };

  const handleRemove = (id: string) => {
    removeKey(id);
    setKeys(getKeys());
  };

  const maskKey = (k: string) => k.slice(0, 8) + "••••••••" + k.slice(-4);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border2 rounded-sm w-full max-w-lg mx-4 shadow-[0_0_40px_hsl(var(--primary)/0.1)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border2">
          <div className="flex items-center gap-2">
            <span className="text-primary text-sm">⚡</span>
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-foreground">CHAVES API GEMINI</span>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Key List */}
        <div className="px-4 py-3 max-h-[240px] overflow-y-auto">
          {keys.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-muted-foreground font-mono text-[10px] tracking-[1px]">
                NENHUMA CHAVE CADASTRADA
              </div>
              <div className="text-muted-foreground/60 font-mono text-[9px] mt-1">
                Adicione chaves do Google AI Studio abaixo
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between bg-background border border-border2 rounded-sm px-3 py-2 group hover:border-primary/25 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="font-mono text-[10px] text-foreground tracking-[0.5px] truncate">
                      {k.name}
                    </span>
                    <span className="font-mono text-[8px] text-muted-foreground tracking-[0.5px]">
                      {maskKey(k.key)}
                      {k.failCount > 0 && (
                        <span className="ml-2 text-warning">⚠ {k.failCount} falha{k.failCount > 1 ? "s" : ""}</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemove(k.id)}
                    className="text-muted-foreground hover:text-destructive font-mono text-[9px] px-2 py-1 border border-transparent hover:border-destructive/30 rounded-sm transition-all opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Form */}
        <div className="px-4 py-3 border-t border-border2 bg-background/40">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nome (opcional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-[0.4] bg-background border border-border2 rounded-sm px-2 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
              <input
                type="password"
                placeholder="AIza... (chave API)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="flex-1 bg-background border border-border2 rounded-sm px-2 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex items-center justify-between">
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[8px] tracking-[0.5px] text-accent hover:underline"
              >
                ↗ OBTER CHAVE NO GOOGLE AI STUDIO
              </a>
              <button
                onClick={handleAdd}
                disabled={!apiKey.trim()}
                className="font-mono text-[9px] tracking-[1.5px] uppercase bg-primary/10 border border-primary/40 text-primary rounded-sm px-4 py-1.5 hover:bg-primary/20 hover:border-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                + ADICIONAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
