import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SiteFooter } from "@/components/SiteFooter";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the recovery hash and creates a session.
    // We just need to ensure we have a session before allowing update.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast({
          title: "Link inválido",
          description: "Solicite uma nova recuperação.",
          variant: "destructive",
        });
        navigate("/auth", { replace: true });
      } else {
        setReady(true);
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha atualizada!", description: "Você já pode usar sua nova senha." });
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-popover border border-border2 rounded-md p-6">
        <h2 className="font-mono text-sm tracking-[2px] uppercase text-foreground mb-4">
          Nova senha
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="Nova senha"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
          <button
            disabled={busy}
            className="bg-primary/10 border border-primary text-primary font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:bg-primary/20 transition disabled:opacity-50"
          >
            {busy ? "..." : "Atualizar Senha"}
          </button>
        </form>
      </div>
      <SiteFooter />
    </main>
  );
}
