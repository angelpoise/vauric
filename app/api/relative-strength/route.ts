import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RSEntry {
  ticker: string;
  etf: string;
  vs1w: number | null;
  vs1m: number | null;
  vs3m: number | null;
  score: number;
  trend: "outperforming" | "inline" | "underperforming";
}

interface DayBar { t: number; c: number; }

// ─── Per-ticker cache (1 hour) ────────────────────────────────────────────────
// Each ticker is cached independently so a StockDetail visit only ever
// triggers 2 Polygon calls (stock + ETF), never a full 24-call batch.

const tickerCache: Record<string, { data: RSEntry; ts: number }> = {};
const CACHE_TTL = 60 * 60 * 1000;

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTOR_ETF: Record<string, string> = {
  Technology: "XLK",
  Energy:     "XLE",
  Healthcare: "XLV",
  Finance:    "XLF",
  Consumer:   "XLY",
};

const W1 = 7  * 86_400_000;
const M1 = 30 * 86_400_000;
const M3 = 91 * 86_400_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: Date): string { return d.toISOString().split("T")[0]; }

async function fetchBars(ticker: string, from: string, to: string, apiKey: string): Promise<DayBar[] | null> {
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}` +
      `?adjusted=true&sort=asc&limit=150&apiKey=${apiKey}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;
    const json = await res.json() as { results?: DayBar[] };
    return json.results?.length ? json.results : null;
  } catch { return null; }
}

function priceAt(bars: DayBar[], cutoffMs: number): number | null {
  let result: DayBar | null = null;
  for (const b of bars) {
    if (b.t <= cutoffMs) result = b;
    else break;
  }
  return result?.c ?? null;
}

function computeReturn(bars: DayBar[], msAgo: number): number | null {
  if (bars.length < 2) return null;
  const startP = priceAt(bars, Date.now() - msAgo);
  const endP   = bars[bars.length - 1].c;
  if (!startP || startP === 0) return null;
  return ((endP - startP) / startP) * 100;
}

function computeVs(stockBars: DayBar[], etfBars: DayBar[], msAgo: number): number | null {
  const s = computeReturn(stockBars, msAgo);
  const e = computeReturn(etfBars,   msAgo);
  return s != null && e != null ? s - e : null;
}

// ─── Route ────────────────────────────────────────────────────────────────────
// Only handles ?ticker=X — fetches 2 bars series (stock + ETF) sequentially
// to stay well within Polygon's free-tier rate limit.

export async function GET(req: NextRequest) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  const tickerParam = req.nextUrl.searchParams.get("ticker");
  if (!tickerParam) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const upper = tickerParam.toUpperCase();

  // Return cached entry if still warm
  const cached = tickerCache[upper];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Look up this stock's sector
  const { data: row } = await supabaseAdmin
    .from("admin_nodes")
    .select("sector")
    .eq("ticker", upper)
    .eq("node_type", "stock")
    .maybeSingle();

  // For stocks: compare vs their sector ETF.
  // For non-stocks (ETFs, hierarchy identifiers): compare vs SPY directly.
  const etf = row?.sector ? SECTOR_ETF[row.sector] : (upper !== "SPY" ? "SPY" : null);
  if (!etf) return NextResponse.json(null);

  // Fetch bars for just this stock then its ETF — sequential, not parallel,
  // so two rapid requests don't both race to Polygon at the same time.
  const from = fmt(new Date(Date.now() - 100 * 86_400_000));
  const to   = fmt(new Date());

  const stockBars = await fetchBars(upper, from, to, apiKey);
  const etfBars   = await fetchBars(etf,   from, to, apiKey);

  if (!stockBars || !etfBars) return NextResponse.json(null);

  const vs1w = computeVs(stockBars, etfBars, W1);
  const vs1m = computeVs(stockBars, etfBars, M1);
  const vs3m = computeVs(stockBars, etfBars, M3);

  const score = Math.max(0, Math.min(100, 50 + (vs1m ?? 0) * 5));
  const trend: RSEntry["trend"] =
    score >= 60 ? "outperforming" :
    score <= 40 ? "underperforming" :
    "inline";

  const entry: RSEntry = { ticker: upper, etf, vs1w, vs1m, vs3m, score, trend };
  tickerCache[upper] = { data: entry, ts: Date.now() };

  return NextResponse.json(entry);
}
