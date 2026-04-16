import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PLAN_PRICES: Record<string, string> = {
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

    const body = await req.json();
    const env = (body.environment || "sandbox") as StripeEnv;
    const planType = (body.planType || "mensal") as "mensal" | "anual";
    const lookupKey = PLAN_PRICES[planType];
    if (!lookupKey) return ok({ error: "Invalid planType" }, 400);

    const returnUrl = body.returnUrl || "https://carrossel.brittogroup.com.br/account";
    const stripe = createStripeClient(env);

    // Resolve human-readable price → real Stripe price ID
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey] });
    if (!prices.data.length) return ok({ error: "Price not found in Stripe" }, 404);
    const stripePrice = prices.data[0];

    const committedMonths = planType === "anual" ? 12 : 0;
    const committedUntil = committedMonths > 0
      ? new Date(Date.now() + committedMonths * 30 * 24 * 3600 * 1000).toISOString()
      : null;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      ui_mode: "embedded",
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user.email,
      subscription_data: {
        metadata: {
          userId: user.id,
          planType,
          ...(committedUntil ? { committedUntil } : {}),
        },
      },
      metadata: { userId: user.id, planType, ...(committedUntil ? { committedUntil } : {}) },
    });

    return ok({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("checkout error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
