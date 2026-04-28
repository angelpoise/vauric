import { NextResponse } from "next/server";

const TICKERS = new Set([
  "NVDA", "SMCI", "PLTR", "MSFT", "ARM", "CRWD",
  "FANG", "MPC",  "SLB",  "XOM",  "HIMS", "RXRX",
  "INMD", "SOFI", "AFRM", "PYPL", "COIN", "WING",
]);

interface PolygonBar {
  T: string;
  o: number;
  c: number;
}

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

export async function GET() {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });
  }

  let date = prevWeekday(new Date());
  let bars: PolygonBar[] | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${fmt(date)}?adjusted=true&apiKey=${apiKey}`,
        { next: { revalidate: 900 } }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.results?.length > 0) {
          bars = json.results;
          break;
        }
      }
    } catch {
      // network error — try the previous trading day
    }
    date = prevWeekday(date);
  }

  if (!bars) {
    return NextResponse.json({ error: "No market data available" }, { status: 503 });
  }

  const result: Record<string, MarketDataEntry> = {};
  for (const bar of bars) {
    if (!TICKERS.has(bar.T)) continue;
    const dailyMoveDollar = bar.c - bar.o;
    result[bar.T] = {
      price:           Math.round(bar.c * 100) / 100,
      dailyMove:       Math.round((dailyMoveDollar / bar.o) * 10000) / 100,
      dailyMoveDollar: Math.round(dailyMoveDollar * 100) / 100,
    };
  }

  return NextResponse.json(result);
}
