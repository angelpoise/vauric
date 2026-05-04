import Stripe from "stripe";

// Server-side client — only import this in server code / API routes
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Client-side Stripe.js loader — lazy singleton, safe to call from browser
let stripePromise: Promise<import("@stripe/stripe-js").Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise) {
    stripePromise = import("@stripe/stripe-js").then((m) =>
      m.loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
    );
  }
  return stripePromise;
}
