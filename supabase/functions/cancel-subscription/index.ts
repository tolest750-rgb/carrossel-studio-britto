import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Cancellation fee policy:
// - mensal: flat 1 month fee (BRL 203,00)
// - anual: 3 months fee (BRL 174 * 3 = 522,00) if canceled before committed_until
const FEE_CENTS: Record<string, number> = {
  mensal: 20300,
  anual: 52200,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return ok({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return ok({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const env = (body.environment || "sandbox") as StripeEnv;

    // Load subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub || !sub.stripe_subscription_id || !sub.stripe_customer_id) {
      return ok({ error: "Nenhuma assinatura ativa para cancelar." }, 404);
    }
    if (sub.status === "canceled") {
      return ok({ error: "Assinatura já cancelada." }, 400);
    }

    const planType = (sub.plan_type || "mensal") as "mensal" | "anual";
    const stripe = createStripeClient(env);

    // Determine fee. For anual: only charge if cancel before committed_until.
    let feeAmount = 0;
    let feeReason = "";
    if (planType === "mensal") {
      feeAmount = FEE_CENTS.mensal;
      feeReason = "Taxa fixa de cancelamento (1 mês) — Plano Mensal";
    } else if (planType === "anual") {
      const committed = sub.committed_until ? new Date(sub.committed_until) : null;
      if (committed && committed > new Date()) {
        feeAmount = FEE_CENTS.anual;
        feeReason = "Multa de cancelamento antecipado (3 meses) — Plano Anual";
      }
    }

    let invoice: any = null;
    if (feeAmount > 0) {
      // Create one-off invoice item attached to the customer, then finalize/charge
      await stripe.invoiceItems.create({
        customer: sub.stripe_customer_id,
        amount: feeAmount,
        currency: "brl",
        description: feeReason,
      });
      invoice = await stripe.invoices.create({
        customer: sub.stripe_customer_id,
        auto_advance: true,
        collection_method: "charge_automatically",
        metadata: { userId: user.id, kind: "cancellation_fee", planType },
      });
      try {
        invoice = await stripe.invoices.finalizeInvoice(invoice.id);
        invoice = await stripe.invoices.pay(invoice.id);
      } catch (payErr) {
        console.error("invoice pay error:", payErr);
        // Continue: invoice will retry per Stripe collection rules
      }

      await supabase.from("cancellation_fees").insert({
        user_id: user.id,
        subscription_id: sub.id,
        plan_type: planType,
        amount_cents: feeAmount,
        currency: "brl",
        reason: feeReason,
        stripe_invoice_id: invoice?.id ?? null,
        status: invoice?.status === "paid" ? "paid" : "pending",
        environment: env,
      });
    }

    // Cancel at period end so user keeps access for the rest of paid period.
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
      metadata: { canceled_by_user: "true", canceled_at: new Date().toISOString() },
    });

    await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        canceled_at: new Date().toISOString(),
        status: updated.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    // Log + notify (best-effort)
    try {
      await supabase.from("plan_change_log").insert({
        user_id: user.id,
        action: "cancel",
        from_plan: planType,
        amount_cents: feeAmount > 0 ? feeAmount : null,
        currency: "brl",
        stripe_invoice_id: invoice?.id ?? null,
        environment: env,
        metadata: { feeReason, accessUntil: sub.current_period_end },
      });
      const { data: prof } = await supabase
        .from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      await supabase.functions.invoke("send-plan-change-email", {
        body: {
          email: user.email,
          name: prof?.display_name || null,
          action: "cancel",
          fromPlan: planType,
          accessUntil: sub.current_period_end,
        },
      });
    } catch (e) {
      console.error("cancel notify error", e);
    }

    return ok({
      success: true,
      feeChargedCents: feeAmount,
      feeReason,
      invoiceId: invoice?.id ?? null,
      invoiceStatus: invoice?.status ?? null,
      accessUntil: sub.current_period_end,
    });
  } catch (e) {
    console.error("cancel error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
