import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, Check, Sparkles, Bot, Layers, Zap, ShieldCheck } from "lucide-react";

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
    if (!loading && user) navigate("/account", { replace: true });
  }, [user, loading, navigate]);

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

  return (
    <main className="min-h-screen bg-background relative">
      <button
        onClick={toggle}
        className="absolute top-4 right-4 z-50 p-2 border border-border2 rounded-sm text-muted-foreground hover:text-primary hover:border-primary transition"
        aria-label="Trocar tema"
      >
        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="grid lg:grid-cols-2 min-h-screen">
        {/* LEFT: Sales */}
        <section className="relative overflow-hidden bg-gradient-to-br from-card via-background to-card border-b lg:border-b-0 lg:border-r border-border2 px-6 lg:px-12 py-12 lg:py-16 flex items-center">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{ backgroundImage: "radial-gradient(circle at 25% 30%, hsl(var(--primary)) 0, transparent 40%), radial-gradient(circle at 75% 70%, hsl(var(--accent)) 0, transparent 40%)" }}
          />
          <div className="relative max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 border border-primary/40 bg-primary/5 rounded-sm">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[10px] tracking-[2px] uppercase text-primary">FERRAMENTA #1 PRA INFOPRODUTORES</span>
            </div>

            <h1 className="font-logo text-4xl lg:text-6xl font-black tracking-tight text-foreground mb-4 leading-[1.05]">
              MÁQUINA DE<br />
              <span className="text-primary" style={{ textShadow: "0 0 30px hsl(var(--primary)/0.5)" }}>
                CARROSSEL
              </span>
            </h1>

            <p className="text-base lg:text-lg text-muted-foreground mb-8 leading-relaxed">
              Gere <strong className="text-foreground">carrosséis cinematográficos</strong> em 4K
              com IA Gemini Nano Banana Pro. Cole o roteiro, escolha o estilo, exporte.
              Sem Photoshop. Sem designer.
            </p>

            <div className="space-y-3 mb-8">
              {[
                { icon: Bot, label: "IA Gemini Nano Banana Pro", desc: "Modelo mais avançado pra imagens" },
                { icon: Layers, label: "4 variações por slide", desc: "Escolha a melhor sem refazer" },
                { icon: Zap, label: "Roteiro → Carrossel em 90s", desc: "Cole texto, gere tudo" },
                { icon: ShieldCheck, label: "Sua chave Google API", desc: "Sem custos extras na plataforma" },
              ].map((b) => (
                <div key={b.label} className="flex items-start gap-3 p-3 border border-border2 rounded-sm bg-card/50">
                  <b.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-mono text-xs uppercase tracking-wider text-foreground">{b.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{b.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border2 pt-6">
              <div className="font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground mb-3">A partir de</div>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-primary">R$174</span>
                <span className="text-sm text-muted-foreground">/mês · plano anual</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                ou R$203/mês no plano mensal · cancele quando quiser
              </p>
            </div>
          </div>
        </section>

        {/* RIGHT: Auth form */}
        <section className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="bg-popover border border-border2 rounded-md p-6 lg:p-8 shadow-[0_8px_40px_hsl(var(--primary)/0.08)]">
              <h2 className="font-mono text-sm tracking-[2px] uppercase text-foreground mb-1">
                {mode === "login" ? "Entrar" : mode === "signup" ? "Comece grátis" : "Recuperar senha"}
              </h2>
              <p className="text-xs text-muted-foreground mb-6">
                {mode === "login" ? "Acesse seu painel"
                  : mode === "signup" ? "Cadastro em 30 segundos · pague só ao gerar"
                  : "Enviaremos um link pro seu e-mail"}
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {mode === "signup" && (
                  <input type="text" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)}
                    className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
                )}
                <input type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
                {mode !== "forgot" && (
                  <input type="password" placeholder="Senha" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
                )}
                <button type="submit" disabled={busy}
                  className="bg-primary text-primary-foreground font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:opacity-90 transition disabled:opacity-50">
                  {busy ? "..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-2 text-xs text-center">
                {mode === "login" ? (
                  <>
                    <button onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-primary">
                      Esqueci minha senha
                    </button>
                    <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                      Não tem conta? Criar agora
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <button onClick={() => setMode("login")} className="text-primary hover:underline">
                    Já tenho conta · Entrar
                  </button>
                ) : (
                  <button onClick={() => setMode("login")} className="text-primary hover:underline">
                    ← Voltar para login
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground tracking-wider">
                <Check className="w-3 h-3 text-primary" /> Pagamento seguro Stripe
              </div>
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground tracking-wider">
                <Check className="w-3 h-3 text-primary" /> Acesso imediato após compra
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
