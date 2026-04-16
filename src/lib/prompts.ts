import type { SlideData, StyleKey, LightKey, FormatKey, TypographyConfig, LightConfig, FontKey } from "./parser";

const FONT_DESCRIPTIONS: Record<FontKey, string> = {
  rajdhani: "Rajdhani — geometric semi-condensed sans-serif, modern futuristic feel",
  orbitron: "Orbitron — wide geometric sans-serif, sci-fi tech aesthetic",
  playfair: "Playfair Display — elegant high-contrast serif, editorial luxury",
  inter: "Inter — clean neutral grotesque sans-serif, professional minimalism",
  bebas: "Bebas Neue — tall narrow condensed sans-serif, bold poster impact",
  montserrat: "Montserrat — geometric humanist sans-serif, friendly modern",
  oswald: "Oswald — narrow condensed sans-serif, headline strength",
  "space-grotesk": "Space Grotesk — geometric grotesque sans-serif, contemporary tech",
};

// ─── STYLE PRESETS ────────────────────────────────────────────
const STYLES: Record<StyleKey, string> = {
  ultra3d:
    "ultra-photorealistic 3D render quality, hyper-detailed textures, octane-render aesthetic, volumetric lighting, subsurface scattering on skin, ray-traced reflections, micro-detail in every surface — pure photographic realism",
  cinematic:
    "ultra-realistic cinematic portrait photography, 50mm-85mm prime lens f/1.4, extreme skin detail and pore texture, natural film grain, Hollywood color grading, photorealistic — all shadow zones carry the scene's ambient color temperature at low intensity, never pure black voids",
  futuristic:
    "hyper-realistic sci-fi portrait, futuristic neon practical lights, cyberpunk art direction, photorealistic — neon light bleeds and spills into all dark background zones, colored atmospheric glow contaminates shadows, every dark area has visible ambient hue from the scene's neon sources",
  cleancorp:
    "clean minimalist black-and-white corporate photography, flat composition, high-contrast monochrome, ample negative space, editorial magazine quality, no color saturation, ultra-sharp subject, professional studio lighting",
};

const LIGHTS: Record<LightKey, string> = {
  warm: "warm amber-golden key light, amber light contamination visible in all dark zones — warm golden haze in background depth, shadows carry rich ochre-sienna undertones, luxury gold color grade — NEVER pure black",
  cold: "cool electric blue key light, blue light spill across dark background surfaces, cool desaturated mid-tones, neon blue rim light on subject edges, NEVER pure black in shadows",
  clean: "soft uniform clean white key light, balanced exposure, neutral color temperature, minimal shadows, bright airy atmosphere, studio softbox quality",
  neon: "vibrant neon practical lights with strong colored spill onto background and subject edges, atmospheric color glow, cyberpunk ambience — colored shadows NEVER pure black",
  custom: "custom dual-color lighting palette with two complementary hues bleeding through the scene, atmospheric color contamination in all shadow zones, NEVER pure black",
};

const TITLE_IN_IMAGE_KEYWORDS = [
  "título na cena", "titulo na cena", "na cena o título", "na cena o titulo",
  "título na imagem", "titulo na imagem", "title in the image", "title in scene",
  "renderizar o título", "renderizar o titulo", "burn the title",
  "queimar o título", "queimar o titulo", "burn title", "render title",
  "título", "titulo",
  "estilo de título", "estilo de titulo", "title style", "lettering estilo", "tipografia estilo",
];

export function visualHasTitleInImage(visual: string): boolean {
  const v = (visual ?? "").toLowerCase();
  return TITLE_IN_IMAGE_KEYWORDS.some((kw) => v.includes(kw));
}

const NEG_NO_TEXT =
  "text, typography, letters, words, watermark, logo, overlay text, speech bubbles, cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed, pure black background, flat background, studio seamless backdrop, solid color background, zero-light shadow zones, washed out skin, plastic skin, airbrushed face";

const NEG_WITH_TEXT =
  "cartoon, anime, illustration, CGI, low quality, blurry, distorted face, different person, wrong identity, bad anatomy, deformed, pure black background, flat background, studio seamless backdrop, solid color background, zero-light shadow zones, washed out skin, plastic skin, airbrushed face";

export const VAR_HINTS = [
  "",
  ", slightly different camera angle, subtle lighting variation",
  ", alternative composition, different atmospheric depth",
  ", unique creative framing, slightly different light mood",
];

