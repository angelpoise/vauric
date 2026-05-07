// SQL — run once in Supabase:
//
// create table public.stock_scenarios (
//   ticker       text        primary key,
//   bull         jsonb       not null,
//   base         jsonb       not null,
//   bear         jsonb       not null,
//   generated_at timestamptz not null default now()
// );

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateScenarios, saveScenarios } from "@/lib/generateScenarios";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // peek=1 — return cached data only, never trigger generation (used by client on mount)
  const peek = req.nextUrl.searchParams.get("peek") === "1";

  const { data: cached } = await supabaseAdmin
    .from("stock_scenarios")
    .select("bull, base, bear, generated_at")
    .eq("ticker", ticker)
    .maybeSingle();

  const ageMs   = cached ? Date.now() - new Date(cached.generated_at as string).getTime() : null;
  const isFresh = ageMs !== null && ageMs < WEEK_MS;

  console.log(
    `[scenarios] ticker=${ticker} peek=${peek}`,
    `cached=${cached ? "yes" : "no"}`,
    `generated_at=${(cached as { generated_at?: string } | null)?.generated_at ?? "n/a"}`,
    `age_days=${ageMs !== null ? (ageMs / 86_400_000).toFixed(1) : "n/a"}`,
    `fresh=${isFresh}`,
    `path=${!cached ? "no-cache" : isFresh ? "cache-hit" : "stale"}`,
  );

  if (cached && isFresh) {
    return NextResponse.json({ ...cached, ticker });
  }

  if (peek) return NextResponse.json(null);

  // Generate fresh scenarios
  const scenarios = await generateScenarios(ticker);
  if (!scenarios) return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  await saveScenarios(ticker, scenarios);
  return NextResponse.json({ ...scenarios, ticker, generated_at: new Date().toISOString() });
}

export async function DELETE(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  await supabaseAdmin.from("stock_scenarios").delete().eq("ticker", ticker);
  return NextResponse.json({ ok: true });
}
