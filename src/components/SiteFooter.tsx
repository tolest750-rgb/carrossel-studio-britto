import { Phone, ExternalLink, Instagram, MessageCircle } from "lucide-react";

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
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

          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="https://www.instagram.com/gabrielbrittoofc/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram do Britto Group"
              className="inline-flex items-center justify-center w-7 h-7 border border-border2 rounded-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://wa.me/5592986394612"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp do Britto Group"
              className="inline-flex items-center justify-center w-7 h-7 border border-border2 rounded-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </a>
            <a
              href="tel:+5592986394612"
              className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-xs tracking-[2px] text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="w-3 h-3" />
              <span>+55 92 98639-4612</span>
            </a>
          </div>
        </div>

        <div className="text-center font-mono text-[9px] sm:text-[10px] tracking-[2px] uppercase text-muted-foreground/70">
          © 2026 Britto Group · Todos os direitos reservados
        </div>
      </div>
    </footer>
  );
}
