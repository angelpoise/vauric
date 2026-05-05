import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserTier } from "@/lib/getUserTier";

const FREE_NEWS_LIMIT = 10;

interface NewsRow {
  id: number;
  ticker: string;
  headline: string;
  summary: string | null;
  url: string | null;
  source: string | null;
  published_at: string;
  notification_type: string;
  created_at: string;
}

interface ManualRow {
  id: number;
  ticker: string;
  notification_type: string;
  note: string | null;
  created_at: string;
}

// ── News cache (15 min) ───────────────────────────────────────────────────────

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

// ── Manual notifications cache (2 min — appear quickly after admin adds them) ─

const MANUAL_TTL_MS = 2 * 60 * 1000;
let cachedManual: ManualRow[] | null = null;
let cachedManualAt = 0;

async function fetchManual(bust = false): Promise<ManualRow[]> {
  if (!bust && cachedManual && Date.now() - cachedManualAt < MANUAL_TTL_MS) {
    return cachedManual;
  }

  const { data, error } = await supabaseAdmin
    .from("manual_notifications")
    .select("id, ticker, notification_type, note, created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return cachedManual ?? [];
  cachedManual    = data as ManualRow[];
  cachedManualAt  = Date.now();
  return cachedManual;
}

// Negative ID ensures no key collision with the auto-increment news table IDs.
function manualToNewsRow(m: ManualRow): NewsRow {
  return {
    id:                -(m.id),
    ticker:            m.ticker,
    headline:          m.note ?? "Manual notification",
    summary:           null,
    url:               null,
    source:            null,
    published_at:      m.created_at,
    notification_type: m.notification_type,
    created_at:        m.created_at,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function balanced(rows: NewsRow[], perTicker: number): NewsRow[] {
  const counts: Record<string, number> = {};
  const result: NewsRow[] = [];
  for (const r of rows) {
    counts[r.ticker] = (counts[r.ticker] ?? 0) + 1;
    if (counts[r.ticker] <= perTicker) result.push(r);
  }
  return result;
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker    = searchParams.get("ticker")?.toUpperCase() ?? null;
  const type      = searchParams.get("type") ?? null;
  const limit     = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") ?? "0", 10) || (ticker ? 20 : 50)));
  const nocache   = searchParams.get("nocache") === "1";
  const notifonly = searchParams.get("notifonly") === "1";

  const [{ isPro }, rows, manuals] = await Promise.all([
    getUserTier(),
    fetchAll(nocache),
    fetchManual(nocache),
  ]);

  const manualRows = manuals.map(manualToNewsRow);

  // Lightweight mode for graph notification dots — merge all sources and return
  // ticker/type/date. Manual notifications are always included.
  if (notifonly) {
    const all = [...rows, ...manualRows];
    return NextResponse.json(
      all.map((r) => ({ ticker: r.ticker, notification_type: r.notification_type, published_at: r.published_at })),
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } },
    );
  }

  let filtered: NewsRow[];

  if (ticker) {
    // Manual notifications for this ticker always shown; news articles capped at limit.
    const newsForTicker    = rows.filter((r) => r.ticker === ticker).slice(0, limit);
    const manualForTicker  = manualRows.filter((r) => r.ticker === ticker);
    filtered = [...manualForTicker, ...newsForTicker];
  } else {
    // News articles are subject to the free-tier limit; manual notifications are not.
    const effectiveLimit = !isPro ? Math.min(limit, FREE_NEWS_LIMIT) : limit;
    const balancedNews   = balanced(rows, 15).slice(0, effectiveLimit);
    filtered = [...manualRows, ...balancedNews];
  }

  if (type) filtered = filtered.filter((r) => r.notification_type === type);

  // Unified date-descending sort so manual notifications appear in chronological order.
  filtered.sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
  });
}
