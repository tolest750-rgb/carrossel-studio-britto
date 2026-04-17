import { Phone, ExternalLink } from "lucide-react";

/**
 * Global site footer — appears on every page.
 * Cyberpunk minimal: thin top border, mono labels, neon star accent.
 */
export function SiteFooter() {
  return (
    <footer className="relative w-full border-t border-border2 bg-background/80 backdrop-blur-sm mt-auto">
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent pointer-events-none"
        aria-hidden
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <a
          href="https://brittogroup.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-2 font-mono text-[10px] sm:text-xs tracking-[3px] uppercase text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Conheça a</span>
          <span className="font-logo font-black tracking-[2px] text-foreground group-hover:text-primary transition-colors">
            BRITTO
          </span>
          <span
            className="text-primary"
            style={{ textShadow: "0 0 8px hsl(var(--primary))" }}
          >
            ★
          </span>
          <span className="font-logo font-black tracking-[2px] text-foreground group-hover:text-primary transition-colors">
            GROUP
          </span>
          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
        </a>

        <a
          href="tel:+5592986394612"
          className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-xs tracking-[2px] text-muted-foreground hover:text-primary transition-colors"
        >
          <Phone className="w-3 h-3" />
          <span>+55 92 98639-4612</span>
        </a>
      </div>
    </footer>
  );
}
