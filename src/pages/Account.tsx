import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSubscription } from "@/hooks/use-subscription";
import { toast } from "@/hooks/use-toast";
import { Navbar } from "@/components/Navbar";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { Sparkles, ShieldAlert, KeyRound, ExternalLink, Lock, AlertTriangle, RefreshCw } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { getStripePromise, isStripeConfigured, stripeEnvironment as environment } from "@/lib/stripe";

const PLANS = [
  {
    id: "mensal",
    label: "Mensal",
    priceLabel: "R$ 203",
    sub: "/mês",
    fee: "Taxa fixa de 1 mês ao cancelar",
    description: "Renovação automática. Cancele quando quiser, sem reembolsos. Cobrança fixa de cancelamento de R$203.",
    highlight: false,
  },
  {
    id: "anual",
    label: "Anual (12x)",
    priceLabel: "R$ 174",
    sub: "/mês",
    fee: "Multa de 3 meses se cancelar antes de 12 meses",
    description: "Pago mensalmente. Compromisso de 12 meses. Renovação automática. Cancelar antecipado = R$ 522 de multa.",
    highlight: true,
  },
] as const;

export default function Account() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const { active, loading: subLoading } = useSubscription();
  const [accountDataLoaded, setAccountDataLoaded] = useState(false);

  const [subInfo, setSubInfo] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [planPick, setPlanPick] = useState<"mensal" | "anual">("anual");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"plan" | "password" | "apikey">("plan");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    if (ready && !user) navigate("/auth", { replace: true });
  }, [user, ready, navigate]);

  const reload = async () => {
    if (!user) return;
    try {
      // Pick the most recent subscription row to be resilient to multiple env rows.
      const subQ = supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      const profQ = supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      const [subRes, profRes] = await Promise.all([subQ, profQ]);
      if (subRes.error) console.error("[Account] sub query error:", subRes.error);
      if (profRes.error) console.error("[Account] profile query error:", profRes.error);
      setSubInfo(subRes.data?.[0] ?? null);
      setProfile(profRes.data ?? null);
    } catch (e) {
      console.error("[Account] reload failed:", e);
    } finally {
      setAccountDataLoaded(true);
    }
  };

  useEffect(() => {
    if (ready && user) reload();
    /* eslint-disable-next-line */
  }, [user, ready]);

  // Listen to realtime updates of subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("account-sub")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => reload())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const startCheckout = async (plan: "mensal" | "anual") => {
    if (!isStripeConfigured) {
      toast({
        title: "Pagamento indisponível",
        description: "Token do Stripe não configurado neste ambiente.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setClientSecret(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { environment, planType: plan, returnUrl: `${window.location.origin}/account` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
    } catch (e: any) {
      toast({ title: "Erro no checkout", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { environment, returnUrl: `${window.location.origin}/account` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const changePlan = async (target: "mensal" | "anual") => {
    const isUpgrade = subInfo?.plan_type === "mensal" && target === "anual";
    const isDowngrade = subInfo?.plan_type === "anual" && target === "mensal";
    const msg = isUpgrade
      ? "UPGRADE PRO ANUAL\n\nMudança IMEDIATA. Stripe cobra o valor proporcional agora (crédito do mensal já pago é descontado).\n\nNovo compromisso de 12 meses começa hoje. Cancelar antes = multa de R$ 522.\n\nConfirmar upgrade?"
      : isDowngrade
        ? "DOWNGRADE PRO MENSAL\n\nMudança no fim do período pago atual. Você continua no anual até o vencimento, e na próxima cobrança passa pra R$ 203/mês.\n\nConfirmar downgrade?"
        : "Trocar plano?";
    if (!confirm(msg)) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("change-plan", {
        body: { environment, planType: target },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: isUpgrade ? "Upgrade efetuado" : "Downgrade agendado",
        description: isUpgrade
          ? "Você está no plano ANUAL. Cobrança proporcional realizada."
          : `Vai virar MENSAL em ${data.effectiveAt ? new Date(data.effectiveAt).toLocaleDateString("pt-BR") : "fim do período"}.`,
      });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro ao trocar plano", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const cancelSub = async () => {
    const planType = subInfo?.plan_type ?? "mensal";
    const fee = planType === "mensal" ? "R$ 203,00 (1 mês)"
      : (subInfo?.committed_until && new Date(subInfo.committed_until) > new Date())
        ? "R$ 522,00 (3 meses)"
        : "sem multa (compromisso já cumprido)";
    if (!confirm(
      `CANCELAMENTO\n\nPlano: ${planType.toUpperCase()}\nTaxa: ${fee}\n\n` +
      `Política: Não há reembolso de meses pagos. Acesso continua até o fim do período pago.\n\n` +
      `Confirmar cancelamento?`
    )) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: { environment },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Assinatura cancelada",
        description: data.feeChargedCents > 0
          ? `Taxa de R$ ${(data.feeChargedCents / 100).toFixed(2)} cobrada. Acesso até ${data.accessUntil ? new Date(data.accessUntil).toLocaleDateString("pt-BR") : "fim do período"}.`
          : "Sem multa. Acesso até o fim do período pago.",
      });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro ao cancelar", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast({ title: "Senha curta", description: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setPwdBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      toast({ title: "Senha atualizada" });
      setNewPwd("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setPwdBusy(false);
    }
  };

  if (!ready || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="font-mono text-xs text-muted-foreground tracking-[2px] animate-pulse">
          CARREGANDO CONTA...
        </div>
      </div>
    );
  }

  const isLocked = active === false;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background pt-[76px] pb-12 px-3 sm:px-4 animate-fade-in">
        <div className="max-w-5xl mx-auto">
          {/* Profile header */}
          <div className="mb-6 sm:mb-8 flex items-start justify-between flex-wrap gap-3 animate-fade-in-up">
            <div className="min-w-0">
              <h1 className="font-logo text-xl sm:text-2xl lg:text-3xl font-black tracking-[2px] text-foreground">
                Minha Conta
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 break-all">{user.email}</p>
              <p className="text-[11px] font-mono text-muted-foreground tracking-wider mt-0.5">
                {profile?.display_name || "—"}
              </p>
            </div>
            <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-sm border ${
              active ? "border-primary bg-primary/10 text-primary"
                : "border-destructive bg-destructive/10 text-destructive"
            }`}>
              <div className="font-mono text-[9px] sm:text-[10px] tracking-[2px] uppercase">Status</div>
              <div className="font-mono text-[11px] sm:text-xs font-bold mt-0.5 whitespace-nowrap">
                {active ? `★ ATIVO · ${(subInfo?.plan_type || "").toUpperCase() || "PRO"}` : "★ BLOQUEADO"}
              </div>
            </div>
          </div>

          {isLocked && (
            <div className="mb-6 sm:mb-8 p-4 sm:p-5 border-2 border-destructive bg-destructive/10 rounded-sm flex items-start gap-3 animate-scale-in">
              <Lock className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <div className="font-mono text-xs sm:text-sm tracking-[2px] uppercase text-destructive">PLATAFORMA BLOQUEADA</div>
                <p className="text-xs sm:text-sm text-foreground mt-1">
                  Você ainda não comprou o acesso. Escolha um plano abaixo e cadastre seu cartão pra liberar o estúdio.
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-border2 mb-6 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            {([
              { k: "plan", label: "Plano & Pagamento" },
              { k: "password", label: "Trocar Senha" },
              { k: "apikey", label: "Google API Key" },
            ] as const).map(({ k, label }) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 sm:px-4 py-3 font-mono text-[10px] tracking-[2px] uppercase border-b-2 transition whitespace-nowrap shrink-0 ${
                  tab === k
                    ? "text-primary border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "plan" && (
            <div>
              {!clientSecret && (
                <>
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    {PLANS.map((p) => {
                      const isCurrent = active && subInfo?.plan_type === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setPlanPick(p.id as any)}
                          disabled={isCurrent}
                          className={`text-left p-6 border-2 rounded-md transition relative ${
                            isCurrent
                              ? "border-primary bg-primary/10 cursor-default"
                              : planPick === p.id
                                ? "border-primary bg-primary/5 shadow-[0_0_30px_hsl(var(--primary)/0.2)]"
                                : "border-border2 bg-card hover:border-primary/50"
                          }`}>
                          {p.highlight && !isCurrent && (
                            <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[9px] font-mono tracking-[1px] px-2 py-0.5 rounded-sm">
                              MELHOR VALOR
                            </div>
                          )}
                          {isCurrent && (
                            <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[9px] font-mono tracking-[1px] px-2 py-0.5 rounded-sm">
                              SEU PLANO
                            </div>
                          )}
                          <div className="font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground mb-2">
                            {p.label}
                          </div>
                          <div className="flex items-baseline gap-1.5 mb-3">
                            <span className="text-4xl font-black text-foreground">{p.priceLabel}</span>
                            <span className="text-xs text-muted-foreground">{p.sub}</span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed mb-3">{p.description}</p>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-warning flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
                            <span>{p.fee}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Refund policy */}
                  <div className="mb-6 p-4 border border-border2 rounded-sm bg-card/50">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                      <div className="text-[11px] text-muted-foreground leading-relaxed">
                        <strong className="text-foreground font-mono uppercase tracking-wider">POLÍTICA DE REEMBOLSO E CANCELAMENTO:</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          <li>Não há reembolso de mensalidades pagas, sob nenhuma hipótese.</li>
                          <li>Plano Mensal: cobrança de R$ 203,00 (1 mês) ao cancelar.</li>
                          <li>Plano Anual: multa de R$ 522,00 (3 meses) se cancelar antes de completar 12 meses.</li>
                          <li>Após o cancelamento, acesso continua ativo até o fim do período pago.</li>
                          <li>Renovação automática em ambos os planos.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {!active && (
                    <button
                      onClick={() => startCheckout(planPick)}
                      disabled={busy}
                      className="w-full bg-primary text-primary-foreground font-mono text-sm tracking-[3px] uppercase py-4 rounded-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      {busy ? "Carregando..." : `Assinar plano ${planPick === "anual" ? "ANUAL" : "MENSAL"}`}
                    </button>
                  )}

                  {active && (
                    <div className="space-y-3">
                      <div className="p-4 border border-border2 rounded-sm bg-card/50 space-y-2 text-sm">
                        <Row label="Plano" value={(subInfo?.plan_type || "—").toUpperCase()} />
                        <Row label="Status" value={(subInfo?.status || "—").toUpperCase()} />
                        <Row label="Próxima cobrança" value={subInfo?.current_period_end ? new Date(subInfo.current_period_end).toLocaleDateString("pt-BR") : "—"} />
                        {subInfo?.committed_until && (
                          <Row label="Compromisso até" value={new Date(subInfo.committed_until).toLocaleDateString("pt-BR")} />
                        )}
                        {subInfo?.cancel_at_period_end && (
                          <div className="text-xs text-warning font-mono uppercase tracking-wider pt-2 border-t border-border2">
                            ⚠ Cancelamento agendado pro fim do período
                          </div>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {subInfo?.plan_type === "mensal" && (
                          <button onClick={() => changePlan("anual")} disabled={busy}
                            className="border border-primary bg-primary/5 text-primary font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:bg-primary/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5" /> Upgrade pro Anual (R$ 174/mês)
                          </button>
                        )}
                        {subInfo?.plan_type === "anual" && (
                          <button onClick={() => changePlan("mensal")} disabled={busy}
                            className="border border-border2 text-foreground font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:bg-card transition disabled:opacity-50 flex items-center justify-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5" /> Downgrade pro Mensal
                          </button>
                        )}
                        <button onClick={openPortal} disabled={busy}
                          className="border border-primary text-primary font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:bg-primary/10 transition disabled:opacity-50 flex items-center justify-center gap-2">
                          <ExternalLink className="w-3.5 h-3.5" /> Atualizar cartão / Faturas
                        </button>
                        {!subInfo?.cancel_at_period_end && (
                          <button onClick={cancelSub} disabled={busy}
                            className="border border-destructive text-destructive font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:bg-destructive/10 transition disabled:opacity-50">
                            Cancelar assinatura
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {clientSecret && (
                <CheckoutBlock
                  clientSecret={clientSecret}
                  onBack={() => setClientSecret(null)}
                  onComplete={() => reload()}
                />
              )}
            </div>
          )}

          {tab === "password" && (
            <form onSubmit={changePassword} className="max-w-md p-6 border border-border2 rounded-sm bg-card/50 space-y-4">
              <div>
                <label className="block font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground mb-2">
                  Nova senha (mínimo 6 caracteres)
                </label>
                <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required minLength={6}
                  className="w-full bg-card border border-border2 rounded-sm px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary" />
              </div>
              <button type="submit" disabled={pwdBusy}
                className="w-full bg-primary text-primary-foreground font-mono text-xs tracking-[2px] uppercase py-3 rounded-sm hover:opacity-90 transition disabled:opacity-50">
                {pwdBusy ? "..." : "Atualizar senha"}
              </button>
            </form>
          )}

          {tab === "apikey" && (
            <div className="max-w-2xl p-6 border border-border2 rounded-sm bg-card/50">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="w-4 h-4 text-primary" />
                <h2 className="font-mono text-sm tracking-[2px] uppercase text-foreground">Google API Key</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                Sua chave fica criptografada e é usada apenas pra gerar suas imagens via Gemini.
                Obtenha gratuitamente no <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google AI Studio</a>.
              </p>
              <ApiKeyManager />
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function CheckoutBlock({
  clientSecret,
  onBack,
  onComplete,
}: {
  clientSecret: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const stripePromise = useMemo(() => getStripePromise(), []);

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 font-mono text-[10px] tracking-[2px] uppercase text-muted-foreground hover:text-primary"
      >
        ← Voltar
      </button>
      {!stripePromise ? (
        <div className="p-4 border border-destructive bg-destructive/10 rounded-sm text-xs text-destructive font-mono">
          Pagamento indisponível: token do Stripe não configurado.
        </div>
      ) : (
        <div className="bg-popover border border-border2 rounded-md p-2">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret, onComplete }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </div>
  );
}
