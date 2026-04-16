import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, KeyRound, Eye, EyeOff, CheckCircle2, ExternalLink } from "lucide-react";

interface GoogleModel {
  id: string;
  displayName: string;
  description?: string;
  supportsImage: boolean;
}

interface Props {
  onModelChange?: (modelId: string) => void;
}

export function ApiKeyManager({ onModelChange }: Props) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<GoogleModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("google_api_key_encrypted, selected_model")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.google_api_key_encrypted) {
        setHasKey(true);
        setSelectedModel(data.selected_model || "");
        loadModels();
      }
    })();
  }, []);

  const saveKey = async () => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-google-key", {
        body: { apiKey: keyInput.trim() },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erro ao salvar");
      toast({ title: "Chave salva", description: "Chave Google API criptografada com sucesso." });
      setKeyInput("");
      setHasKey(true);
      await loadModels();
    } catch (e: any) {
      toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadModels = async () => {
    setLoadingModels(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-google-models");
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const mdls = (data?.models || []) as GoogleModel[];
      setModels(mdls);
      if (mdls.length && !selectedModel) {
        const def = mdls.find((m) => m.id.includes("image")) || mdls[0];
        setSelectedModel(def.id);
        await persistModel(def.id);
      }
    } catch (e: any) {
      toast({ title: "Não foi possível listar modelos", description: e.message, variant: "destructive" });
    } finally {
      setLoadingModels(false);
    }
  };

  const persistModel = async (modelId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ selected_model: modelId }).eq("user_id", user.id);
    onModelChange?.(modelId);
  };

  const removeKey = async () => {
    if (!confirm("Remover sua chave Google API?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({
      google_api_key_encrypted: null,
      google_api_key_nonce: null,
    }).eq("user_id", user.id);
    setHasKey(false);
    setModels([]);
    setSelectedModel("");
    toast({ title: "Chave removida" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[2px] text-muted-foreground">
        <KeyRound className="w-3 h-3 text-primary" /> Google API Key
        {hasKey && <CheckCircle2 className="w-3 h-3 text-primary ml-auto" />}
      </div>

      {!hasKey ? (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIza..."
                className="pr-9 h-9 text-xs font-mono bg-card border-border2"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Button onClick={saveKey} disabled={saving || !keyInput.trim()} size="sm" className="h-9">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
            </Button>
          </div>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline font-mono uppercase tracking-wider"
          >
            Obter chave grátis no Google AI Studio <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-sm px-2 py-1.5">
            <span className="text-[10px] font-mono text-primary tracking-wider">CHAVE ATIVA •••••••••</span>
            <button onClick={removeKey} className="ml-auto text-[10px] text-destructive hover:underline font-mono uppercase tracking-wider">
              Remover
            </button>
          </div>

          <div>
            <div className="text-[10px] font-mono uppercase tracking-[2px] text-muted-foreground mb-1.5">
              Modelo de Imagem
            </div>
            {loadingModels ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando modelos...
              </div>
            ) : models.length === 0 ? (
              <Button onClick={loadModels} variant="outline" size="sm" className="w-full h-8 text-[10px]">
                Recarregar modelos
              </Button>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => { setSelectedModel(e.target.value); persistModel(e.target.value); }}
                className="w-full bg-card border border-border2 rounded-sm font-mono text-[11px] px-2 py-1.5 text-foreground outline-none focus:border-primary"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName} {m.supportsImage ? "🖼️" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </>
      )}
    </div>
  );
}