// ─── PERSON DETECTION ─────────────────────────────────────────
const PERSON_KEYWORDS = [
  "pessoa", "homem", "mulher", "menino", "menina", "criança",
  "executivo", "empresário", "empresária", "líder", "atleta",
  "médico", "profissional", "founder", "ceo", "palestrante",
  "especialista", "autor", "coach", "ele", "ela",
  "person", "man", "woman", "boy", "girl", "human", "speaker", "expert",
];

export function visualHasPerson(visual: string): boolean {
  const v = (visual ?? "").toLowerCase();
  return PERSON_KEYWORDS.some((kw) => v.includes(kw));
}

const NON_PERSON_WORDS = new Set([
  "cena", "slide", "visual", "estilo", "câmera", "camera", "lente", "plano",
  "composição", "composicao", "iluminação", "iluminacao", "profundidade", "campo",
  "primeiro", "segundo", "terceiro", "fundo", "frente", "esquerda", "direita",
  "centro", "topo", "base", "lateral", "diagonal", "abertura", "encerramento",
  "episódio", "episodio", "close", "ultra", "hiper", "super", "realismo",
  "realista", "cinematográfico", "cinematografico", "editorial", "dramático",
  "dramatico", "suave", "forte", "intenso", "leve", "amplo", "aberto", "fechado",
  "brooklyn", "manhattan", "paris", "london", "tokyo", "roma", "berlin",
  "brasília", "brasilia", "rua", "avenida", "praça", "praca", "bairro", "cidade",
  "país", "pais", "sala", "cozinha", "quarto", "escritório", "escritorio",
  "escola", "igreja", "estudio", "estúdio", "corleone",
  "bokeh", "grading", "color", "grain", "analógico", "analogico", "formato",
  "qualidade", "textura", "atmosfera", "ambiente", "clima",
  "seriado", "série", "serie", "família", "familia", "casa", "episodio", "capa",
  "todo", "todos", "toda", "todas", "mundo", "odeia", "cris", "rock",
  "motion", "freeze", "ring", "light",
  "call", "action", "face", "reference", "full", "body", "half", "negative", "positive",
]);

const QUOTE_RE = /"[^"]*"|'[^']*'|\u201c[^\u201d]*\u201d|\u2018[^\u2019]*\u2019/g;
const SERIES_CONTEXT_RE = /,?\s+do seriado\s+[^.,;\n]+/gi;
const CAPITALIZED_WORD_RE =
  /\b[A-ZÁÉÍÓÚÂÊÔÃÕÇÑ][A-ZÁÉÍÓÚÂÊÔÃÕÇÑa-záéíóúâêôãõçñ]{2,}(?:\s+(?:de|do|da|dos|das|e|von|van|del|di|el|al)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇÑ][a-záéíóúâêôãõçñ]{2,})?\b/g;

export function visualMentionsNamedPerson(visual: string): string | false {
  const visualClean = (visual ?? "").replace(QUOTE_RE, "").replace(SERIES_CONTEXT_RE, "");
  const matches = visualClean.match(CAPITALIZED_WORD_RE) || [];
  const nameMatch = matches.find(
    (m) => !NON_PERSON_WORDS.has(m.toLowerCase()) && !NON_PERSON_WORDS.has(m.split(" ")[0].toLowerCase()),
  );
  return nameMatch || false;
}

const SKIN_REALISM =
  "ultra-detailed skin texture with visible pores, natural skin imperfections, subsurface scattering on skin creating translucent warmth under strong light, sharp catchlights in eyes with natural iris detail, individual hair strands visible, natural micro-expressions";

// ─── TITLE STYLE DETECTION ────────────────────────────────────
export type TitleStyle =
  | "default" | "everybody-hates-chris" | "stranger-things" | "breaking-bad"
  | "peaky-blinders" | "money-heist" | "squid-game" | "wednesday"
  | "succession" | "the-office" | "ozark" | "narcos" | "euphoria"
  | "game-of-thrones" | "vikings" | "taxi-driver" | "pulp-fiction"
  | "blade-runner" | "star-wars" | "matrix" | "fight-club";

