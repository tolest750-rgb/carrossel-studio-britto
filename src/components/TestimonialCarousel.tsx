import { useEffect, useState } from "react";
import { Quote, Star } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Mariana S.",
    role: "Social Media · Agência DRP",
    text: "Substituí 3 horas de Photoshop por 90 segundos. Meus clientes acham que contratei estúdio.",
  },
  {
    name: "Rafael C.",
    role: "Coach de vendas",
    text: "Postei 12 carrosséis em 2 dias. Meu engajamento dobrou na primeira semana.",
  },
  {
    name: "Júlia M.",
    role: "Designer freelancer",
    text: "A qualidade 4K é absurda. Cobro premium e entrego em metade do tempo.",
  },
  {
    name: "Diego R.",
    role: "Infoprodutor",
    text: "Roteiro colado, carrossel pronto. Minha esteira de conteúdo virou outra coisa.",
  },
  {
    name: "Beatriz L.",
    role: "Gestora de tráfego",
    text: "Testei 4 variações por slide e achei a winner em minutos. Game changer.",
  },
];

export function TestimonialCarousel() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % TESTIMONIALS.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const t = TESTIMONIALS[idx];

  return (
    <div className="mt-5 sm:mt-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[9px] tracking-[3px] uppercase text-primary">★ Depoimentos</span>
        <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
      </div>

      <div
        className="relative border border-border2 bg-card/40 backdrop-blur-sm rounded-sm p-3 sm:p-4 overflow-hidden min-h-[120px] sm:min-h-[110px]"
      >
        {/* Glow accent */}
        <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <Quote className="absolute top-2 right-2 w-4 h-4 text-primary/30" />

        <div key={idx} className="animate-fade-in">
          <div className="flex items-center gap-0.5 mb-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="w-2.5 h-2.5 text-primary fill-primary" />
            ))}
          </div>
          <p className="text-[11px] sm:text-xs text-foreground/90 leading-relaxed mb-2.5 italic">
            "{t.text}"
          </p>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-mono text-[9px] font-bold text-primary-foreground shrink-0">
              {t.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-wider text-foreground truncate">
                {t.name}
              </div>
              <div className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground truncate">
                {t.role}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Depoimento ${i + 1}`}
            className={`h-1 rounded-sm transition-all duration-300 ${
              i === idx
                ? "w-6 bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                : "w-1.5 bg-border2 hover:bg-primary/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
