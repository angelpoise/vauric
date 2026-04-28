import { NextResponse } from "next/server";

const TICKERS = [
  "NVDA", "SMCI", "PLTR", "MSFT", "ARM",  "CRWD",
  "FANG", "MPC",  "SLB",  "XOM",  "HIMS", "RXRX",
  "INMD", "SOFI", "AFRM", "PYPL", "COIN", "WING",
];

interface SnapshotTicker {
  ticker: string;
  todaysChangePerc: number;
  todaysChange: number;
  day: { c: number };
  prevDay: { c: number };
}

export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
}

export async function GET() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });
  }

  const url =
    `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers` +
    `?tickers=${TICKERS.join(",")}&apiKey=${apiKey}`;

  let raw: { tickers?: SnapshotTicker[]; status?: string } | null = null;

  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) {
      console.error(`[market-data] Polygon HTTP ${res.status}`);
      return NextResponse.json({ error: `Polygon API ${res.status}` }, { status: 502 });
    }
    raw = await res.json();
    console.log("[market-data] raw snapshot:", JSON.stringify(raw, null, 2));
  } catch (err) {
    console.error("[market-data] fetch error:", err);
    return NextResponse.json({ error: "Network error" }, { status: 503 });
  }

  if (!raw?.tickers?.length) {
    console.error("[market-data] empty tickers array:", raw);
    return NextResponse.json({ error: "No snapshot data" }, { status: 503 });
  }

  const result: Record<string, MarketDataEntry> = {};
  for (const t of raw.tickers) {
    // day.c is 0 pre-market / when no trades yet; fall back to previous close
    const price = t.day?.c > 0 ? t.day.c : (t.prevDay?.c ?? 0);
    result[t.ticker] = {
      price:           Math.round(price * 100) / 100,
      dailyMove:       Math.round(t.todaysChangePerc * 100) / 100,
      dailyMoveDollar: Math.round(t.todaysChange * 100) / 100,
    };
  }

  console.log("[market-data] result:", result);
  return NextResponse.json(result);
}
