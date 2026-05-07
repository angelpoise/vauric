// SQL — run once in Supabase (provided in spec):
//
// create table public.thesis_tracking (
//   id            uuid        primary key default gen_random_uuid(),
//   clerk_user_id text        not null,
//   ticker        text        not null,
//   scenario      text        not null check (scenario in ('bull', 'base', 'bear')),
//   created_at    timestamptz not null default now(),
//   unique(clerk_user_id, ticker, scenario)
// );
// alter table public.thesis_tracking enable row level security;
// create policy "service role full access" on public.thesis_tracking for all to service_role using (true);

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
    .from("thesis_tracking")
    .select("id, ticker, scenario, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // No Pro gate here — scenarios themselves are Pro-gated at the UI level

  const body = await req.json() as { userId?: string; ticker?: string; scenario?: string };
  const { userId, ticker, scenario } = body;

  if (tokenUserId !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ticker || !scenario)  return NextResponse.json({ error: "ticker and scenario required" }, { status: 400 });
  if (!["bull", "base", "bear"].includes(scenario)) {
    return NextResponse.json({ error: "scenario must be bull, base, or bear" }, { status: 400 });
  }

  // Upsert — unique constraint on (clerk_user_id, ticker, scenario) makes this idempotent
  const { data, error } = await supabaseAdmin
    .from("thesis_tracking")
    .upsert(
      { clerk_user_id: userId, ticker: ticker.toUpperCase(), scenario },
      { onConflict: "clerk_user_id,ticker,scenario", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { userId: tokenUserId } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("thesis_tracking")
    .delete()
    .eq("id", id)
    .eq("clerk_user_id", tokenUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
