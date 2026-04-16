import { useState, useMemo, useEffect } from "react";
import { useCarousel } from "@/lib/carousel-store";
import { useProjects } from "@/hooks/use-projects";
import { FaceUpload } from "./FaceUpload";
import { LayoutRefUpload } from "./LayoutRefUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Type, Palette, Wand2, FileText, Image as ImageIcon, Layout,
  Folder, Plus, Trash2, Play, Square, FolderOpen, ChevronDown, ChevronRight, KeyRound,
} from "lucide-react";
import type { StyleKey, LightKey, FormatKey, FontKey, TypographyConfig } from "@/lib/parser";

type Tab = "config" | "projects";

const STYLES: { key: StyleKey; label: string; desc: string }[] = [
  { key: "ultra3d", label: "Ultra 3D", desc: "Render hiper-detalhado" },
  { key: "cinematic", label: "Cinemático", desc: "Foto retrato realista" },
  { key: "futuristic", label: "Futurista", desc: "Sci-fi neon" },
  { key: "cleancorp", label: "Clean Corp", desc: "P&B minimalista" },
];

const LIGHTS: { key: LightKey; label: string }[] = [
  { key: "warm", label: "Quente" },
  { key: "cold", label: "Frio" },
  { key: "clean", label: "Limpo" },
  { key: "neon", label: "Neon" },
  { key: "custom", label: "Custom" },
];

const FONTS: FontKey[] = ["rajdhani", "orbitron", "playfair", "inter", "bebas", "montserrat", "oswald", "space-grotesk"];

const FORMATS: { key: FormatKey; label: string }[] = [
  { key: "4:5", label: "4:5" },
  { key: "9:16", label: "9:16" },
  { key: "1:1", label: "1:1" },
];

