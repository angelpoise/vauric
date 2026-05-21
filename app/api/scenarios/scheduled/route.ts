// Vercel cron: "0 22 * * 0" — Sunday 10pm UTC (weekly)
// Add to vercel.json crons array to activate.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateScenarios, saveScenarios } from "@/lib/generateScenarios";

const DAY_MS = 24 * 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIPELINE_SECRET;
  return !!secret && req.headers.get("x-pipeline-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: stocks, error: stocksErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, scenario_schedule")
    .eq("node_type", "stock")
    .eq("scenario_schedule", "weekly");

  if (stocksErr || !stocks) {
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }

  const tickers = stocks.map((s: { ticker: string }) => s.ticker);

  const { data: existing } = await supabaseAdmin
    .from("stock_scenarios")
    .select("ticker, generated_at")
    .in("ticker", tickers);

  const cacheAge = new Map<string, number>();
  for (const row of existing ?? []) {
    cacheAge.set(row.ticker as string, Date.now() - new Date(row.generated_at as string).getTime());
  }

  let generated = 0;
  let skipped   = 0;

  for (const stock of stocks as Array<{ ticker: string }>) {
    const age  = cacheAge.get(stock.ticker) ?? Infinity;
    const isDue = age > 6 * DAY_MS;

    if (!isDue) { skipped++; continue; }

    try {
      const scenarios = await generateScenarios(stock.ticker);
      if (scenarios) {
        await saveScenarios(stock.ticker, scenarios);
        generated++;
      }
    } catch (err) {
      console.error(`[scenarios/scheduled] failed for ${stock.ticker}:`, err);
    }
  }

  console.log(`[scenarios/scheduled] generated=${generated} skipped=${skipped}`);
  return NextResponse.json({ generated, skipped, total: stocks.length });
}
