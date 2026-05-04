import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : null;
  const userEmail = typeof body.userEmail === "string" ? body.userEmail.trim() : null;
  const couponCode = typeof body.couponCode === "string" ? body.couponCode.trim() : undefined;

  if (!userId || !userEmail) {
    return NextResponse.json({ error: "userId and userEmail are required" }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    success_url: "https://vauric.io/graph?upgraded=true",
    cancel_url: "https://vauric.io/graph",
    customer_email: userEmail,
    ...(couponCode ? { discounts: [{ coupon: couponCode }] } : {}),
    metadata: { userId },
  });

  return NextResponse.json({ url: session.url });
}
