import { NextRequest, NextResponse } from "next/server";
import { getYahooSession, fetchEtfHoldings, type EtfHolding } from "@/lib/fundamentalsUtils";

// Module-level session cache — avoids two Yahoo round-trips on every request.
// Sessions typically last 30 min; we refresh every 20 min to stay well inside that.
const SESSION_TTL = 20 * 60 * 1000;
let _session:   { cookie: string; crumb: string } | null = null;
let _sessionAt  = 0;

async function getSession() {
  if (_session && Date.now() - _sessionAt < SESSION_TTL) return _session;
  _session   = await getYahooSession();
  _sessionAt = Date.now();
  return _session;
}

// Per-symbol holdings cache — 1 hour TTL
const cache = new Map<string, { data: EtfHolding[]; ts: number }>();
const HOLDINGS_TTL = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.ts < HOLDINGS_TTL) {
    return NextResponse.json(hit.data);
  }

  const session = await getSession();
  if (!session) return NextResponse.json([]);

  const holdings = await fetchEtfHoldings(symbol, session);
  cache.set(symbol, { data: holdings, ts: Date.now() });

  return NextResponse.json(holdings, {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
