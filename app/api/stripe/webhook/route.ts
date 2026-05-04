import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { clerkClient } from "@clerk/nextjs/server";

// App Router does not use a body parser, so req.text() gives the raw body
// needed for Stripe signature verification.

async function setClerkPro(
  userId: string,
  data: Record<string, unknown>
): Promise<void> {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { publicMetadata: data });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        await setClerkPro(userId, {
          isPro: true,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
        });

        // Tag the Stripe customer with userId so subscription events can resolve back
        if (session.customer) {
          await stripe.customers.update(session.customer as string, {
            metadata: { userId },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(
          sub.customer as string
        );
        if (customer.deleted) break;
        const userId = (customer as Stripe.Customer).metadata?.userId;
        if (!userId) break;
        await setClerkPro(userId, { isPro: sub.status === "active" });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(
          sub.customer as string
        );
        if (customer.deleted) break;
        const userId = (customer as Stripe.Customer).metadata?.userId;
        if (!userId) break;
        await setClerkPro(userId, { isPro: false });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
