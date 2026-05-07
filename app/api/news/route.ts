import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

// Returned to free-tier users: 20 clear articles + 5 blur-buffer so the
// client gate (CLEAR_LIMIT=20) has content to blur behind the upgrade prompt.
const FREE_NEWS_LIMIT = 25;

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
  generates_notification: boolean;
  is_sector_news: boolean;
  sector_id: string | null;
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

// Maximum history window cached — matches the Pro tier window.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FORTY_EIGHT_H_MS = 48 * 60 * 60 * 1000;

async function fetchAll(bust = false): Promise<NewsRow[]> {
  if (!bust && cachedAll && Date.now() - cachedAt < TTL_MS) return cachedAll;

  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const { data, error } = await supabase
    .from("news")
    .select("id, ticker, headline, summary, url, source, published_at, notification_type, created_at, generates_notification, is_sector_news, sector_id")
    .gte("published_at", thirtyDaysAgo)
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error || !data) return cachedAll ?? [];
  cachedAll = data as NewsRow[];
  cachedAt  = Date.now();
  return cachedAll;
}

// ── Manual notifications cache (2 min) ───────────────────────────────────────

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
    id:                     -(m.id),
    ticker:                 m.ticker,
    headline:               m.note ?? "Manual notification",
    summary:                null,
    url:                    null,
    source:                 null,
    published_at:           m.created_at,
    notification_type:      m.notification_type,
    created_at:             m.created_at,
    generates_notification: true,  // manual notifications always significant
    is_sector_news:         false,
    sector_id:              null,
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
  const ticker     = searchParams.get("ticker")?.toUpperCase() ?? null;
  const type       = searchParams.get("type") ?? null;
  const limit      = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") ?? "0", 10) || (ticker ? 20 : 50)));
  const nocache    = searchParams.get("nocache") === "1";
  const notifonly  = searchParams.get("notifonly") === "1";
  const sectorNews = searchParams.get("sectorNews") === "1";

  const authHeader = req.headers.get("authorization");
  const [{ isPro }, rows, manuals] = await Promise.all([
    verifyClerkTokenWithTier(authHeader).then((r) => {
      console.log(`[news] auth header=${!!authHeader} userId=${r.userId ?? "none"} isPro=${r.isPro}`);
      return r;
    }),
    fetchAll(nocache),
    fetchManual(nocache),
  ]);

  const manualRows = manuals.map(manualToNewsRow);

  // Sector-level news for sector node notification dots.
  // Returns articles flagged is_sector_news=true from the past 24 h.
  if (sectorNews) {
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const sectorRows = rows.filter(
      (r) => r.is_sector_news && r.sector_id && new Date(r.published_at).getTime() > cutoff24h
    );
    return NextResponse.json(
      sectorRows.map((r) => ({
        sector_id:         r.sector_id,
        notification_type: r.notification_type,
        published_at:      r.published_at,
      })),
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } },
    );
  }

  // Lightweight mode for stock node notification dots.
  // Only articles that are genuinely significant single-stock events get a dot.
  // Manual notifications (always significant) are always included.
  if (notifonly) {
    const stockNotifs = [
      ...rows.filter((r) => r.generates_notification && !r.is_sector_news),
      ...manualRows,
    ];
    return NextResponse.json(
      stockNotifs.map((r) => ({
        ticker:            r.ticker,
        notification_type: r.notification_type,
        published_at:      r.published_at,
      })),
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } },
    );
  }

  // Apply date window: free tier = last 48 h, Pro = last 30 days (full cache)
  const cutoff = isPro ? null : Date.now() - FORTY_EIGHT_H_MS;
  const windowedRows = cutoff
    ? rows.filter((r) => new Date(r.published_at).getTime() > cutoff)
    : rows;

  let filtered: NewsRow[];

  if (ticker) {
    const newsForTicker   = windowedRows.filter((r) => r.ticker === ticker).slice(0, limit);
    const manualForTicker = manualRows.filter((r) => r.ticker === ticker);
    filtered = [...manualForTicker, ...newsForTicker];
  } else {
    const balancedNews = balanced(windowedRows, 15);
    // Pro users get the full balanced feed; free users are capped at FREE_NEWS_LIMIT
    filtered = [...manualRows, ...(isPro ? balancedNews : balancedNews.slice(0, FREE_NEWS_LIMIT))];
  }

  if (type) filtered = filtered.filter((r) => r.notification_type === type);

  filtered.sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );

  return NextResponse.json(filtered, {
    headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
  });
}
