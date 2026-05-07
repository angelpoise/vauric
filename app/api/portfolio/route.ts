// SQL — run once in Supabase:
//
// create table public.portfolio_holdings (
//   id            uuid        primary key default gen_random_uuid(),
//   clerk_user_id text        not null,
//   ticker        text        not null,
//   shares        numeric     not null,
//   purchase_price numeric    not null,
//   purchase_date date,
//   created_at    timestamptz not null default now()
// );
// alter table public.portfolio_holdings enable row level security;
// create policy "service role full access" on public.portfolio_holdings
//   for all to service_role using (true);

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

const MAX_HOLDINGS = 50;

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId || tokenUserId !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("portfolio_holdings")
    .select("id, ticker, shares, purchase_price, purchase_date, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { isPro, userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPro)       return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });

  const body = await req.json() as {
    userId?: string; ticker?: string; shares?: number;
    purchasePrice?: number; purchaseDate?: string;
  };
  const { userId, ticker, shares, purchasePrice, purchaseDate } = body;

  if (tokenUserId !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ticker || shares == null || purchasePrice == null) {
    return NextResponse.json({ error: "ticker, shares, and purchasePrice required" }, { status: 400 });
  }
  if (shares <= 0 || purchasePrice <= 0) {
    return NextResponse.json({ error: "shares and purchasePrice must be positive" }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("portfolio_holdings")
    .select("*", { count: "exact", head: true })
    .eq("clerk_user_id", userId);

  if ((count ?? 0) >= MAX_HOLDINGS) {
    return NextResponse.json({ error: `Maximum ${MAX_HOLDINGS} holdings reached` }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("portfolio_holdings")
    .insert({
      clerk_user_id:  userId,
      ticker:         ticker.toUpperCase(),
      shares,
      purchase_price: purchasePrice,
      ...(purchaseDate ? { purchase_date: purchaseDate } : {}),
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
    .from("portfolio_holdings")
    .delete()
    .eq("id", id)
    .eq("clerk_user_id", tokenUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
