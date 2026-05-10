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
import { isAdminRequest } from "@/lib/adminSecret";
import { getUserTier } from "@/lib/getUserTier";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // peek=1 (legacy) or readonly=true — return cached data only, never generate
  const readonly = req.nextUrl.searchParams.get("readonly") === "true" ||
                   req.nextUrl.searchParams.get("peek")     === "1";

  // Access control:
  //   - Pipeline secret or admin → full access (cache reads + generation)
  //   - Pro user                 → readonly cache access only
  //   - Free / unauthenticated   → 403
  const isPipeline = req.headers.get("x-pipeline-secret") === process.env.PIPELINE_SECRET;
  if (!isPipeline) {
    const isAdmin = await isAdminRequest(req);
    if (!isAdmin) {
      const { isPro } = await getUserTier();
      if (!isPro) return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
      if (!readonly) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { data: cached, error: selectError } = await supabaseAdmin
    .from("stock_scenarios")
    .select("bull, base, bear, generated_at")
    .eq("ticker", ticker)
    .maybeSingle();

  if (selectError) {
    console.error(`[scenarios] SELECT error for ${ticker}:`, JSON.stringify(selectError));
  }
  console.log(
    `[scenarios] SELECT raw for ${ticker}:`,
    `error=${selectError ? JSON.stringify(selectError) : "none"}`,
    `data=${cached ? JSON.stringify({ bull: typeof cached.bull, base: typeof cached.base, bear: typeof cached.bear, generated_at: (cached as { generated_at?: string }).generated_at }) : "null"}`,
  );

  const ageMs   = cached ? Date.now() - new Date((cached as { generated_at: string }).generated_at).getTime() : null;
  const isFresh = ageMs !== null && ageMs < WEEK_MS;

  console.log(
    `[scenarios] ticker=${ticker} readonly=${readonly}`,
    `cached=${cached ? "yes" : "no"}`,
    `generated_at=${(cached as { generated_at?: string } | null)?.generated_at ?? "n/a"}`,
    `age_days=${ageMs !== null ? (ageMs / 86_400_000).toFixed(1) : "n/a"}`,
    `fresh=${isFresh}`,
    `path=${!cached ? "no-cache" : isFresh ? "cache-hit" : "stale"}`,
  );

  // Cache hit (fresh)
  if (cached && isFresh) {
    return NextResponse.json({ ...cached, ticker });
  }

  // No cache or stale + readonly — tell client to show "being prepared" message
  if (readonly) {
    console.log(`[scenarios] returning cached:false for ${ticker} — cached=${cached ? "row exists but stale" : "no row in DB"}`);
    return NextResponse.json({ cached: false });
  }

  // No cache or stale + not readonly — generate (admin / scheduled only)
  console.log(`[scenarios] starting generation for ${ticker}`);
  let scenarios;
  try {
    scenarios = await generateScenarios(ticker);
  } catch (err) {
    console.error(`[scenarios] generateScenarios threw for ${ticker}:`, err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
  if (!scenarios) {
    console.error(`[scenarios] generateScenarios returned null for ${ticker} — check ANTHROPIC_API_KEY and API response`);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
  console.log(`[scenarios] generation succeeded for ${ticker}, saving…`);
  await saveScenarios(ticker, scenarios);
  return NextResponse.json({ ...scenarios, ticker, generated_at: new Date().toISOString() });
}

export async function DELETE(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  try {
    const { error } = await supabaseAdmin.from("stock_scenarios").delete().eq("ticker", ticker);
    if (error) {
      console.error(`[scenarios DELETE] Supabase error for ${ticker}:`, JSON.stringify(error));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log(`[scenarios DELETE] cleared cache for ${ticker}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`[scenarios DELETE] threw for ${ticker}:`, err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
