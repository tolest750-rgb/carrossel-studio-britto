import { loadStripe, type Stripe } from "@stripe/stripe-js";

const clientToken = (import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined) || "";

export const stripeEnvironment: "sandbox" | "live" = clientToken.startsWith("pk_test_")
  ? "sandbox"
  : "live";

export const isStripeConfigured = !!clientToken;

let stripePromise: Promise<Stripe | null> | null = null;

/** Lazily load Stripe only when actually needed. Returns null if no token configured. */
export function getStripePromise(): Promise<Stripe | null> | null {
  if (!clientToken) return null;
  if (!stripePromise) {
    try {
      stripePromise = loadStripe(clientToken);
    } catch (e) {
      console.error("[stripe] loadStripe threw:", e);
      stripePromise = Promise.resolve(null);
    }
  }
  return stripePromise;
}
