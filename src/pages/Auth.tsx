import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, Check, Sparkles, Bot, Layers, Zap, ShieldCheck, TrendingUp } from "lucide-react";
import { TestimonialCarousel } from "@/components/TestimonialCarousel";
import { SiteFooter } from "@/components/SiteFooter";
import { lovable } from "@/integrations/lovable";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/welcome", { replace: true });
  }, [user, loading, navigate]);

  // Avoid flashing the auth screen while we already know the user is logged in
  if (!loading && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-xs text-muted-foreground tracking-[2px] animate-pulse">
          REDIRECIONANDO...
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/account`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Fire welcome email (best-effort, won't block UX)
        supabase.functions.invoke("send-welcome-email", {
          body: { email, name: name || email.split("@")[0] },
        }).catch(() => {});
        toast({ title: "Conta criada!", description: "Faça login pra escolher seu plano." });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/account", { replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada." });
        setMode("login");
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/welcome`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate("/welcome", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro no login Google", description: err.message || "Tente novamente", variant: "destructive" });
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen lg:h-screen lg:overflow-hidden bg-background relative flex flex-col">
      <button
        onClick={toggle}
        className="absolute top-3 right-3 z-50 p-1.5 border border-border2 rounded-sm text-muted-foreground hover:text-primary hover:border-primary transition bg-background/60 backdrop-blur-sm"
        aria-label="Trocar tema"
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="grid lg:grid-cols-[1.05fr_1fr] flex-1 lg:min-h-0 lg:overflow-hidden">
        {/* LEFT: Futuristic Sales — compact on mobile, full on desktop */}
        <section className="relative overflow-hidden bg-gradient-to-br from-background via-card to-background lg:border-r border-b lg:border-b-0 border-border2 flex items-center justify-center px-5 py-6 sm:p-6 lg:px-8 lg:py-6 lg:overflow-y-auto">
          {/* Animated grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%)",
            }}
          />
          {/* Glow orbs */}
          <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-30 blur-[100px] bg-primary pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full opacity-25 blur-[100px] bg-accent pointer-events-none" />
          {/* Particles */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div key={i}
                className="absolute w-1 h-1 rounded-full bg-primary"
                style={{
                  top: `${(i * 53) % 100}%`,
                  left: `${(i * 37) % 100}%`,
                  opacity: 0.15 + ((i % 5) * 0.1),
                  boxShadow: "0 0 8px hsl(var(--primary))",
                  animation: `float-${i % 3} ${5 + (i % 4)}s ease-in-out infinite`,
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>

          <div className="relative w-full max-w-xl">
            {/* Tag */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-3 border border-primary/40 bg-primary/5 rounded-sm backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-mono text-[9px] tracking-[3px] uppercase text-primary">SISTEMA ONLINE · v3.1</span>
            </div>

            {/* Headline */}
            <h1 className="font-logo font-black tracking-tight text-foreground mb-2 sm:mb-3 leading-[0.95]"
              style={{ fontSize: "clamp(1.7rem, 5.2vw, 3.4rem)" }}>
              MÁQUINA<br />
              <span className="relative inline-block text-primary"
                style={{ textShadow: "0 0 40px hsl(var(--primary)/0.6), 0 0 80px hsl(var(--primary)/0.3)" }}>
                DE CARROSSEL
                <div className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-muted-foreground mb-4 leading-relaxed max-w-lg">
              Carrosséis virais e cinematográficos em minutos. Conteúdo e <span className="text-primary font-semibold">autoridade digital</span> sem complicações.
            </p>

            {/* Floating 3D carousel mockup — desktop only (estoura no mobile) */}
            <div className="relative h-[140px] lg:h-[150px] mb-4 perspective-[1000px] hidden md:block">
              {[
                { rot: -18, x: 0, z: 0, opacity: 0.55, scale: 0.8 },
                { rot: -8, x: 70, z: 30, opacity: 0.8, scale: 0.88 },
                { rot: 0, x: 150, z: 60, opacity: 1, scale: 0.95 },
                { rot: 8, x: 230, z: 30, opacity: 0.8, scale: 0.88 },
                { rot: 18, x: 300, z: 0, opacity: 0.55, scale: 0.8 },
              ].map((card, i) => (
                <div key={i}
                  className="absolute top-1/2 left-1/2 w-[100px] h-[140px] rounded-md border border-primary/30 bg-gradient-to-br from-card to-background shadow-[0_10px_40px_hsl(var(--primary)/0.25)] overflow-hidden"
                  style={{
                    transform: `translate(-50%, -50%) translateX(${card.x - 150}px) rotateY(${card.rot}deg) translateZ(${card.z}px) scale(${card.scale})`,
                    opacity: card.opacity,
                    transformStyle: "preserve-3d",
                  }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                    <div className="font-mono text-[7px] text-primary tracking-wider">SLIDE {i + 1}/5</div>
                    <Sparkles className="w-2.5 h-2.5 text-primary" />
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="h-1.5 rounded-sm bg-primary/40 mb-1.5 w-3/4" />
                    <div className="h-1 rounded-sm bg-foreground/30 mb-1 w-full" />
                    <div className="h-1 rounded-sm bg-foreground/30 w-2/3" />
                  </div>
                  <div className="absolute inset-0 ring-1 ring-inset ring-primary/10" />
                </div>
              ))}
            </div>

            {/* Mobile mockup — single tilted card preview */}
            <div className="md:hidden flex justify-center mb-4">
              <div className="relative w-[130px] h-[170px] rounded-md border border-primary/30 bg-gradient-to-br from-card to-background shadow-[0_10px_40px_hsl(var(--primary)/0.25)] overflow-hidden -rotate-3">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                  <div className="font-mono text-[8px] text-primary tracking-wider">SLIDE 1/5</div>
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="h-2 rounded-sm bg-primary/50 mb-1.5 w-3/4" />
                  <div className="h-1 rounded-sm bg-foreground/30 mb-1 w-full" />
                  <div className="h-1 rounded-sm bg-foreground/30 w-2/3" />
                </div>
                <div className="absolute inset-0 ring-1 ring-inset ring-primary/15" />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { v: "10K+", l: "Carrosséis" },
                { v: "90s", l: "Por roteiro" },
                { v: "+200%", l: "Engajamento" },
              ].map((s) => (
                <div key={s.l} className="border border-border2 bg-card/40 backdrop-blur-sm rounded-sm p-2 text-center">
                  <div className="font-black text-base sm:text-lg text-primary leading-none"
                    style={{ textShadow: "0 0 12px hsl(var(--primary)/0.5)" }}>{s.v}</div>
                  <div className="font-mono text-[8px] sm:text-[9px] tracking-[1.5px] uppercase text-muted-foreground mt-1">{s.l}</div>
                </div>
              ))}
            </div>

            {/* Mini benefits */}
            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {[
                { icon: Sparkles, label: "Visual cinematográfico" },
                { icon: Layers, label: "4 variações por slide" },
                { icon: Zap, label: "Pronto em minutos" },
                { icon: TrendingUp, label: "Mais autoridade" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 px-2 py-1.5 border border-border2 rounded-sm bg-card/30">
                  <b.icon className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-wider text-foreground/80 truncate">{b.label}</span>
                </div>
              ))}
            </div>

            {/* Auto-rotating testimonials */}
            <TestimonialCarousel />
          </div>

          <style>{`
            @keyframes float-0 { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
            @keyframes float-1 { 0%,100% { transform: translateY(0) } 50% { transform: translateY(8px) } }
            @keyframes float-2 { 0%,100% { transform: translateX(0) } 50% { transform: translateX(10px) } }
            .perspective-\\[1000px\\] { perspective: 1000px; }
          `}</style>
        </section>

        {/* RIGHT: Auth form */}
        <section className="flex items-center justify-center p-4 sm:p-6 lg:p-10 lg:overflow-y-auto animate-fade-in-up">
          <div className="w-full max-w-sm">
            {/* Logo */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="font-logo text-xl font-black tracking-[3px] text-foreground">BRITTO</span>
                <span className="text-primary text-lg" style={{ textShadow: "0 0 10px hsl(var(--primary))" }}>★</span>
                <span className="font-logo text-xl font-black tracking-[3px] text-foreground">STUDIO</span>
              </div>
              <div className="font-mono text-[9px] tracking-[3px] uppercase text-muted-foreground">CARROSSEL ENGINE</div>
            </div>

            <div className="bg-popover/80 backdrop-blur-sm border border-border2 rounded-md p-6 shadow-[0_8px_60px_hsl(var(--primary)/0.12)] relative">
              {/* Glow border accent */}
              <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

              <h2 className="font-mono text-sm tracking-[2px] uppercase text-foreground mb-1">
                {mode === "login" ? "Acessar painel" : mode === "signup" ? "Criar acesso" : "Recuperar senha"}
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                {mode === "login" ? "Entre com sua conta"
                  : mode === "signup" ? "Cadastro em 30s · escolha o plano depois"
                  : "Enviaremos um link pro seu e-mail"}
              </p>

              {mode !== "forgot" && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2.5 bg-card border border-border2 hover:border-primary text-foreground font-mono text-xs tracking-[2px] uppercase py-2.5 rounded-sm transition disabled:opacity-50 mb-3"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                    </svg>
                    Continuar com Google
                  </button>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-border2" />
                    <span className="font-mono text-[9px] tracking-[2px] uppercase text-muted-foreground">ou e-mail</span>
                    <div className="h-px flex-1 bg-border2" />
                  </div>
                </>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {mode === "signup" && (
                  <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)}
                    className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition" />
                )}
                <input type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition" />
                {mode !== "forgot" && (
                  <input type="password" placeholder="Senha" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition" />
                )}
                <button type="submit" disabled={busy}
                  className="bg-primary text-primary-foreground font-mono text-xs tracking-[3px] uppercase py-3 rounded-sm hover:opacity-90 transition disabled:opacity-50 mt-1 relative overflow-hidden group">
                  <span className="relative z-10">{busy ? "..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                </button>
              </form>

              <div className="mt-5 flex flex-col gap-2 text-xs text-center">
                {mode === "login" ? (
                  <>
                    <button type="button" onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-primary transition">
                      Esqueci minha senha
                    </button>
                    <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                      Não tem conta? Criar agora
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    Já tenho conta · Entrar
                  </button>
                ) : (
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                    ← Voltar para login
                  </button>
                )}
              </div>
            </div>

            {/* Trust badges */}
            <div className="mt-5 flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground tracking-wider">
                <Check className="w-3 h-3 text-primary" /> Pagamento seguro
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground tracking-wider">
                <Check className="w-3 h-3 text-primary" /> Acesso imediato
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground tracking-wider">
                <ShieldCheck className="w-3 h-3 text-primary" /> Cancele quando quiser
              </div>
            </div>
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
