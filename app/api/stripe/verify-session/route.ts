import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { verifyClerkToken } from "@/lib/verifyClerkToken";
import { clerkClient } from "@clerk/nextjs/server";

// Called from the success redirect (?upgraded=true) to grant pro status
// without relying on the webhook. Acts as a belt-and-suspenders fallback.
export async function POST(req: NextRequest) {
  const tokenUserId = await verifyClerkToken(req.headers.get("authorization"));
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await req.json().catch(() => ({}));
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid" || session.metadata?.userId !== tokenUserId) {
    return NextResponse.json({ error: "Session not valid for this user" }, { status: 403 });
  }

  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(tokenUserId, {
    publicMetadata: {
      isPro: true,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    },
  });

  if (session.customer) {
    await stripe.customers.update(session.customer as string, { metadata: { userId: tokenUserId } });
  }

  return NextResponse.json({ ok: true });
}
