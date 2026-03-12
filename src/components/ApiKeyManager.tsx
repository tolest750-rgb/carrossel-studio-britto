import { useState, useEffect, useCallback } from "react";
import {
  getKeys, addKey, removeKey, type GeminiKeyEntry,
  getSelectedModel, setSelectedModel,
  updateKeyModels, markKeyExpired, type KeyStatus,
  IMAGE_MODEL_PRIORITY,
} from "@/lib/api-keys";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DiscoveredModel {
  id: string;
  displayName: string;
}

export function ApiKeyManager({ open, onClose }: Props) {
  const [keys, setKeys] = useState<GeminiKeyEntry[]>([]);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(getSelectedModel());
  const [modelsForKey, setModelsForKey] = useState<DiscoveredModel[]>([]);
  const [loadingModels, setLoadingModels] = useState<string | null>(null); // keyId being loaded
  const [selectedKeyForModels, setSelectedKeyForModels] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const k = getKeys();
      setKeys(k);
      setModel(getSelectedModel());
      setModelsForKey([]);
      setSelectedKeyForModels(null);
      // Auto-discover models for first valid key
      const firstValid = k.find(x => x.status !== "expired");
      if (firstValid) {
        discoverModels(firstValid);
      }
    }
  }, [open]);

  const discoverModels = useCallback(async (entry: GeminiKeyEntry) => {
    setLoadingModels(entry.id);
    setSelectedKeyForModels(entry.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: { action: "list-models", geminiApiKey: entry.key },
      });
      if (error || data?.errorType === "API_KEY_INVALID") {
        markKeyExpired(entry.id);
        setKeys(getKeys());
        setModelsForKey([]);
        return;
      }
      if (data?.models) {
        const models = data.models as DiscoveredModel[];
        setModelsForKey(models);
        updateKeyModels(entry.id, models.map(m => m.id));
        setKeys(getKeys());
      }
    } catch (e) {
      console.error("Failed to discover models:", e);
    } finally {
      setLoadingModels(null);
    }
  }, []);

  if (!open) return null;

  const handleAdd = async () => {
    if (!apiKey.trim()) return;
    const entry = addKey(name.trim() || `Chave ${keys.length + 1}`, apiKey);
    setKeys(getKeys());
    setName("");
    setApiKey("");
    // Auto-discover models for new key
    discoverModels(entry);
  };

  const handleRemove = (id: string) => {
    removeKey(id);
    setKeys(getKeys());
    if (selectedKeyForModels === id) {
      setModelsForKey([]);
      setSelectedKeyForModels(null);
    }
  };

  const handleModelChange = (id: string) => {
    setModel(id);
    setSelectedModel(id);
  };

  const maskKey = (k: string) => k.slice(0, 8) + "••••••••" + k.slice(-4);

  const statusBadge = (status?: KeyStatus) => {
    if (status === "expired") return <span className="text-[7px] tracking-[1px] text-destructive bg-destructive/10 border border-destructive/20 rounded-sm px-1.5 py-0.5">EXPIRADA</span>;
    if (status === "valid") return <span className="text-[7px] tracking-[1px] text-primary bg-primary/10 border border-primary/20 rounded-sm px-1.5 py-0.5">VÁLIDA</span>;
    return <span className="text-[7px] tracking-[1px] text-muted-foreground bg-muted/10 border border-border rounded-sm px-1.5 py-0.5">N/A</span>;
  };

  // Sort: image-capable models first
  const sortedModels = [...modelsForKey].sort((a, b) => {
    const aIdx = IMAGE_MODEL_PRIORITY.indexOf(a.id);
    const bIdx = IMAGE_MODEL_PRIORITY.indexOf(b.id);
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });

  const isImageModel = (id: string) => IMAGE_MODEL_PRIORITY.includes(id) || id.includes("image");

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border2 rounded-sm w-full max-w-lg mx-4 shadow-[0_0_40px_hsl(var(--primary)/0.1)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-primary text-sm">⚡</span>
            <span className="font-mono text-[11px] tracking-[2px] uppercase text-foreground">CHAVES API GEMINI</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors">✕</button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Key List */}
          <div className="px-4 py-3">
            <div className="font-mono text-[8px] tracking-[1.5px] uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <span className="text-primary">◈</span> CHAVES CADASTRADAS
              <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
            </div>
            {keys.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-muted-foreground font-mono text-[10px] tracking-[1px]">NENHUMA CHAVE CADASTRADA</div>
                <div className="text-muted-foreground/60 font-mono text-[9px] mt-1">Adicione chaves do Google AI Studio abaixo</div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className={`flex items-center justify-between bg-background border rounded-sm px-3 py-2 group transition-colors cursor-pointer ${
                      selectedKeyForModels === k.id ? "border-primary/40" : "border-border2 hover:border-primary/25"
                    } ${k.status === "expired" ? "opacity-60" : ""}`}
                    onClick={() => k.status !== "expired" && discoverModels(k)}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-foreground tracking-[0.5px] truncate">{k.name}</span>
                        {statusBadge(k.status)}
                        {loadingModels === k.id && (
                          <span className="text-[7px] text-warning font-mono animate-pulse">VERIFICANDO...</span>
                        )}
                      </div>
                      <span className="font-mono text-[8px] text-muted-foreground tracking-[0.5px]">
                        {maskKey(k.key)}
                        {k.failCount > 0 && (
                          <span className="ml-2 text-warning">⚠ {k.failCount} falha{k.failCount > 1 ? "s" : ""}</span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(k.id); }}
                      className="text-muted-foreground hover:text-destructive font-mono text-[9px] px-2 py-1 border border-transparent hover:border-destructive/30 rounded-sm transition-all opacity-0 group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Model Selector */}
          <div className="px-4 py-3 border-t border-border2 bg-background/30">
            <div className="font-mono text-[8px] tracking-[1.5px] uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
              <span className="text-primary">◈</span> MODELO
              <span className="flex-1 h-px bg-gradient-to-r from-border2 to-transparent" />
            </div>

            {sortedModels.length > 0 ? (
              <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
                {sortedModels.map((m) => {
                  const isImage = isImageModel(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleModelChange(m.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-sm border text-left transition-all duration-200 ${
                        model === m.id
                          ? "bg-primary/10 border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.1)]"
                          : "bg-background border-border2 hover:border-primary/25"
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 transition-all ${
                          model === m.id ? "bg-primary shadow-[0_0_6px_hsl(var(--primary))]" : "bg-border2"
                        }`}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-[10px] tracking-[0.5px] truncate ${model === m.id ? "text-primary" : "text-foreground"}`}>
                            {m.displayName}
                          </span>
                          {isImage && (
                            <span className="text-[6px] tracking-[1px] text-accent bg-accent/10 border border-accent/20 rounded-sm px-1 py-0 shrink-0">IMG</span>
                          )}
                        </div>
                        <span className="font-mono text-[8px] text-muted-foreground truncate">{m.id}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-3">
                <div className="text-muted-foreground font-mono text-[9px]">
                  {keys.length === 0
                    ? "Adicione uma chave para ver os modelos disponíveis"
                    : loadingModels
                      ? "Carregando modelos..."
                      : "Clique em uma chave para ver os modelos"}
                </div>
                <div className="font-mono text-[8px] text-muted-foreground/60 mt-1">
                  Modelo atual: <span className="text-foreground">{model}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Form */}
        <div className="px-4 py-3 border-t border-border2 bg-background/40 shrink-0">
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