const TITLE_STYLE_MAP: Array<{ keywords: string[]; style: TitleStyle }> = [
  { keywords: ["todo mundo odeia", "everybody hates", "everybody hates chris", "todo mundo odeia o chris", "seriado chris"], style: "everybody-hates-chris" },
  { keywords: ["stranger things", "upside down", "demogorgon"], style: "stranger-things" },
  { keywords: ["breaking bad", "heisenberg", "walter white"], style: "breaking-bad" },
  { keywords: ["peaky blinders", "peaky", "shelby"], style: "peaky-blinders" },
  { keywords: ["money heist", "casa de papel", "la casa de papel"], style: "money-heist" },
  { keywords: ["squid game", "round 6", "squid"], style: "squid-game" },
  { keywords: ["wednesday", "addams", "wednesday addams"], style: "wednesday" },
  { keywords: ["succession", "roy family"], style: "succession" },
  { keywords: ["the office", "dunder mifflin", "mockumentary"], style: "the-office" },
  { keywords: ["ozark", "byrde"], style: "ozark" },
  { keywords: ["narcos", "escobar", "cartel"], style: "narcos" },
  { keywords: ["euphoria", "rue"], style: "euphoria" },
  { keywords: ["game of thrones", "got", "westeros"], style: "game-of-thrones" },
  { keywords: ["vikings", "ragnar", "norse", "nórdico"], style: "vikings" },
  { keywords: ["taxi driver", "de niro"], style: "taxi-driver" },
  { keywords: ["pulp fiction", "tarantino"], style: "pulp-fiction" },
  { keywords: ["blade runner", "cyberpunk 2077", "dystopia"], style: "blade-runner" },
  { keywords: ["star wars", "jedi", "sith"], style: "star-wars" },
  { keywords: ["matrix", "neo", "morpheus"], style: "matrix" },
  { keywords: ["fight club", "tyler durden"], style: "fight-club" },
];

export function detectTitleStyle(visual: string, design?: string): TitleStyle {
  const src = ((visual ?? "") + " " + (design ?? "")).toLowerCase();
  for (const entry of TITLE_STYLE_MAP) {
    if (entry.keywords.some((kw) => src.includes(kw))) return entry.style;
  }
  return "default";
}

// ─── BUILD PROMPT ─────────────────────────────────────────────
export function buildPrompt(
  sl: SlideData,
  style: StyleKey,
  light: LightKey,
  fmt: FormatKey,
  options?: { useFaceRef?: boolean },
) {
  const useFaceRef = options?.useFaceRef ?? false;
  const titleInImage = visualHasTitleInImage(sl.visual ?? "");

  const fmtHint: Record<FormatKey, string> = {
    "4:5": "vertical 4:5 portrait format (1080×1350px)",
    "9:16": "vertical 9:16 tall format (1080×1920px)",
    "1:1": "square 1:1 format (1080×1080px)",
  };

  const faceInstruction = useFaceRef
    ? [
        "FACE REFERENCE IMAGE ATTACHED:",
        "Use it ONLY to extract the facial identity — face shape, eye color/shape, skin tone, nose, lips, jawline, brow, hair.",
        "DO NOT reproduce the reference photo's background, clothing, pose or lighting.",
        "GENERATE a completely new photograph of this same person FROM SCRATCH, naturally embedded in the scene below.",
        "The face must be unmistakably the same individual with zero influence from the reference except facial identity.",
      ].join(" ")
    : "";

  const hasPerson = visualHasPerson(sl.visual ?? "");

  const parts = [
    faceInstruction,
    "SCENE DESCRIPTION:",
    fmtHint[fmt],
    STYLES[style],
    sl.visual,
    LIGHTS[light],
    sl.design || "",
    hasPerson ? SKIN_REALISM : "",
    "",
    "COMPOSITION & LAYOUT:",
    "The image MUST have strong compositional hierarchy with dramatic negative space.",
    "Position the main subject off-center following the rule of thirds.",
    titleInImage
      ? "TYPOGRAPHY IS PART OF THE SCENE: render the title text directly embedded in the image with the requested style. The text must be fully legible, stylized, and integrated into the composition."
      : "Leave at least 30-40% of the image as clean dark/atmospheric area for text overlay (do NOT add text — just leave clean space).",
    "Create natural depth separation: sharp foreground subject, soft bokeh mid-ground, atmospheric background.",
    "CRITICAL: Ensure at least one large area of the image has low visual complexity (soft gradients, bokeh, shadow) for typography placement.",
    "",
    "QUALITY & ATMOSPHERE:",
    "professional commercial photography, dramatic atmospheric depth, cinematic bokeh, subject tack-sharp, rich textured shadows with ambient color contamination at 8-15% intensity, volumetric light spill, colored shadows NEVER pure black, Hasselblad medium format quality",
  ]
    .filter((s) => s !== undefined && s !== null)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");

  return { pos: parts, neg: titleInImage ? NEG_WITH_TEXT : NEG_NO_TEXT };
}

// ─── BUILD LAYOUT (accent only) ──────────────────────────────
export function buildLayout(light: LightKey): { accent: string } {
  const ACC: Record<LightKey, string> = {
    warm: "#f5c842",
    cold: "#00b4ff",
    clean: "#ffffff",
    neon: "#c8ff00",
    custom: "#c8ff00",
  };
  return { accent: ACC[light] };
}
