import { NextRequest, NextResponse } from "next/server";

// Strategy: two grouped-bar calls (current day + previous day) for price/daily-move,
// plus per-ticker bar history for streak calculation.

const GRAPH_TICKERS = [
  "NVDA", "MSFT", "PLTR", "AMD", "ARM", "SMCI",
  "XOM",  "CVX",  "FANG", "SLB",
  "LLY",  "HIMS", "RXRX", "MRNA",
  "PYPL", "COIN", "HOOD", "AFRM", "SOFI",
];

interface Bar { T: string; o: number; c: number; }
interface DayBar { c: number; }

export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
  streak: number;
  streakDirection: "up" | "down" | "flat";
}

function prevWeekday(date: Date): Date {
  const d = new Date(date);
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function toWeekday(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  return d;
}

function fmt(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function fetchGroupedBars(date: Date, apiKey: string): Promise<Bar[] | null> {
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

async function fetchTickerHistory(
  ticker: string,
  from: string,
  to: string,
  apiKey: string,
): Promise<DayBar[] | null> {
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}` +
      `?adjusted=true&sort=asc&limit=35&apiKey=${apiKey}`,
      { next: { revalidate: 900 } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.results?.length > 0 ? json.results : null;
  } catch {
    return null;
  }
}

function calcStreak(bars: DayBar[]): { streak: number; streakDirection: "up" | "down" | "flat" } {
  if (bars.length < 2) return { streak: 0, streakDirection: "flat" };
  // bars are sorted ascending; reverse so index 0 = most recent day
  const desc = [...bars].reverse();
  const isUp   = desc[0].c > desc[1].c;
  const isDown = desc[0].c < desc[1].c;
  if (!isUp && !isDown) return { streak: 1, streakDirection: "flat" };
  const dir = isUp ? "up" : "down";
  let count = 1;
  for (let i = 1; i + 1 < desc.length; i++) {
    if (dir === "up"   && desc[i].c > desc[i + 1].c) { count++; continue; }
    if (dir === "down" && desc[i].c < desc[i + 1].c) { count++; continue; }
    break;
  }
  return { streak: count, streakDirection: dir };
}

// Two independent server caches: one for the fast no-streak path (graph nodes),
// one for the full with-streak path (stock detail page).
let serverCache:       { data: Record<string, MarketDataEntry>; ts: number } | null = null;
let serverCacheStreak: { data: Record<string, MarketDataEntry>; ts: number } | null = null;
const SERVER_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(req: NextRequest) {
  // ?includeStreak=true opts in to streak data (19 extra Polygon calls).
  // Default is false — graph coloring only needs price + daily move.
  const includeStreak = req.nextUrl.searchParams.get("includeStreak") === "true";

  const activeCache = includeStreak ? serverCacheStreak : serverCache;
  if (activeCache && Date.now() - activeCache.ts < SERVER_TTL) {
    return NextResponse.json(activeCache.data);
  }

  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });
  }

  const now = new Date();
  console.log(`[market-data] server UTC now: ${now.toISOString()} (day=${now.getUTCDay()})`);

  let currentDate = toWeekday(now);
  let currentBars: Bar[] | null = null;
  for (let i = 0; i < 5; i++) {
    console.log(`[market-data] trying current: ${fmt(currentDate)} (attempt ${i + 1})`);
    currentBars = await fetchGroupedBars(currentDate, apiKey);
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

  let prevDate = prevWeekday(currentDate);
  let prevBars: Bar[] | null = null;
  for (let i = 0; i < 5; i++) {
    console.log(`[market-data] trying prev: ${fmt(prevDate)} (attempt ${i + 1})`);
    prevBars = await fetchGroupedBars(prevDate, apiKey);
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

  const prevClose: Record<string, number> = {};
  for (const b of prevBars ?? []) prevClose[b.T] = b.c;

  const currentByTicker: Record<string, Bar> = {};
  for (const b of currentBars) currentByTicker[b.T] = b;

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

  // Streak calculation — skipped when includeStreak=false (default).
  // Fetching 30-day history for every ticker is 19 extra Polygon calls;
  // omitting them cuts cold-cache latency from ~5 s to ~1 s.
  const streakMap: Record<string, { streak: number; streakDirection: "up" | "down" | "flat" }> = {};
  if (includeStreak) {
    const historyFrom = fmt(new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000));
    const historyTo   = fmt(currentDate);
    const streakResults = await Promise.allSettled(
      GRAPH_TICKERS.map(async (ticker) => ({
        ticker,
        bars: await fetchTickerHistory(ticker, historyFrom, historyTo, apiKey),
      }))
    );
    for (const r of streakResults) {
      if (r.status === "fulfilled" && r.value.bars) {
        streakMap[r.value.ticker] = calcStreak(r.value.bars);
      }
    }
  }

  const result: Record<string, MarketDataEntry> = {};
  for (const [ticker, cur] of Object.entries(currentByTicker)) {
    const prev = prevClose[ticker];
    const { streak, streakDirection } = streakMap[ticker] ?? { streak: 0, streakDirection: "flat" as const };
    if (prev != null && prev > 0) {
      const dollarMove = cur.c - prev;
      result[ticker] = {
        price:           Math.round(cur.c * 100) / 100,
        dailyMove:       Math.round((dollarMove / prev) * 10000) / 100,
        dailyMoveDollar: Math.round(dollarMove * 100) / 100,
        streak,
        streakDirection,
      };
    } else {
      const dollarMove = cur.c - cur.o;
      result[ticker] = {
        price:           Math.round(cur.c * 100) / 100,
        dailyMove:       Math.round((dollarMove / cur.o) * 10000) / 100,
        dailyMoveDollar: Math.round(dollarMove * 100) / 100,
        streak,
        streakDirection,
      };
    }
  }

  if (includeStreak) {
    serverCacheStreak = { data: result, ts: Date.now() };
  } else {
    serverCache = { data: result, ts: Date.now() };
  }
  return NextResponse.json(result);
}
