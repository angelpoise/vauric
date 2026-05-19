import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { classifyNews } from "@/lib/newsClassifier";
import { checkRateLimit } from "@/lib/rateLimit";
import { resend } from "@/lib/resend";

// ─── Sector ETF map ────────────────────────────────────────────────────────────
const SECTOR_TO_ETF: Record<string, string> = {
  "Information Technology": "XLK", Technology: "XLK",
  Energy: "XLE",
  Healthcare: "XLV",
  Financials: "XLF", Finance: "XLF", "Financial Services": "XLF",
  "Consumer Staples": "XLP",
  "Consumer Discretionary": "XLY",
  Industrials: "XLI",
  "Communication Services": "XLC",
  Materials: "XLB",
  "Real Estate": "XLRE",
  Utilities: "XLU",
};

// ─── Polygon news ──────────────────────────────────────────────────────────────
interface PolygonArticle {
  id: string;
  title: string;
  description: string | null;
  article_url: string;
  published_utc: string;
  tickers: string[];
  publisher: { name: string };
  amp_url?: string;
}

async function fetchPolygonNews(
  from: string,
  to: string,
  apiKey: string,
): Promise<PolygonArticle[]> {
  // Fetch up to 1000 articles (Polygon max per request) within the date window.
  // Polygon's general news feed already includes ticker associations — no per-ticker
  // calls needed, which avoids rate limit issues entirely.
  const url =
    `https://api.polygon.io/v2/reference/news` +
    `?published_utc.gte=${from}&published_utc.lte=${to}` +
    `&order=desc&sort=published_utc&limit=1000&apiKey=${apiKey}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.results ?? []) as PolygonArticle[];
  } catch {
    return [];
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const pipelineSecret = process.env.PIPELINE_SECRET;
  const cronSecret     = process.env.VERCEL_CRON_SECRET;
  const customHeader   = req.headers.get("x-pipeline-secret");
  const authHeader     = req.headers.get("authorization");
  if (pipelineSecret && customHeader === pipelineSecret) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "pipeline";
  if (!checkRateLimit(`pipeline:${ip}`, 1, 60 * 1000)) {
    return NextResponse.json({ error: "Pipeline triggered too recently — wait 1 minute" }, { status: 429 });
  }

  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  // Check kill-switch
  try {
    const { data: config } = await supabase
      .from("pipeline_config").select("news_pipeline_enabled").eq("id", 1).single();
    if (config?.news_pipeline_enabled === false)
      return NextResponse.json({ message: "Pipeline disabled" });
  } catch { /* table may not exist yet */ }

  const now         = new Date();
  const cutoffMs    = now.getTime() - 48 * 60 * 60 * 1000;
  const from        = new Date(cutoffMs).toISOString();
  const to          = now.toISOString();

  // Load all graph stocks with sector info
  const { data: stockRows } = await supabase
    .from("admin_nodes")
    .select("ticker, company_name, sector")
    .eq("node_type", "stock")
    .limit(50000);

  const graphTickerSet = new Set<string>((stockRows ?? []).map((r) => r.ticker as string));
  const sectorOf = new Map<string, string>(); // ticker → sector string
  for (const row of stockRows ?? []) {
    if (row.ticker && row.sector) sectorOf.set(row.ticker as string, row.sector as string);
  }

  if (graphTickerSet.size === 0) {
    await supabase.from("pipeline_config").upsert({ id: 1, last_run_at: now.toISOString() });
    return NextResponse.json({ processed: 0, inserted: 0, skipped: 0, errors: [] });
  }

  // Fetch news from Polygon (single request, no per-ticker loops)
  const articles = await fetchPolygonNews(from, to, polygonKey);

  // Build rows to insert
  interface InsertRow {
    ticker: string; headline: string; summary: string; url: string;
    source: string; published_at: string; notification_type: string;
    generates_notification: boolean; is_sector_news: boolean; sector_id: string | null;
  }
  const candidates: InsertRow[] = [];
  const seenKeys = new Set<string>(); // url#ticker to deduplicate within this batch

  for (const article of articles) {
    if (!article.article_url) continue;
    if (new Date(article.published_utc).getTime() < cutoffMs) continue;

    // Find which graph tickers are mentioned in this article
    const graphTickers = (article.tickers ?? []).filter((t) => graphTickerSet.has(t));
    if (graphTickers.length === 0) continue;

    const headline    = article.title ?? "";
    const summary     = article.description ?? "";
    const source      = article.publisher?.name ?? "";
    const publishedAt = article.published_utc;

    // Determine the scope of this article
    const affectedSectors = new Set(
      graphTickers.map((t) => sectorOf.get(t)).filter(Boolean) as string[]
    );
    const isMacro = graphTickers.length >= 5 && affectedSectors.size >= 3;

    if (isMacro) {
      // Macro/market-wide news — insert once as MARKET ticker
      const key = `${article.article_url}#MARKET`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const cls = classifyNews(headline, summary, "MARKET");
      candidates.push({
        ticker: "MARKET", headline, summary, source,
        url: article.article_url,
        published_at: publishedAt,
        notification_type: cls.type,
        generates_notification: false,
        is_sector_news: true,
        sector_id: null,
      });
    } else {
      // Stock-specific — insert one row per relevant ticker (up to 3)
      const targetTickers = graphTickers.slice(0, 3);
      for (const ticker of targetTickers) {
        // Use url#ticker so the same article can appear for multiple stocks
        const key = `${article.article_url}#${ticker}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const cls = classifyNews(headline, summary, ticker);
        // Single-sector articles with 3+ stocks get sector classification
        const isSectorWide = affectedSectors.size === 1 && graphTickers.length >= 3;
        const etf = isSectorWide ? (SECTOR_TO_ETF[Array.from(affectedSectors)[0]] ?? null) : null;
        candidates.push({
          ticker, headline, summary, source,
          url: `${article.article_url}#${ticker}`,
          published_at: publishedAt,
          notification_type: cls.type,
          generates_notification: cls.generatesNotification && !isSectorWide,
          is_sector_news: isSectorWide,
          sector_id: etf,
        });
      }
    }
  }

  // Filter out URLs already in DB
  const allUrls = candidates.map((c) => c.url);
  const { data: existing } = await supabase.from("news").select("url").in("url", allUrls);
  const existingSet = new Set((existing ?? []).map((r: { url: string }) => r.url));
  const toInsert = candidates.filter((c) => !existingSet.has(c.url));

  const errors: string[] = [];
  let inserted = 0;

  if (toInsert.length > 0) {
    const { error } = await supabase.from("news").insert(toInsert);
    if (error) {
      errors.push(error.message);
    } else {
      inserted = toInsert.length;

      // Notifications for significant single-stock events
      const significantTickers = Array.from(new Set(
        toInsert
          .filter((a) => a.generates_notification && !a.is_sector_news && a.ticker !== "MARKET")
          .map((a) => a.ticker),
      ));
      if (significantTickers.length > 0) {
        void supabase.from("company_analysis").delete().in("ticker", significantTickers);

        const { data: trackers } = await supabase
          .from("thesis_tracking")
          .select("clerk_user_id, ticker, scenario")
          .in("ticker", significantTickers);

        if (trackers?.length) {
          const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vauric.io";
          const clerk = await clerkClient();
          for (const t of trackers as Array<{ clerk_user_id: string; ticker: string; scenario: string }>) {
            const headline = toInsert.find(
              (a) => a.ticker === t.ticker && a.generates_notification
            )?.headline ?? "";
            try {
              const clerkUser = await clerk.users.getUser(t.clerk_user_id);
              const email = clerkUser.emailAddresses[0]?.emailAddress;
              if (!email) continue;
              await resend.emails.send({
                from:    "notifications@vauric.io",
                to:      email,
                subject: `[Vauric] Thesis alert — ${t.ticker} ${t.scenario} case`,
                html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:28px"><span style="font-size:18px;font-weight:700;letter-spacing:0.12em;color:#fff">VAURIC</span></div>
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:32px">
      <p style="font-size:12px;color:#475569;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 16px">Thesis Alert</p>
      <h1 style="font-size:24px;font-weight:700;color:#f1f5f9;margin:0 0 6px">${t.ticker} — ${t.scenario.charAt(0).toUpperCase() + t.scenario.slice(1)} case</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 20px">A significant event occurred for a stock you are tracking:</p>
      <p style="font-size:14px;color:#94a3b8;background:rgba(255,255,255,0.04);border-left:3px solid #3b82f6;padding:12px 16px;border-radius:4px;margin:0 0 28px">${headline}</p>
      <a href="${APP_URL}/stock/${t.ticker}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500">View ${t.ticker} →</a>
    </div>
    <p style="font-size:11px;color:#334155;margin:20px 0 0;text-align:center">Vauric · Thesis tracking · <a href="${APP_URL}/account" style="color:#475569">Manage theses</a></p>
  </div>
</body></html>`,
              });
            } catch (err) {
              console.error(`[news/fetch] thesis email failed for ${t.ticker}/${t.scenario}:`, err);
            }
          }
        }
      }
    }
  }

  await supabase.from("pipeline_config").upsert({ id: 1, last_run_at: now.toISOString() });

  return NextResponse.json({
    processed: candidates.length,
    inserted,
    skipped: candidates.length - toInsert.length,
    articlesFromPolygon: articles.length,
    errors,
  });
}
