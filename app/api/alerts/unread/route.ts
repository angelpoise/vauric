import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId || tokenUserId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("price_alerts")
    .select("id, ticker, target_price, direction, triggered_at")
    .eq("clerk_user_id", userId)
    .eq("triggered", true)
    .eq("read", false)
    .order("triggered_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: (data ?? []).length, alerts: data ?? [] });
}
