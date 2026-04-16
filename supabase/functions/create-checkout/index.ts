import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { corsHeaders, ok } from "../_shared/cors.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) return ok({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) return ok({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const env = (body.environment || "sandbox") as StripeEnv;
    const returnUrl = body.returnUrl || "https://carrossel.brittogroup.com.br/";
    const priceId = body.priceId || "carousel_pro_monthly";

    const stripe = createStripeClient(env);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ui_mode: "embedded",
      return_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: user.email,
      subscription_data: { metadata: { userId: user.id } },
      metadata: { userId: user.id },
    });

    return ok({ clientSecret: session.client_secret });
  } catch (e) {
    console.error("checkout error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
