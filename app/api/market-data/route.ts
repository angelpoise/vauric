import { NextResponse } from "next/server";

// Free-tier compatible endpoints (snapshot and last-trade are 403 on free tier):
//   GET /v2/aggs/grouped/locale/us/market/stocks/{date}  → 200 ✓
// Strategy: two calls (current day + previous day) so we can compute
//   dailyMove = (currentClose - prevClose) / prevClose × 100
// which is the true daily change, not the intraday-only (close - open) / open.

const TICKERS = new Set([
  "NVDA", "SMCI", "PLTR", "MSFT", "ARM",  "CRWD",
  "FANG", "MPC",  "SLB",  "XOM",  "HIMS", "RXRX",
  "INMD", "SOFI", "AFRM", "PYPL", "COIN", "WING",
]);

interface Bar { T: string; o: number; c: number; }

export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
}

function prevWeekday(date: Date): Date {
  const d = new Date(date);
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function fmt(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function fetchBars(date: Date, apiKey: string): Promise<Bar[] | null> {
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${fmt(date)}` +
      `?adjusted=true&apiKey=${apiKey}`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.results?.length > 0 ? json.results : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });
  }

  // Walk back up to 5 weekdays to find the most recent trading day with data
  let currentDate = prevWeekday(new Date());
  let currentBars: Bar[] | null = null;
  for (let i = 0; i < 5; i++) {
    currentBars = await fetchBars(currentDate, apiKey);
    if (currentBars) break;
    currentDate = prevWeekday(currentDate);
  }

  if (!currentBars) {
    return NextResponse.json({ error: "No market data available" }, { status: 503 });
  }

  // Walk back from currentDate to find the previous trading day with data
  let prevDate = prevWeekday(currentDate);
  let prevBars: Bar[] | null = null;
  for (let i = 0; i < 5; i++) {
    prevBars = await fetchBars(prevDate, apiKey);
    if (prevBars) break;
    prevDate = prevWeekday(prevDate);
  }

  console.log(
    `[market-data] current=${fmt(currentDate)} (${currentBars.length} bars),`,
    `prev=${fmt(prevDate)} (${prevBars?.length ?? 0} bars)`
  );

  // Build prev-close lookup keyed by ticker
  const prevClose: Record<string, number> = {};
  for (const b of prevBars ?? []) prevClose[b.T] = b.c;

  // Build current-day lookup keyed by ticker
  const currentByTicker: Record<string, Bar> = {};
  for (const b of currentBars) {
    if (TICKERS.has(b.T)) currentByTicker[b.T] = b;
  }

  // Log sample ticker for verification
  const sample = currentByTicker["NVDA"];
  if (sample) {
    console.log(
      `[market-data] NVDA current close=${sample.c}`,
      `prev close=${prevClose["NVDA"] ?? "n/a"}`,
      `change=${prevClose["NVDA"]
        ? (((sample.c - prevClose["NVDA"]) / prevClose["NVDA"]) * 100).toFixed(2) + "%"
        : "(intraday fallback)"}`
    );
  }

  const result: Record<string, MarketDataEntry> = {};
  for (const ticker of Array.from(TICKERS)) {
    const cur = currentByTicker[ticker];
    if (!cur) continue;

    const prev = prevClose[ticker];
    if (prev != null && prev > 0) {
      // True daily change: current close vs previous day's close
      const dollarMove = cur.c - prev;
      result[ticker] = {
        price:           Math.round(cur.c * 100) / 100,
        dailyMove:       Math.round((dollarMove / prev) * 10000) / 100,
        dailyMoveDollar: Math.round(dollarMove * 100) / 100,
      };
    } else {
      // Prev day bars unavailable — intraday only (close vs open).
      // TODO: upgrade to paid plan for snapshot endpoint to fix this fallback.
      const dollarMove = cur.c - cur.o;
      result[ticker] = {
        price:           Math.round(cur.c * 100) / 100,
        dailyMove:       Math.round((dollarMove / cur.o) * 10000) / 100,
        dailyMoveDollar: Math.round(dollarMove * 100) / 100,
      };
    }
  }

  return NextResponse.json(result);
}
