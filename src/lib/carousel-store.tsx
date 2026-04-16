import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import type { ProcessedSlide, StyleKey, LightKey, FormatKey, ResKey, LayoutPosition, TypographyConfig, LightConfig, FontKey } from "./parser";
import { parseSlides } from "./parser";
import { buildPrompt, buildLayout, visualHasPerson, visualMentionsNamedPerson, detectTitleStyle } from "./prompts";
import type { TitleStyle } from "./prompts";
import { analyzeLayout, composeSlide } from "./compositor";
import { visualHasTitleInImage } from "./prompts";
import type { AILayout } from "./compositor";
import { callGemini } from "./gemini";
import { supabase } from "@/integrations/supabase/client";

export interface FacePreset { id: string; name: string; dataUrl: string; b64: string; }
export interface LayoutPreset { id: string; name: string; dataUrl: string; }

const DEFAULT_TYPOGRAPHY: TypographyConfig = { title: "rajdhani", subtitle: "inter", cta: "orbitron" };
const DEFAULT_LIGHT_CONFIG: LightConfig = { light: "warm", neonColor: "#c8ff00", customColors: ["#ff00aa", "#00b4ff"] };

interface CarouselState {
  faceB64: string;
  faceDataUrl: string;
  faceName: string;
  style: StyleKey;
  light: LightKey;
  fmt: FormatKey;
  res: ResKey;
  typography: TypographyConfig;
  lightConfig: LightConfig;
  selectedModel: string;
  currentProjectId: string | null;
  rawText: string;
  slides: ProcessedSlide[];
  composedBlobs: Record<number, (Blob | null)[]>;
  varUrls: Record<string, string>;
  varPrompts: Record<string, string>;
  varStatuses: Record<string, "idle" | "generating" | "done" | "error">;
  varErrors: Record<string, string>;
  slideStatuses: Record<number, "idle" | "processing" | "complete" | "error">;
  isGenerating: boolean;
  isStopping: boolean;
  progress: { done: number; total: number };
  generationComplete: boolean;
  layoutRefDataUrl: string;
  layoutRefName: string;
  slideSteps: Record<number, string[]>;
  facePresets: FacePreset[];
  layoutPresets: LayoutPreset[];
}

interface CarouselActions {
  setFace: (file: File) => void;
  setStyle: (s: StyleKey) => void;
  setLight: (l: LightKey) => void;
  setFmt: (f: FormatKey) => void;
  setRes: (r: ResKey) => void;
  setRawText: (t: string) => void;
  setLayoutRef: (file: File) => void;
  setTypography: (t: TypographyConfig) => void;
  setLightConfig: (c: LightConfig) => void;
  setSelectedModel: (m: string) => void;
  setCurrentProjectId: (id: string | null) => void;
  loadProject: (projectId: string) => Promise<void>;
  saveCurrentProject: () => Promise<void>;
  startGeneration: () => Promise<void>;
  stopGeneration: () => void;
  regenVar: (slideIdx: number, varIdx: number) => Promise<void>;
  getVarBlob: (slideIdx: number, varIdx: number) => Blob | null;
  saveFacePreset: (name: string) => void;
  deleteFacePreset: (id: string) => void;
  saveLayoutPreset: (name: string) => void;
  deleteLayoutPreset: (id: string) => void;
  applyFacePreset: (preset: FacePreset) => void;
  applyLayoutPreset: (preset: LayoutPreset) => void;
}

const CarouselContext = createContext<(CarouselState & CarouselActions) | null>(null);

export function useCarousel() {
  const ctx = useContext(CarouselContext);
  if (!ctx) throw new Error("useCarousel must be used within CarouselProvider");
  return ctx;
}

async function shrinkToBase64(imgSrc: string, w: number, h: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
    };
    img.onerror = reject;
    img.src = imgSrc;
  });
}

