import { useEffect, useState } from "react";

/**
 * Full-screen boot splash shown on initial app load.
 * Cyberpunk neon BRITTO★ logo + scanning loader.
 */
export function BootSplash({ minDurationMs = 1400 }: { minDurationMs?: number }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const finish = () => {
      const elapsed = performance.now() - start;
      const wait = Math.max(0, minDurationMs - elapsed);
      window.setTimeout(() => {
        setFading(true);
        window.setTimeout(() => setVisible(false), 500);
      }, wait);
    };
    if (document.readyState === "complete") finish();
    else {
      window.addEventListener("load", finish, { once: true });
      // Safety net
      window.setTimeout(finish, 3500);
    }
  }, [minDurationMs]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* grid bg */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black 30%, transparent 80%)",
        }}
      />
      {/* glow orb */}
      <div className="absolute w-[480px] h-[480px] rounded-full blur-[120px] bg-primary/30 pointer-events-none animate-pulse" />

      <div className="relative flex flex-col items-center gap-6 animate-[fadeUp_0.6s_ease-out]">
        <div className="flex items-baseline gap-2">
          <span
            className="font-logo text-4xl md:text-6xl font-black tracking-[6px] text-foreground"
            style={{ textShadow: "0 0 25px hsl(var(--primary)/0.5)" }}
          >
            BRITTO
          </span>
          <span
            className="text-primary text-3xl md:text-5xl animate-[logoPulse_1.8s_ease-in-out_infinite]"
          >
            ★
          </span>
        </div>
        <div className="font-mono text-[10px] md:text-xs tracking-[6px] uppercase text-muted-foreground">
          CARROSSEL ENGINE
        </div>

        {/* loader bar */}
        <div className="w-[240px] md:w-[300px] h-[3px] bg-card border border-border2 rounded-sm overflow-hidden relative mt-2">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent animate-[loaderSweep_1.4s_ease-in-out_infinite] shadow-[0_0_12px_hsl(var(--primary))]" />
        </div>

        <div className="font-mono text-[9px] tracking-[3px] uppercase text-primary animate-pulse">
          INICIALIZANDO_SISTEMA
        </div>
      </div>

      <style>{`
        @keyframes loaderSweep {
          0% { transform: translateX(-100%) }
          100% { transform: translateX(400%) }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
