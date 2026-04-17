import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PLAN_LOOKUP: Record<string, string> = {
  mensal: "carrossel_mensal_brl",
  anual: "carrossel_anual_brl",
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
    const targetPlan = body.planType as "mensal" | "anual";
    if (!targetPlan || !PLAN_LOOKUP[targetPlan]) {
      return ok({ error: "Invalid planType" }, 400);
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub || !sub.stripe_subscription_id) {
      return ok({ error: "Nenhuma assinatura ativa." }, 404);
    }
    if (sub.plan_type === targetPlan) {
      return ok({ error: "Você já está nesse plano." }, 400);
    }

    const currentPlan = (sub.plan_type || "mensal") as "mensal" | "anual";
    const isUpgrade = currentPlan === "mensal" && targetPlan === "anual";
    const isDowngrade = currentPlan === "anual" && targetPlan === "mensal";

    // Block downgrade if annual commitment not yet fulfilled
    if (isDowngrade && sub.committed_until && new Date(sub.committed_until) > new Date()) {
      const until = new Date(sub.committed_until).toLocaleDateString("pt-BR");
      return ok({
        error: `Compromisso anual ativo até ${until}. Não é possível fazer downgrade antes dessa data sem cancelar e pagar a multa.`,
      }, 400);
    }

    const stripe = createStripeClient(env);

    // Resolve target Stripe price
    const prices = await stripe.prices.list({ lookup_keys: [PLAN_LOOKUP[targetPlan]] });
    if (!prices.data.length) return ok({ error: "Price not found" }, 404);
    const newPrice = prices.data[0];

    // Get current subscription from Stripe to find item id
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) return ok({ error: "Subscription item not found" }, 500);

    // Upgrade (mensal → anual): immediate switch with proration + charge now
    // Downgrade (anual → mensal): switch at period end, no proration
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: newPrice.id }],
      proration_behavior: isUpgrade ? "always_invoice" : "none",
      billing_cycle_anchor: isUpgrade ? "now" : "unchanged",
      cancel_at_period_end: false,
      metadata: {
        ...(stripeSub.metadata || {}),
        userId: user.id,
        planType: targetPlan,
        ...(isUpgrade
          ? { committedUntil: new Date(Date.now() + 12 * 30 * 24 * 3600 * 1000).toISOString() }
          : { committedUntil: "" }),
      },
    });

    // Update DB to reflect new plan
    const newCommittedUntil = isUpgrade
      ? new Date(Date.now() + 12 * 30 * 24 * 3600 * 1000).toISOString()
      : null;

    await supabase
      .from("subscriptions")
      .update({
        plan_type: targetPlan,
        price_id: newPrice.id,
        product_id: typeof newPrice.product === "string" ? newPrice.product : newPrice.product?.id,
        committed_until: newCommittedUntil,
        cancel_at_period_end: false,
        canceled_at: null,
        status: updated.status,
        current_period_end: updated.current_period_end
          ? new Date(updated.current_period_end * 1000).toISOString()
          : sub.current_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    // Log + notify (best-effort)
    const effectiveAt = isUpgrade
      ? new Date().toISOString()
      : (updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null);
    try {
      await supabase.from("plan_change_log").insert({
        user_id: user.id,
        action: isUpgrade ? "upgrade" : "downgrade",
        from_plan: currentPlan,
        to_plan: targetPlan,
        environment: env,
        metadata: { effectiveAt },
      });
      const { data: prof } = await supabase
        .from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      await supabase.functions.invoke("send-plan-change-email", {
        body: {
          email: user.email,
          name: prof?.display_name || null,
          action: isUpgrade ? "upgrade" : "downgrade",
          fromPlan: currentPlan,
          toPlan: targetPlan,
          effectiveAt,
        },
      });
    } catch (e) {
      console.error("change-plan notify error", e);
    }

    return ok({
      success: true,
      mode: isUpgrade ? "upgrade_immediate" : "downgrade_at_period_end",
      newPlan: targetPlan,
      effectiveAt,
    });
  } catch (e) {
    console.error("change-plan error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
