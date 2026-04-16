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

    const body = await req.json().catch(() => ({}));
    const env = (body.environment || "sandbox") as StripeEnv;
    const returnUrl = body.returnUrl || "https://carrossel.brittogroup.com.br/account";

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) return ok({ error: "Sem assinatura registrada." }, 404);

    const stripe = createStripeClient(env);
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    });

    return ok({ url: portal.url });
  } catch (e) {
    console.error("portal error:", e);
    return ok({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
