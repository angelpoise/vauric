import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  type FundamentalsEntry,
  FUNDAMENTALS_TTL_MS,
  fundamentalsCache,
  fundamentalsCachedAt,
  setFundamentalsCache,
  getYahooSession,
  fetchFundamentalsForTicker,
} from "@/lib/fundamentalsUtils";

// Re-export the type so existing importers (StockDetail, etc.) are unaffected.
export type { FundamentalsEntry };

export async function GET() {
  if (fundamentalsCache && Date.now() - fundamentalsCachedAt < FUNDAMENTALS_TTL_MS) {
    return NextResponse.json(fundamentalsCache);
  }

  // Fetch tickers dynamically from admin_stocks — no hardcoded list needed.
  // Newly added stocks are picked up on the next cache refresh automatically.
  const { data: stockRows } = await supabase
    .from("admin_stocks")
    .select("ticker")
    .order("ticker");

  const tickers: string[] = stockRows?.map((r: { ticker: string }) => r.ticker) ?? [];

  if (tickers.length === 0) {
    return NextResponse.json({});
  }

  const session = await getYahooSession();
  if (!session) {
    return NextResponse.json(
      { error: "Could not establish Yahoo Finance session" },
      { status: 503 },
    );
  }

  const settled = await Promise.allSettled(
    tickers.map(async (ticker) => ({
      ticker,
      entry: await fetchFundamentalsForTicker(ticker, session),
    })),
  );

  const data: Record<string, FundamentalsEntry> = {};
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.entry != null) {
      data[r.value.ticker] = r.value.entry;
    }
  }

  setFundamentalsCache(data);

  return NextResponse.json(data);
}
