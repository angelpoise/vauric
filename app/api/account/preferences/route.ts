import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkToken } from "@/lib/verifyClerkToken";

interface Prefs {
  email_news: boolean;
  email_analyst: boolean;
  email_delisting: boolean;
  email_split: boolean;
  email_earnings: boolean;
  email_ipo: boolean;
  daily_digest: boolean;
}

const DEFAULTS: Prefs = {
  email_news: true,
  email_analyst: true,
  email_delisting: true,
  email_split: true,
  email_earnings: true,
  email_ipo: true,
  daily_digest: false,
};

export async function GET(req: NextRequest) {
  const tokenUserId = await verifyClerkToken(req.headers.get("authorization"));
  if (!tokenUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Confirm caller owns the requested preferences
  if (tokenUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabaseAdmin
    .from("user_preferences")
    .select(
      "email_news,email_analyst,email_delisting,email_split,email_earnings,email_ipo,daily_digest"
    )
    .eq("clerk_user_id", userId)
    .single();

  return NextResponse.json(data ?? DEFAULTS);
}

export async function PUT(req: NextRequest) {
  const tokenUserId = await verifyClerkToken(req.headers.get("authorization"));
  if (!tokenUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string } & Partial<Prefs>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { userId, ...prefs } = body;
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Confirm caller owns the preferences being updated
  if (tokenUserId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("user_preferences")
    .upsert(
      { clerk_user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "clerk_user_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
