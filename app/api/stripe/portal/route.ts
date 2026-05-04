import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const stripeCustomerId =
    typeof body.stripeCustomerId === "string" ? body.stripeCustomerId.trim() : null;

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "stripeCustomerId is required" }, { status: 400 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: "https://vauric.io/graph",
  });

  return NextResponse.json({ url: portalSession.url });
}