function Section({ icon: Icon, title, children, defaultOpen = true }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border2/50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-card/40 transition-colors group"
      >
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-[10px] tracking-[2px] uppercase text-foreground flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function Sidebar() {
  const c = useCarousel();
  const projects = useProjects();
  const [tab, setTab] = useState<Tab>("config");
  const [newProjectName, setNewProjectName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (tab === "projects") {
      projects.getCounts().then(setCounts);
    }
  }, [tab, projects.projects.length]);

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = async () => {
    if (renamingId) {
      try {
        await projects.rename(renamingId, renameValue);
        toast({ title: "Projeto renomeado" });
      } catch (e: any) {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
      }
    }
    setRenamingId(null);
  };

  const canGenerate = c.rawText.trim().length > 0 && !c.isGenerating;

  const handleNewProject = async () => {
    const name = newProjectName.trim() || `Carrossel ${new Date().toLocaleString("pt-BR")}`;
    try {
      const p = await projects.create(name);
      if (p) {
        c.setCurrentProjectId(p.id);
        c.setRawText("");
        setNewProjectName("");
        toast({ title: "Projeto criado", description: name });
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Apagar projeto "${name}" e todas suas gerações?`)) return;
    await projects.remove(id);
    if (c.currentProjectId === id) c.setCurrentProjectId(null);
    toast({ title: "Projeto apagado" });
  };

  return (
    <aside className="bg-popover border-r border-border2 flex flex-col sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto">
      {/* Tabs */}
      <div className="flex border-b border-border2 shrink-0 sticky top-0 bg-popover z-10">
        {([
          { k: "config", label: "Configuração", icon: Wand2 },
          { k: "projects", label: "Projetos", icon: Folder },
        ] as const).map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 font-mono text-[10px] tracking-[2px] uppercase py-3 transition-all ${
              tab === k
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
            }`}
          >
            <Icon className="w-3 h-3" /> {label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <>
          {/* Project chip */}
          {c.currentProjectId && (
            <div className="px-4 py-2 bg-primary/5 border-b border-primary/20 flex items-center gap-2">
              <FolderOpen className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-mono text-primary tracking-wider truncate flex-1">
                {projects.projects.find((p) => p.id === c.currentProjectId)?.name || "Projeto atual"}
              </span>
              <button
                onClick={() => { c.setCurrentProjectId(null); c.setRawText(""); }}
                className="text-[10px] text-muted-foreground hover:text-destructive"
              >×</button>
            </div>
          )}

          <div className="px-4 py-3 border-b border-border2/50">
            <Link
              to="/account"
              className="flex items-center justify-between gap-2 px-3 py-2 border border-border2 rounded-sm hover:border-primary hover:bg-primary/5 transition group"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-primary" />
                <span className="font-mono text-[10px] tracking-[2px] uppercase text-foreground">API Key & Modelo</span>
              </span>
              <span className="font-mono text-[9px] tracking-wider text-muted-foreground group-hover:text-primary">
                Conta →
              </span>
            </Link>
          </div>

          <Section icon={ImageIcon} title="Rosto de Referência" defaultOpen={false}>
            <FaceUpload />
          </Section>

          <Section icon={Layout} title="Layout de Referência" defaultOpen={false}>
            <LayoutRefUpload />
          </Section>

          <Section icon={FileText} title="Roteiro do Carrossel">
            <textarea
              value={c.rawText}
              onChange={(e) => c.setRawText(e.target.value)}
              placeholder="Cole o roteiro... (separe slides com ---)"
              className="w-full bg-card border border-border2 rounded-sm font-mono text-[11px] px-2.5 py-2 text-foreground outline-none focus:border-primary placeholder:text-muted-foreground min-h-[180px] resize-y leading-relaxed"
            />
            <div className="text-[9px] font-mono text-muted-foreground mt-1.5 tracking-wider">
              Use TÍTULO / SUBTÍTULO / CTA / VISUAL / OBSERVAÇÃO
            </div>
          </Section>

          <Section icon={Palette} title="Estilo Visual">
            <div className="grid grid-cols-2 gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => c.setStyle(s.key)}
                  className={`text-left px-2.5 py-2 rounded-sm border transition-all font-mono ${
                    c.style === s.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border2 bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="text-[10px] tracking-wider uppercase font-semibold">{s.label}</div>
                  <div className="text-[8px] opacity-70 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section icon={Wand2} title="Iluminação">
            <div className="grid grid-cols-5 gap-1 mb-2">
              {LIGHTS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => c.setLight(l.key)}
                  className={`px-1 py-1.5 rounded-sm border text-[9px] font-mono uppercase tracking-wider transition-all ${
                    c.light === l.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border2 bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >{l.label}</button>
              ))}
            </div>
            {c.light === "neon" && (
              <div className="flex items-center gap-2 mt-2 bg-card border border-border2 rounded-sm px-2 py-1.5">
                <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground flex-1">Cor Neon</label>
                <input
                  type="color"
                  value={c.lightConfig.neonColor || "#c8ff00"}
                  onChange={(e) => c.setLightConfig({ ...c.lightConfig, light: "neon", neonColor: e.target.value })}
                  className="w-7 h-7 rounded-sm border border-border2 bg-transparent cursor-pointer"
                />
              </div>
            )}
            {c.light === "custom" && (
              <div className="space-y-1.5 mt-2">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2 bg-card border border-border2 rounded-sm px-2 py-1.5">
                    <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground flex-1">
                      Cor {i + 1}
                    </label>
                    <input
                      type="color"
                      value={c.lightConfig.customColors?.[i] || (i === 0 ? "#ff00aa" : "#00b4ff")}
                      onChange={(e) => {
                        const next: [string, string] = [
                          c.lightConfig.customColors?.[0] || "#ff00aa",
                          c.lightConfig.customColors?.[1] || "#00b4ff",
                        ];
                        next[i] = e.target.value;
                        c.setLightConfig({ ...c.lightConfig, light: "custom", customColors: next });
                      }}
                      className="w-7 h-7 rounded-sm border border-border2 bg-transparent cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section icon={Type} title="Tipografia">
            {(["title", "subtitle", "cta"] as const).map((k) => (
              <div key={k} className="mb-2">
                <label className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground block mb-1">
                  {k === "title" ? "Título" : k === "subtitle" ? "Subtítulo" : "CTA"}
                </label>
                <select
                  value={c.typography[k]}
                  onChange={(e) => c.setTypography({ ...c.typography, [k]: e.target.value as FontKey })}
                  className="w-full bg-card border border-border2 rounded-sm font-mono text-[10px] px-2 py-1.5 text-foreground outline-none focus:border-primary"
                >
                  {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            ))}
          </Section>

          <Section icon={Layout} title="Formato">
            <div className="grid grid-cols-3 gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => c.setFmt(f.key)}
                  className={`py-2 rounded-sm border text-[10px] font-mono uppercase tracking-wider transition-all ${
                    c.fmt === f.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border2 bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >{f.label}</button>
              ))}
            </div>
            <div className="mt-2 text-[9px] font-mono text-muted-foreground tracking-wider">
              Resolução fixa: <span className="text-primary">4K</span>
            </div>
          </Section>

          {/* Sticky generate button */}
          <div className="sticky bottom-0 p-4 bg-popover border-t border-border2 z-10">
            {!c.isGenerating ? (
              <Button
                onClick={c.startGeneration}
                disabled={!canGenerate}
                className="w-full font-mono uppercase tracking-[2px] text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" /> Gerar Carrossel
              </Button>
            ) : (
              <Button
                onClick={c.stopGeneration}
                disabled={c.isStopping}
                variant="destructive"
                className="w-full font-mono uppercase tracking-[2px] text-xs"
              >
                <Square className="w-3.5 h-3.5 mr-1.5" /> {c.isStopping ? "Parando..." : "Parar"}
              </Button>
            )}
          </div>
        </>
      )}

      {tab === "projects" && (
        <div className="p-4 space-y-3">
          <div className="flex gap-1.5">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Nome do projeto..."
              onKeyDown={(e) => e.key === "Enter" && handleNewProject()}
              className="h-8 text-xs font-mono bg-card border-border2"
            />
            <Button onClick={handleNewProject} size="sm" className="h-8">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          {projects.loading ? (
            <div className="text-[10px] font-mono text-muted-foreground text-center py-4">Carregando...</div>
          ) : projects.projects.length === 0 ? (
            <div className="text-[10px] font-mono text-muted-foreground text-center py-6 border border-dashed border-border2 rounded-sm">
              Nenhum projeto ainda.<br />Crie seu primeiro acima.
            </div>
          ) : (
            <div className="space-y-1.5">
              {projects.projects.map((p) => {
                const active = p.id === c.currentProjectId;
                const isRenaming = renamingId === p.id;
                const count = counts[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`group border rounded-sm p-2.5 transition-all ${isRenaming ? "" : "cursor-pointer"} ${
                      active
                        ? "border-primary bg-primary/10 shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
                        : "border-border2 bg-card hover:border-primary/50"
                    }`}
                    onClick={() => { if (!isRenaming) { c.loadProject(p.id); setTab("config"); } }}
                  >
                    <div className="flex items-start gap-2.5">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt="" loading="lazy"
                          className="w-12 h-12 object-cover rounded-sm border border-border2 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 flex items-center justify-center rounded-sm border border-border2 bg-card2 shrink-0">
                          <Folder className={`w-4 h-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                              if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
                            }}
                            className="h-6 text-[11px] font-mono px-1.5 py-0 bg-background border-primary"
                          />
                        ) : (
                          <div
                            className="text-[11px] font-mono text-foreground truncate"
                            onDoubleClick={(e) => { e.stopPropagation(); startRename(p.id, p.name); }}
                            title="Clique-duplo para renomear"
                          >
                            {p.name}
                          </div>
                        )}
                        <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{new Date(p.updated_at).toLocaleDateString("pt-BR")}</span>
                          <span className={`px-1.5 py-0.5 rounded-sm tracking-wider uppercase ${
                            count > 0 ? "bg-primary/15 text-primary" : "bg-card border border-border2"
                          }`}>
                            {count} {count === 1 ? "geração" : "gerações"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id, p.name); }}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
