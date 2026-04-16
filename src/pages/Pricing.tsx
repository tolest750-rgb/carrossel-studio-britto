import { useEffect, useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "@/hooks/use-toast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

export default function Pricing() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { active } = useSubscription();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (active) navigate("/", { replace: true });
  }, [active, navigate]);

  const startCheckout = useCallback(async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          environment: "sandbox",
          priceId: "carousel_pro_monthly",
          returnUrl: window.location.origin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }, []);

  if (authLoading || !user) return null;

  return (
    <main className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-logo text-3xl font-black tracking-[3px] text-primary mb-2">
            BRITTO<span className="text-accent">★</span> CAROUSEL STUDIO
          </h1>
          <p className="text-sm text-muted-foreground">
            Acesso ilimitado · Use sua própria chave Google API
          </p>
        </div>

        {!clientSecret ? (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-popover border border-primary/30 rounded-md p-8 relative overflow-hidden">
              <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] font-mono tracking-[1px] px-2 py-0.5 rounded-sm">
                OFERTA
              </div>
              <h2 className="font-mono text-xs tracking-[2px] uppercase text-muted-foreground mb-2">
                Plano Pro
              </h2>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-5xl font-black text-foreground">R$150</span>
                <span className="text-sm text-muted-foreground">/mês</span>
              </div>
              <ul className="text-sm text-foreground space-y-2 mb-6">
                <li>✓ Carrosséis ilimitados</li>
                <li>✓ Use sua chave Google API (sem custos extras na plataforma)</li>
                <li>✓ Acesso a todos os modelos Nano Banana Pro</li>
                <li>✓ Histórico por projeto</li>
                <li>✓ Cancele quando quiser</li>
              </ul>
              <button
                onClick={startCheckout}
                disabled={busy}
                className="w-full bg-primary text-primary-foreground font-mono text-xs tracking-[2px] uppercase py-3.5 rounded-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {busy ? "Carregando..." : "Assinar Agora"}
              </button>
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Apenas cartão de crédito · Cobrança recorrente mensal
              </p>
            </div>

            <div className="bg-card/30 border border-border2 rounded-md p-8">
              <h3 className="font-mono text-xs tracking-[2px] uppercase text-muted-foreground mb-3">
                Como funciona
              </h3>
              <ol className="text-sm text-foreground space-y-3 list-decimal list-inside">
                <li>Assine o plano (R$150/mês)</li>
                <li>Cadastre sua chave Google API gratuita</li>
                <li>Gere quantos carrosséis quiser</li>
              </ol>
              <div className="mt-6 pt-6 border-t border-border2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sua chave Google API é armazenada de forma criptografada e
                  usada apenas para gerar suas imagens. Obtenha uma chave
                  gratuita no{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Google AI Studio
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-popover border border-border2 rounded-md p-2 max-w-2xl mx-auto">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </div>
    </main>
  );
}
