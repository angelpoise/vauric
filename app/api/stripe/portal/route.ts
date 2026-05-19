import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { verifyClerkToken } from "@/lib/verifyClerkToken";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  // Verify caller is authenticated
  const tokenUserId = await verifyClerkToken(req.headers.get("authorization"));
  if (!tokenUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch stripeCustomerId from Clerk metadata — ignore any client-supplied value
  let stripeCustomerId: string | undefined;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(tokenUserId);
    stripeCustomerId = user.publicMetadata?.stripeCustomerId as string | undefined;
  } catch {
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  // Check if customer has an active subscription. If not, clear the stale isPro flag
  // and tell the client to go through checkout (resubscribe) instead.
  try {
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });
    if (subs.data.length === 0) {
      const client = await clerkClient();
      await client.users.updateUserMetadata(tokenUserId, {
        publicMetadata: { isPro: false, stripeCustomerId },
      });
      return NextResponse.json({ resubscribe: true }, { status: 200 });
    }
  } catch { /* proceed to portal anyway */ }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer:   stripeCustomerId,
    return_url: "https://www.vauric.io/graph",
  });

  return NextResponse.json({ url: portalSession.url });
}
