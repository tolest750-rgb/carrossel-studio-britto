import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
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
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast({ title: "Conta criada!", description: "Você já pode fazer login." });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/", { replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast({ title: "E-mail enviado", description: "Verifique sua caixa de entrada." });
        setMode("login");
      }
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-logo text-2xl font-black tracking-[3px] text-primary">
            BRITTO<span className="text-accent">★</span>
          </h1>
          <p className="font-mono text-[10px] text-muted-foreground tracking-[2px] mt-1">
            CAROUSEL STUDIO
          </p>
        </Link>

        <div className="bg-popover border border-border2 rounded-md p-6 shadow-[0_8px_40px_hsl(var(--primary)/0.08)]">
          <h2 className="font-mono text-sm tracking-[2px] uppercase text-foreground mb-1">
            {mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Recuperar Senha"}
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            {mode === "login"
              ? "Acesse seu painel"
              : mode === "signup"
                ? "Comece em segundos"
                : "Enviaremos um link para seu e-mail"}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            )}
            <input
              type="email"
              placeholder="E-mail"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                placeholder="Senha"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            )}
            <button
              type="submit"
              disabled={busy}
              className="bg-primary/10 border border-primary text-primary font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:bg-primary/20 transition disabled:opacity-50"
            >
              {busy ? "..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar Conta" : "Enviar Link"}
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
            ) : (
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                ← Voltar para login
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
