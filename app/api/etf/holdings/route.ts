import { NextRequest, NextResponse } from "next/server";
import { getYahooSession, fetchEtfHoldings } from "@/lib/fundamentalsUtils";

// 1-hour in-process cache keyed by ETF symbol
const cache = new Map<string, { data: ReturnType<typeof fetchEtfHoldings> extends Promise<infer T> ? T : never; ts: number }>();
const TTL = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data);
  }

  const session = await getYahooSession();
  if (!session) return NextResponse.json([]);

  const holdings = await fetchEtfHoldings(symbol, session);
  cache.set(symbol, { data: holdings, ts: Date.now() });

  return NextResponse.json(holdings, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