async function generateAndCompose(
  sl: ProcessedSlide,
  varIdx: number,
  faceB64: string,
  isFirstOrLast: boolean,
  titleStyle: TitleStyle,
  model: string,
): Promise<{ blob: Blob; url: string; finalPrompt: string }> {
  const result = await callGemini(sl, varIdx, faceB64, model);
  const imgSrc = result.imageUrl;

  let aiLayout: AILayout | undefined;
  if (imgSrc) {
    try {
      const snapDims: Record<string, [number, number]> = {
        "4:5": [540, 675], "9:16": [405, 720], "1:1": [540, 540],
      };
      const [sw, sh] = snapDims[sl.fmt] ?? [540, 675];
      const snap = await shrinkToBase64(imgSrc, sw, sh);
      const titleInImg = visualHasTitleInImage(sl.visual ?? "");
      aiLayout = await analyzeLayout(
        snap,
        titleInImg ? "" : sl.titulo,
        sl.subtitulo ?? "",
        !!sl.cta,
        sl.fmt,
        titleStyle,
      );
    } catch { /* uses DEFAULT_LAYOUT */ }
  }

  const blob = await composeSlide(imgSrc, sl, faceB64, aiLayout, isFirstOrLast);
  const url = URL.createObjectURL(blob);
  return { blob, url, finalPrompt: result.finalPrompt };
}

async function uploadGeneration(blob: Blob, userId: string, projectId: string, slideIdx: number, varIdx: number): Promise<string | null> {
  try {
    const path = `${userId}/${projectId}/${slideIdx}_${varIdx}_${Date.now()}.png`;
    const { error } = await supabase.storage.from("generations").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) { console.error("[upload]", error); return null; }
    const { data } = supabase.storage.from("generations").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) { console.error("[upload]", e); return null; }
}

