import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

const MAX_ALERTS = 20;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId || tokenUserId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("price_alerts")
    .select("id, ticker, target_price, direction, created_at")
    .eq("clerk_user_id", userId)
    .eq("triggered", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { isPro, userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPro)       return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });

  const body = await req.json();
  const { userId, ticker, targetPrice, direction } = body as {
    userId: string; ticker: string; targetPrice: number; direction: string;
  };

  if (tokenUserId !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ticker || targetPrice == null || !direction) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!["above", "below"].includes(direction)) {
    return NextResponse.json({ error: "direction must be 'above' or 'below'" }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("price_alerts")
    .select("*", { count: "exact", head: true })
    .eq("clerk_user_id", userId)
    .eq("triggered", false);

  if ((count ?? 0) >= MAX_ALERTS) {
    return NextResponse.json({ error: `Maximum ${MAX_ALERTS} alerts reached` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("price_alerts")
    .insert({
      clerk_user_id: userId,
      ticker:        ticker.toUpperCase(),
      target_price:  targetPrice,
      direction,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("price_alerts")
    .delete()
    .eq("id", id)
    .eq("clerk_user_id", tokenUserId); // ensures ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
