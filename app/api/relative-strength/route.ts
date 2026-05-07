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

// ─── Server cache (1 hour) ────────────────────────────────────────────────────

let cache: { data: Record<string, RSEntry>; ts: number } | null = null;
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

// Return the closing price of the last bar whose timestamp is at or before `cutoffMs`.
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

// ─── Core computation ─────────────────────────────────────────────────────────

async function buildCache(apiKey: string): Promise<Record<string, RSEntry>> {
  const { data: stocks } = await supabaseAdmin
    .from("admin_stocks")
    .select("ticker, sector");

  if (!stocks?.length) return {};

  // Collect unique ETFs needed
  const etfSet = new Set(
    stocks.map((s: { ticker: string; sector: string }) => SECTOR_ETF[s.sector]).filter(Boolean)
  );
  const allTickers = Array.from(
    new Set([
      ...stocks.map((s: { ticker: string; sector: string }) => s.ticker),
      ...Array.from(etfSet),
    ])
  );

  // Fetch ~3 months of bars for every ticker in parallel
  const from = fmt(new Date(Date.now() - 100 * 86_400_000)); // a bit extra for weekends
  const to   = fmt(new Date());

  const barResults = await Promise.allSettled(
    allTickers.map(async (ticker) => ({
      ticker,
      bars: await fetchBars(ticker as string, from, to, apiKey),
    }))
  );

  const barMap: Record<string, DayBar[]> = {};
  for (const r of barResults) {
    if (r.status === "fulfilled" && r.value.bars) {
      barMap[r.value.ticker] = r.value.bars;
    }
  }

  const result: Record<string, RSEntry> = {};

  for (const { ticker, sector } of stocks as Array<{ ticker: string; sector: string }>) {
    const etf = SECTOR_ETF[sector];
    if (!etf) continue;

    const sb = barMap[ticker];
    const eb = barMap[etf];
    if (!sb || !eb) continue;

    const vs1w = (() => {
      const s = computeReturn(sb, W1), e = computeReturn(eb, W1);
      return s != null && e != null ? s - e : null;
    })();
    const vs1m = (() => {
      const s = computeReturn(sb, M1), e = computeReturn(eb, M1);
      return s != null && e != null ? s - e : null;
    })();
    const vs3m = (() => {
      const s = computeReturn(sb, M3), e = computeReturn(eb, M3);
      return s != null && e != null ? s - e : null;
    })();

    const score = Math.max(0, Math.min(100, 50 + (vs1m ?? 0) * 5));
    const trend: RSEntry["trend"] =
      score >= 60 ? "outperforming" :
      score <= 40 ? "underperforming" :
      "inline";

    result[ticker] = { ticker, etf, vs1w, vs1m, vs3m, score, trend };
  }

  return result;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  if (!cache || Date.now() - cache.ts > CACHE_TTL) {
    cache = { data: await buildCache(apiKey), ts: Date.now() };
  }

  const tickerParam = req.nextUrl.searchParams.get("ticker");
  if (tickerParam) {
    return NextResponse.json(cache.data[tickerParam.toUpperCase()] ?? null);
  }

  return NextResponse.json(cache.data);
}
