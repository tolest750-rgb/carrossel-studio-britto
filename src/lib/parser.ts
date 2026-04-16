export interface SlideData {
  n: number;
  tot: number;
  titulo: string;
  subtitulo: string;
  cta: string;
  visual: string;
  design: string;
  num: string;
}

export type LayoutPosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'right'
  | 'left'
  | 'top-center'
  | 'center'
  | 'split-bottom';

export interface ProcessedSlide extends SlideData {
  prompt: { pos: string; neg: string };
  layout: { accent: string; layoutPos: LayoutPosition; slideNum: string; titulo: string; subtitulo: string; cta: string };
  layoutPosition: LayoutPosition;
  useFaceRef: boolean;
  fmt: string;
  style: string;
  light: string;
  res: string;
}

// New style options
export type StyleKey = 'ultra3d' | 'cinematic' | 'futuristic' | 'cleancorp';

// New lighting options (with extra payloads for neon/custom colors)
export type LightKey = 'warm' | 'cold' | 'clean' | 'neon' | 'custom';

export type FormatKey = '4:5' | '9:16' | '1:1';
export type ResKey = '4K';

// Typography options
export type FontKey =
  | 'rajdhani'
  | 'orbitron'
  | 'playfair'
  | 'inter'
  | 'bebas'
  | 'montserrat'
  | 'oswald'
  | 'space-grotesk';

export interface TypographyConfig {
  title: FontKey;
  subtitle: FontKey;
  cta: FontKey;
}

export interface LightConfig {
  light: LightKey;
  neonColor?: string;       // for neon
  customColors?: [string, string]; // for custom palette
}

export function parseSlides(raw: string): SlideData[] {
  const blocks = raw.split(/\n\s*-{3,}\s*\n/).map(b => b.trim()).filter(Boolean);
  const tot = blocks.length;
  return blocks.map((blk, i) => {
    const ex = (k: string): string => {
      let m = blk.match(new RegExp('[├└─].*?' + k + '[^:\\n]*:\\s*(.+?)(?=\\n[├└─]|$)', 'si'));
      if (!m) m = blk.match(new RegExp('^' + k + '[^:\\n]*:\\s*(.+?)(?=\\n[A-ZÁÉÍÓÚ]|$)', 'mi'));
      return m ? m[1].replace(/\(se houver\)/gi, '').trim() : '';
    };
    const titulo = ex('TÍTULO') || ex('TITULO');
    if (!titulo) return null;
    return {
      n: i + 1, tot, titulo,
      subtitulo: ex('SUBTÍTULO') || ex('SUBTITULO'),
      cta: (ex('CALL TO ACTION') || ex('CTA')).replace(/^[-–—]+$/, '').trim(),
      visual: ex('VISUAL'),
      design: ex('OBSERVA'),
      num: String(i + 1).padStart(2, '0') + '/' + String(tot).padStart(2, '0'),
    };
  }).filter(Boolean) as SlideData[];
}
