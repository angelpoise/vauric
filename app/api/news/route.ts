import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface NewsRow {
  id: number;
  ticker: string;
  headline: string;
  summary: string | null;
  url: string;
  source: string | null;
  published_at: string;
  notification_type: string;
  created_at: string;
}

// Module-level 15-minute cache — fetches all recent articles, not just top-N,
// so every ticker has representation regardless of coverage volume.
const TTL_MS = 15 * 60 * 1000;
let cachedAll: NewsRow[] | null = null;
let cachedAt = 0;

async function fetchAll(bust = false): Promise<NewsRow[]> {
  if (!bust && cachedAll && Date.now() - cachedAt < TTL_MS) return cachedAll;

  const { data, error } = await supabase
    .from("news")
    .select("id, ticker, headline, summary, url, source, published_at, notification_type, created_at")
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error || !data) return cachedAll ?? [];

  cachedAll = data as NewsRow[];
  cachedAt  = Date.now();
  return cachedAll;
}

// Returns up to perTicker articles for each ticker, interleaved by recency.
// Prevents one heavily-covered ticker from crowding out all others.
function balanced(rows: NewsRow[], perTicker: number): NewsRow[] {
  const counts: Record<string, number> = {};
  const result: NewsRow[] = [];
  for (const r of rows) {
    counts[r.ticker] = (counts[r.ticker] ?? 0) + 1;
    if (counts[r.ticker] <= perTicker) result.push(r);
  }
  return result;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker    = searchParams.get("ticker")?.toUpperCase() ?? null;
  const type      = searchParams.get("type") ?? null;
  const limit     = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") ?? "0", 10) || (ticker ? 20 : 50)));
  const nocache   = searchParams.get("nocache") === "1";
  const notifonly = searchParams.get("notifonly") === "1";

  const rows = await fetchAll(nocache);

  // Lightweight mode for graph notification dots: return all articles uncapped
  // (just ticker/type/date) so every notification type is represented per ticker,
  // matching what stock detail pages show.
  if (notifonly) {
    return NextResponse.json(
      rows.map((r) => ({ ticker: r.ticker, notification_type: r.notification_type, published_at: r.published_at })),
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } },
    );
  }

  let filtered = rows;
  if (ticker) {
    filtered = filtered.filter((r) => r.ticker === ticker).slice(0, limit);
  } else {
    // Balance across tickers (15 per ticker) then apply the global limit.
    filtered = balanced(filtered, 15).slice(0, limit);
  }

  if (type) filtered = filtered.filter((r) => r.notification_type === type);

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
  });
}
