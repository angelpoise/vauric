import { NextResponse } from "next/server";

// Free-tier compatible endpoints (snapshot and last-trade are 403 on free tier):
//   GET /v2/aggs/grouped/locale/us/market/stocks/{date}  → 200 ✓
// Strategy: two calls (current day + previous day) so we can compute
//   dailyMove = (currentClose - prevClose) / prevClose × 100
// which is the true daily change, not the intraday-only (close - open) / open.

interface Bar { T: string; o: number; c: number; }

export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
}

// Steps back one or more days until landing on a weekday
function prevWeekday(date: Date): Date {
  const d = new Date(date);
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

// Returns date unchanged if already a weekday; steps back to Friday if weekend
function toWeekday(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
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

  const now = new Date();
  console.log(`[market-data] server UTC now: ${now.toISOString()} (day=${now.getUTCDay()})`);

  // Start from today if it's already a weekday — do NOT subtract a day preemptively.
  // The retry loop steps back only if the API returns no results for that date
  // (e.g. today's session isn't processed yet, or it's a holiday).
  let currentDate = toWeekday(now);
  let currentBars: Bar[] | null = null;
  for (let i = 0; i < 5; i++) {
    console.log(`[market-data] trying current: ${fmt(currentDate)} (attempt ${i + 1})`);
    currentBars = await fetchBars(currentDate, apiKey);
    if (currentBars) {
      console.log(`[market-data] found ${currentBars.length} bars for ${fmt(currentDate)}`);
      break;
    }
    console.log(`[market-data] no data for ${fmt(currentDate)}, stepping back`);
    currentDate = prevWeekday(currentDate);
  }

  if (!currentBars) {
    return NextResponse.json({ error: "No market data available" }, { status: 503 });
  }

  // Previous trading day: step back once from whatever date worked above
  let prevDate = prevWeekday(currentDate);
  let prevBars: Bar[] | null = null;
  for (let i = 0; i < 5; i++) {
    console.log(`[market-data] trying prev: ${fmt(prevDate)} (attempt ${i + 1})`);
    prevBars = await fetchBars(prevDate, apiKey);
    if (prevBars) {
      console.log(`[market-data] found ${prevBars.length} bars for ${fmt(prevDate)}`);
      break;
    }
    prevDate = prevWeekday(prevDate);
  }

  console.log(
    `[market-data] selected current=${fmt(currentDate)}, prev=${fmt(prevDate)}`,
    `(prevBars: ${prevBars?.length ?? 0} bars)`
  );

  // Build prev-close lookup keyed by ticker
  const prevClose: Record<string, number> = {};
  for (const b of prevBars ?? []) prevClose[b.T] = b.c;

  // Build current-day lookup keyed by ticker — no filter, include all traded symbols
  const currentByTicker: Record<string, Bar> = {};
  for (const b of currentBars) currentByTicker[b.T] = b;

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
  for (const [ticker, cur] of Object.entries(currentByTicker)) {
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
