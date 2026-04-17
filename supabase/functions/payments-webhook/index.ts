import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("[webhook]", event.type, env);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub: any = event.data.object;
        const userId = sub.metadata?.userId;
        if (!userId) {
          console.error("No userId in subscription metadata");
          break;
        }
        const item = sub.items?.data?.[0];
        const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.id || null;
        const productId = item?.price?.product || null;
        const planType = sub.metadata?.planType || null;
        const committedUntil = sub.metadata?.committedUntil || null;
        const periodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000).toISOString() : null;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString() : null;

        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            status: sub.status,
            plan_type: planType,
            product_id: productId,
            price_id: priceId,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: sub.cancel_at_period_end || false,
            committed_until: committedUntil,
            environment: env,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
        break;
      }
      case "customer.subscription.deleted": {
        const sub: any = event.data.object;
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", sub.id);
        break;
      }
      case "invoice.paid": {
        const inv: any = event.data.object;
        if (inv.metadata?.kind === "cancellation_fee") {
          await supabase.from("cancellation_fees")
            .update({ status: "paid", updated_at: new Date().toISOString() })
            .eq("stripe_invoice_id", inv.id);
        } else if (inv.subscription) {
          // Subscription invoice paid → send receipt + log
          try {
            const userId = inv.subscription_details?.metadata?.userId
              || inv.metadata?.userId
              || null;
            const planType = inv.subscription_details?.metadata?.planType
              || inv.metadata?.planType
              || null;
            let email = inv.customer_email || null;
            let name: string | null = null;
            if (userId) {
              const { data: prof } = await supabase
                .from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
              name = prof?.display_name || null;
              if (!email) {
                const { data: u } = await supabase.auth.admin.getUserById(userId);
                email = u?.user?.email || null;
              }
            }
            if (email) {
              await supabase.functions.invoke("send-purchase-receipt", {
                body: {
                  email, name, planType,
                  amountCents: inv.amount_paid,
                  currency: inv.currency,
                  invoiceUrl: inv.hosted_invoice_url,
                  invoicePdf: inv.invoice_pdf,
                  periodEnd: inv.lines?.data?.[0]?.period?.end
                    ? new Date(inv.lines.data[0].period.end * 1000).toISOString()
                    : null,
                },
              });
            }
            if (userId) {
              await supabase.from("plan_change_log").insert({
                user_id: userId,
                action: inv.billing_reason === "subscription_create" ? "signup" : "renewal",
                to_plan: planType,
                amount_cents: inv.amount_paid,
                currency: inv.currency,
                stripe_invoice_id: inv.id,
                stripe_invoice_url: inv.hosted_invoice_url,
                environment: env,
              });
            }
          } catch (e) {
            console.error("invoice.paid notify error", e);
          }
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv: any = event.data.object;
        if (inv.metadata?.kind === "cancellation_fee") {
          await supabase.from("cancellation_fees")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("stripe_invoice_id", inv.id);
        }
        console.log("Payment failed:", inv.id);
        break;
      }
      default:
        console.log("Unhandled:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
