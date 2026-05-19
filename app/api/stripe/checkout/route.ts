import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { verifyClerkToken } from "@/lib/verifyClerkToken";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // Rate limit: 5 checkout attempts per IP per minute
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`checkout:${ip}`, 5, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify caller is authenticated
  const tokenUserId = await verifyClerkToken(req.headers.get("authorization"));
  if (!tokenUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId    = typeof body.userId    === "string" ? body.userId.trim()    : null;
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : null;
  const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : undefined;

  if (!userId || !userEmail) {
    return NextResponse.json({ error: "userId and userEmail are required" }, { status: 400 });
  }

  if (tokenUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Reuse existing Stripe customer if the user has one — prevents duplicate customers
  // when re-subscribing after cancellation.
  let existingCustomerId: string | undefined;
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    existingCustomerId = user.publicMetadata?.stripeCustomerId as string | undefined;
  } catch { /* proceed without existing customer */ }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: "https://vauric.io/graph?upgraded=true",
    cancel_url:  "https://vauric.io/graph",
    ...(existingCustomerId
      ? { customer: existingCustomerId }
      : { customer_email: userEmail }),
    ...(couponCode ? { discounts: [{ coupon: couponCode }] } : {}),
    metadata: { userId },
  });

  return NextResponse.json({ url: session.url });
}