export function CarouselProvider({ children }: { children: React.ReactNode }) {
  const [faceB64, setFaceB64State] = useState("");
  const [faceDataUrl, setFaceDataUrl] = useState("");
  const [faceName, setFaceName] = useState("");
  const [layoutRefDataUrl, setLayoutRefDataUrl] = useState("");
  const [layoutRefName, setLayoutRefName] = useState("");
  const [style, setStyle] = useState<StyleKey>("cinematic");
  const [light, setLight] = useState<LightKey>("warm");
  const [fmt, setFmt] = useState<FormatKey>("4:5");
  const [res, setRes] = useState<ResKey>("4K");
  const [typography, setTypography] = useState<TypographyConfig>(DEFAULT_TYPOGRAPHY);
  const [lightConfig, setLightConfig] = useState<LightConfig>(DEFAULT_LIGHT_CONFIG);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash-image-preview");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [slides, setSlides] = useState<ProcessedSlide[]>([]);
  const [composedBlobs, setComposedBlobs] = useState<Record<number, (Blob | null)[]>>({});
  const [varUrls, setVarUrls] = useState<Record<string, string>>({});
  const [varPrompts, setVarPrompts] = useState<Record<string, string>>({});
  const [varStatuses, setVarStatuses] = useState<Record<string, "idle" | "generating" | "done" | "error">>({});
  const [slideStatuses, setSlideStatuses] = useState<Record<number, "idle" | "processing" | "complete" | "error">>({});
  const [varErrors, setVarErrors] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [generationComplete, setGenerationComplete] = useState(false);
  const [slideSteps, setSlideSteps] = useState<Record<number, string[]>>({});
  const [facePresets, setFacePresets] = useState<FacePreset[]>(() => {
    try { return JSON.parse(localStorage.getItem("facePresets") || "[]"); } catch { return []; }
  });
  const [layoutPresets, setLayoutPresets] = useState<LayoutPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem("layoutPresets") || "[]"); } catch { return []; }
  });

  const faceB64Ref = useRef("");
  const stopRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Load user + selected_model from profile on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;
      const { data } = await supabase.from("profiles").select("selected_model").eq("user_id", user.id).maybeSingle();
      if (data?.selected_model) setSelectedModel(data.selected_model);
    })();
  }, []);

  const setFace = useCallback((file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const b64 = dataUrl.split(",")[1];
      setFaceB64State(b64); faceB64Ref.current = b64;
      setFaceDataUrl(dataUrl); setFaceName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  const setLayoutRef = useCallback((file: File) => {
    const r = new FileReader();
    r.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLayoutRefDataUrl(dataUrl); setLayoutRefName(file.name);
    };
    r.readAsDataURL(file);
  }, []);

  const saveFacePreset = useCallback((name: string) => {
    if (!faceDataUrl || !faceB64Ref.current) return;
    const preset: FacePreset = { id: Date.now().toString(), name, dataUrl: faceDataUrl, b64: faceB64Ref.current };
    setFacePresets((prev) => { const next = [...prev, preset]; localStorage.setItem("facePresets", JSON.stringify(next)); return next; });
  }, [faceDataUrl]);
  const deleteFacePreset = useCallback((id: string) => {
    setFacePresets((prev) => { const next = prev.filter((p) => p.id !== id); localStorage.setItem("facePresets", JSON.stringify(next)); return next; });
  }, []);
  const applyFacePreset = useCallback((preset: FacePreset) => {
    setFaceB64State(preset.b64); faceB64Ref.current = preset.b64;
    setFaceDataUrl(preset.dataUrl); setFaceName(preset.name);
  }, []);
  const saveLayoutPreset = useCallback((name: string) => {
    if (!layoutRefDataUrl) return;
    const preset: LayoutPreset = { id: Date.now().toString(), name, dataUrl: layoutRefDataUrl };
    setLayoutPresets((prev) => { const next = [...prev, preset]; localStorage.setItem("layoutPresets", JSON.stringify(next)); return next; });
  }, [layoutRefDataUrl]);
  const deleteLayoutPreset = useCallback((id: string) => {
    setLayoutPresets((prev) => { const next = prev.filter((p) => p.id !== id); localStorage.setItem("layoutPresets", JSON.stringify(next)); return next; });
  }, []);
  const applyLayoutPreset = useCallback((preset: LayoutPreset) => {
    setLayoutRefDataUrl(preset.dataUrl); setLayoutRefName(preset.name);
  }, []);

  const stopGeneration = useCallback(() => { stopRef.current = true; setIsStopping(true); }, []);

  const setVarUrl = (si: number, vi: number, url: string) => setVarUrls((p) => ({ ...p, [`${si}_${vi}`]: url }));
  const setVarStatus = (si: number, vi: number, s: "idle" | "generating" | "done" | "error") =>
    setVarStatuses((p) => ({ ...p, [`${si}_${vi}`]: s }));
  const setSlideStatus = (i: number, s: "idle" | "processing" | "complete" | "error") =>
    setSlideStatuses((p) => ({ ...p, [i]: s }));

  const saveCurrentProject = useCallback(async () => {
    if (!currentProjectId) return;
    await supabase.from("projects").update({
      script_data: { rawText } as any,
      parameters: { style, light, fmt, res, typography, lightConfig } as any,
      updated_at: new Date().toISOString(),
    }).eq("id", currentProjectId);
  }, [currentProjectId, rawText, style, light, fmt, res, typography, lightConfig]);

  const loadProject = useCallback(async (projectId: string) => {
    const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    if (!project) return;
    setCurrentProjectId(projectId);
    const sd: any = project.script_data || {};
    const params: any = project.parameters || {};
    if (sd.rawText) setRawText(sd.rawText);
    if (params.style) setStyle(params.style);
    if (params.light) setLight(params.light);
    if (params.fmt) setFmt(params.fmt);
    if (params.res) setRes(params.res);
    if (params.typography) setTypography(params.typography);
    if (params.lightConfig) setLightConfig(params.lightConfig);

    // Load saved generations
    const { data: gens } = await supabase.from("generations").select("*").eq("project_id", projectId).order("slide_index").order("variation_index");
    if (gens && gens.length) {
      const urls: Record<string, string> = {};
      const prompts: Record<string, string> = {};
      const statuses: Record<string, "done"> = {};
      gens.forEach((g: any) => {
        const k = `${g.slide_index}_${g.variation_index}`;
        if (g.image_url) { urls[k] = g.image_url; statuses[k] = "done"; }
        if (g.final_prompt) prompts[k] = g.final_prompt;
      });
      setVarUrls(urls);
      setVarPrompts(prompts);
      setVarStatuses(statuses);
    } else {
      setVarUrls({}); setVarPrompts({}); setVarStatuses({}); setSlideStatuses({});
    }
    setComposedBlobs({});
    setSlides([]);
    setGenerationComplete(false);
  }, []);

  const persistGen = useCallback(async (projectId: string, slideIdx: number, varIdx: number, blob: Blob, finalPrompt: string) => {
    if (!userIdRef.current) return;
    const url = await uploadGeneration(blob, userIdRef.current, projectId, slideIdx, varIdx);
    await supabase.from("generations").insert({
      user_id: userIdRef.current,
      project_id: projectId,
      slide_index: slideIdx,
      variation_index: varIdx,
      image_url: url,
      final_prompt: finalPrompt,
      model_used: selectedModel,
    });
  }, [selectedModel]);

  const startGeneration = useCallback(async () => {
    if (!rawText.trim()) return;
    const parsed = parseSlides(rawText);
    if (!parsed.length) return;

    // Auto-create project if none selected
    let projectId = currentProjectId;
    if (!projectId && userIdRef.current) {
      const name = `Carrossel ${new Date().toLocaleString("pt-BR")}`;
      const { data: np } = await supabase.from("projects").insert({
        user_id: userIdRef.current,
        name,
        script_data: { rawText } as any,
        parameters: { style, light, fmt, res, typography, lightConfig } as any,
      } as any).select().single();
      if (np) { projectId = np.id; setCurrentProjectId(np.id); }
    } else if (projectId) {
      await saveCurrentProject();
    }

    stopRef.current = false;
    const hasFaceRef = !!faceB64Ref.current;
    const totalSlides = parsed.length;

    const processedSlides: ProcessedSlide[] = parsed.map((s) => {
      const hasPerson = visualHasPerson(s.visual ?? "");
      const hasNamedPerson = visualMentionsNamedPerson(s.visual ?? "");
      const useFaceRef = hasFaceRef && hasPerson && !hasNamedPerson;
      const layoutPos: LayoutPosition = "bottom-left";
      return {
        ...s,
        prompt: buildPrompt(s, style, light, fmt, { useFaceRef, typography, lightConfig }),
        layout: {
          ...buildLayout(light, lightConfig),
          layoutPos,
          slideNum: s.num,
          titulo: s.titulo,
          subtitulo: s.subtitulo ?? "",
          cta: s.cta ?? "",
        },
        layoutPosition: layoutPos,
        useFaceRef,
        fmt, style, light, res,
        typography,
        lightConfig,
        titleStyle: detectTitleStyle(s.visual ?? "", s.design),
      } as ProcessedSlide;
    });

    setSlides(processedSlides);
    setComposedBlobs({}); setVarUrls({}); setVarStatuses({}); setVarErrors({}); setVarPrompts({});
    setSlideStatuses({}); setSlideSteps({});
    setIsGenerating(true); setIsStopping(false); setGenerationComplete(false);
    setProgress({ done: 0, total: totalSlides });

    const newBlobs: Record<number, (Blob | null)[]> = {};

    for (let i = 0; i < processedSlides.length; i++) {
      if (stopRef.current) { setSlideStatus(i, "idle"); break; }
      setProgress({ done: i, total: totalSlides });
      setSlideStatus(i, "processing");
      newBlobs[i] = new Array(4).fill(null);
      const isFirstOrLast = i === 0 || i === totalSlides - 1;
      const titleStyle = (processedSlides[i] as any).titleStyle ?? "default";

      [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "generating"));

      try {
        const results = await Promise.allSettled(
          [0, 1, 2, 3].map((varIdx) =>
            generateAndCompose(processedSlides[i], varIdx, faceB64Ref.current, isFirstOrLast, titleStyle, selectedModel)
          )
        );
        if (stopRef.current) break;

        for (let v = 0; v < 4; v++) {
          const r = results[v];
          if (r.status === "fulfilled") {
            newBlobs[i][v] = r.value.blob;
            setVarUrl(i, v, r.value.url);
            setVarPrompts((p) => ({ ...p, [`${i}_${v}`]: r.value.finalPrompt }));
            setVarStatus(i, v, "done");
            if (projectId) persistGen(projectId, i, v, r.value.blob, r.value.finalPrompt).catch(console.error);
          } else {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`[slide ${i} var ${v}]`, msg);
            setVarErrors((p) => ({ ...p, [`${i}_${v}`]: msg }));
            setVarStatus(i, v, "error");
          }
        }
        setComposedBlobs((prev) => ({ ...prev, [i]: [...newBlobs[i]] }));
        if (!stopRef.current) setSlideStatus(i, "complete");
      } catch {
        setSlideStatus(i, "error");
        [0, 1, 2, 3].forEach((v) => setVarStatus(i, v, "error"));
      }
    }

    setProgress({ done: totalSlides, total: totalSlides });
    setIsGenerating(false); setIsStopping(false);
    if (!stopRef.current) setGenerationComplete(true);
  }, [rawText, style, light, fmt, res, typography, lightConfig, selectedModel, currentProjectId, saveCurrentProject, persistGen]);

  const regenVar = useCallback(async (slideIdx: number, varIdx: number) => {
    const sl = slides[slideIdx];
    if (!sl) return;
    const isFirstOrLast = slideIdx === 0 || slideIdx === slides.length - 1;
    const titleStyle = (sl as any).titleStyle ?? "default";
    setVarStatus(slideIdx, varIdx, "generating");
    try {
      const { blob, url, finalPrompt } = await generateAndCompose(sl, varIdx, faceB64Ref.current, isFirstOrLast, titleStyle, selectedModel);
      setVarUrl(slideIdx, varIdx, url);
      setVarPrompts((p) => ({ ...p, [`${slideIdx}_${varIdx}`]: finalPrompt }));
      setVarStatus(slideIdx, varIdx, "done");
      setComposedBlobs((prev) => {
        const arr = [...(prev[slideIdx] || new Array(4).fill(null))];
        arr[varIdx] = blob;
        return { ...prev, [slideIdx]: arr };
      });
      if (currentProjectId) persistGen(currentProjectId, slideIdx, varIdx, blob, finalPrompt).catch(console.error);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setVarErrors((p) => ({ ...p, [`${slideIdx}_${varIdx}`]: msg }));
      setVarStatus(slideIdx, varIdx, "error");
    }
  }, [slides, selectedModel, currentProjectId, persistGen]);

  const getVarBlob = useCallback((si: number, vi: number) => composedBlobs[si]?.[vi] || null, [composedBlobs]);

  const value: CarouselState & CarouselActions = {
    faceB64, faceDataUrl, faceName, layoutRefDataUrl, layoutRefName, slideSteps,
    style, light, fmt, res, typography, lightConfig, selectedModel, currentProjectId,
    rawText, slides, composedBlobs, varUrls, varPrompts, varStatuses,
    varErrors, slideStatuses, isGenerating, isStopping, progress, generationComplete,
    facePresets, layoutPresets,
    setFace, setLayoutRef, setStyle, setLight, setFmt, setRes, setRawText,
    setTypography, setLightConfig, setSelectedModel, setCurrentProjectId,
    loadProject, saveCurrentProject,
    startGeneration, stopGeneration, regenVar, getVarBlob,
    saveFacePreset, deleteFacePreset, applyFacePreset,
    saveLayoutPreset, deleteLayoutPreset, applyLayoutPreset,
  };

  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>;
}
