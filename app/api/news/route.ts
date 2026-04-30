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

// Module-level 15-minute cache
const TTL_MS = 15 * 60 * 1000;
let cachedAll: NewsRow[] | null = null;
let cachedAt = 0;

async function fetchAll(bust = false): Promise<NewsRow[]> {
  if (!bust && cachedAll && Date.now() - cachedAt < TTL_MS) return cachedAll;

  const { data, error } = await supabase
    .from("news")
    .select("id, ticker, headline, summary, url, source, published_at, notification_type, created_at")
    .order("published_at", { ascending: false })
    .limit(200);

  if (error || !data) return cachedAll ?? [];

  cachedAll = data as NewsRow[];
  cachedAt  = Date.now();
  return cachedAll;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker  = searchParams.get("ticker")?.toUpperCase() ?? null;
  const type    = searchParams.get("type") ?? null;
  const limit   = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "0", 10) || (ticker ? 20 : 50)));
  const nocache = searchParams.get("nocache") === "1";

  let rows = await fetchAll(nocache);

  if (ticker) rows = rows.filter((r) => r.ticker === ticker).slice(0, limit);
  else        rows = rows.slice(0, limit);

  if (type) rows = rows.filter((r) => r.notification_type === type);

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
  });
}
