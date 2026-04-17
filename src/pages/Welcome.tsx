import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { Sparkles, User, Phone } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";

const schema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(80, "Máximo 80 caracteres"),
  phone: z
    .string()
    .trim()
    .min(8, "Telefone inválido")
    .max(20, "Telefone muito longo")
    .regex(/^[0-9+()\-\s]+$/, "Use apenas números e + ( ) -"),
});

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      // If both already filled, skip onboarding
      if (data?.display_name && data?.phone) {
        navigate("/account", { replace: true });
        return;
      }
      // Pre-fill what we have (e.g. Google display_name)
      setName(data?.display_name ?? (user.user_metadata as any)?.full_name ?? "");
      setPhone(data?.phone ?? "");
      setChecking(false);
    })();
  }, [user, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ display_name: name, phone });
    if (!parsed.success) {
      toast({
        title: "Verifique os campos",
        description: parsed.error.issues[0].message,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: parsed.data.display_name,
          phone: parsed.data.phone,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Tudo certo!", description: "Bem-vindo ao Britto Studio." });
      navigate("/account", { replace: true });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message ?? "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-xs text-muted-foreground tracking-[2px] animate-pulse">
          PREPARANDO BOAS-VINDAS...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Background accents */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 80%)",
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-25 blur-[120px] bg-primary pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="font-logo text-xl font-black tracking-[3px] text-foreground">BRITTO</span>
            <span
              className="text-primary text-lg"
              style={{ textShadow: "0 0 10px hsl(var(--primary))" }}
            >
              ★
            </span>
            <span className="font-logo text-xl font-black tracking-[3px] text-foreground">STUDIO</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-primary/40 bg-primary/5 rounded-sm">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="font-mono text-[10px] tracking-[3px] uppercase text-primary">
              Boas-vindas · Onboarding
            </span>
          </div>
        </div>

        <div className="bg-popover/80 backdrop-blur-sm border border-border2 rounded-md p-6 shadow-[0_8px_60px_hsl(var(--primary)/0.15)] relative">
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/3 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

          <h1 className="font-logo text-2xl font-black text-foreground mb-1 leading-tight">
            Quase lá!
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            Pra liberar seu acesso, conta pra gente como te chamar e um telefone de contato.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground">
                Como te chamar
              </span>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-card border border-border2 rounded-sm pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground">
                Telefone (com DDD)
              </span>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  required
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-0000"
                  className="w-full bg-card border border-border2 rounded-sm pl-9 pr-3 py-2.5 text-sm text-foreground outline-none focus:border-primary transition"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="bg-primary text-primary-foreground font-mono text-xs tracking-[3px] uppercase py-3 rounded-sm hover:opacity-90 transition disabled:opacity-50 mt-2 relative overflow-hidden group"
            >
              <span className="relative z-10">{busy ? "SALVANDO..." : "ENTRAR NO STUDIO"}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] font-mono tracking-wider text-muted-foreground mt-4">
          Seus dados ficam protegidos · Usados só pra suporte
        </p>
      </div>
      <div className="absolute bottom-0 left-0 right-0">
        <SiteFooter />
      </div>
    </main>
  );
}
