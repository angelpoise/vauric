// CRON JOB CONFIG — uncomment in vercel.json when upgrading to Vercel Pro:
//
// {
//   "crons": [
//     {
//       "path": "/api/analysis/scheduled",
//       "schedule": "0 21 * * 1-5"
//     },
//     {
//       "path": "/api/news/fetch",
//       "schedule": "0 * * * *"
//     }
//   ]
// }
//
// "0 21 * * 1-5" = 9pm UTC (4pm ET market close) on weekdays Mon–Fri.
// To activate: add the above JSON to vercel.json (root of project) and deploy.
// Vercel will then call this route automatically on the schedule.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateAnalysis, saveAnalysis } from "@/lib/generateAnalysis";

const HOUR_MS = 60 * 60 * 1000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIPELINE_SECRET;
  return !!secret && req.headers.get("x-pipeline-secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all stocks with their schedule and the latest cached analysis age
  const { data: stocks, error: stocksErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, analysis_schedule")
    .eq("node_type", "stock");

  if (stocksErr || !stocks) {
    return NextResponse.json({ error: "Failed to fetch stocks" }, { status: 500 });
  }

  const tickers = stocks.map((s: { ticker: string }) => s.ticker);

  // Fetch current cached analysis timestamps for all tickers in one query
  const { data: analyses } = await supabaseAdmin
    .from("company_analysis")
    .select("ticker, last_generated_at")
    .in("ticker", tickers);

  const analysisAge = new Map<string, number>();
  for (const a of analyses ?? []) {
    analysisAge.set(
      a.ticker as string,
      Date.now() - new Date(a.last_generated_at as string).getTime(),
    );
  }

  let checked = 0;
  let generated = 0;
  let skipped = 0;

  for (const stock of stocks as Array<{ ticker: string; analysis_schedule: string | null }>) {
    const schedule = stock.analysis_schedule ?? "on_visit";

    if (schedule === "on_visit") { skipped++; continue; }

    checked++;
    const age = analysisAge.get(stock.ticker) ?? Infinity;

    const isDue =
      (schedule === "daily"  && age > 23 * HOUR_MS) ||
      (schedule === "weekly" && age > 6 * 24 * HOUR_MS);

    if (!isDue) { skipped++; continue; }

    // Actively generate fresh content — cache is always warm after the cron runs
    try {
      const analysis = await generateAnalysis(stock.ticker);
      if (analysis) {
        await saveAnalysis(stock.ticker, analysis);
        generated++;
      }
    } catch (err) {
      console.error(`[analysis/scheduled] generation failed for ${stock.ticker}:`, err);
    }
  }

  console.log(`[analysis/scheduled] checked=${checked} generated=${generated} skipped=${skipped}`);

  return NextResponse.json({ checked, generated, skipped });
}
