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
}

async function fetchPolygonNews(
  from: string,
  to: string,
  apiKey: string,
  maxPages = 3,
): Promise<PolygonArticle[]> {
  const all: PolygonArticle[] = [];
  let url =
    `https://api.polygon.io/v2/reference/news` +
    `?published_utc.gte=${from}&published_utc.lte=${to}` +
    `&order=desc&sort=published_utc&limit=1000&apiKey=${apiKey}`;

  for (let page = 0; page < maxPages; page++) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) break;
      const json = await res.json();
      const results = (json.results ?? []) as PolygonArticle[];
      all.push(...results);
      if (!json.next_url || results.length < 1000) break;
      url = `${json.next_url}&apiKey=${apiKey}`;
    } catch { break; }
  }
  return all;
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
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "pipeline";
  if (!checkRateLimit(`pipeline:${ip}`, 1, 60 * 1000))
    return NextResponse.json({ error: "Pipeline triggered too recently — wait 1 minute" }, { status: 429 });

  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  try {
    const { data: config } = await supabase
      .from("pipeline_config").select("news_pipeline_enabled").eq("id", 1).single();
    if (config?.news_pipeline_enabled === false)
      return NextResponse.json({ message: "Pipeline disabled" });
  } catch { /* table may not exist yet */ }

  const now      = new Date();
  const cutoffMs = now.getTime() - 48 * 60 * 60 * 1000;
  const from     = new Date(cutoffMs).toISOString();
  const to       = now.toISOString();

  const { data: stockRows } = await supabase
    .from("admin_nodes")
    .select("ticker, company_name, sector")
    .eq("node_type", "stock")
    .limit(50000);

  const graphTickerSet = new Set<string>((stockRows ?? []).map((r) => r.ticker as string));
  const sectorOf       = new Map<string, string>();
  const companyNameOf  = new Map<string, string>();
  for (const row of stockRows ?? []) {
    if (row.ticker) {
      if (row.sector)       sectorOf.set(row.ticker as string, row.sector as string);
      if (row.company_name) companyNameOf.set(row.ticker as string, (row.company_name as string).toLowerCase());
    }
  }

  if (graphTickerSet.size === 0) {
    await supabase.from("pipeline_config").upsert({ id: 1, last_run_at: now.toISOString() });
    return NextResponse.json({ processed: 0, inserted: 0, skipped: 0, errors: [] });
  }

  const articles = await fetchPolygonNews(from, to, polygonKey);

  interface InsertRow {
    ticker: string; headline: string; summary: string; url: string;
    source: string; published_at: string; notification_type: string;
    generates_notification: boolean; is_sector_news: boolean; sector_id: string | null;
    related_tickers: string | null;
  }

  const candidates: InsertRow[] = [];
  const seenUrls = new Set<string>(); // one row per article — no #ticker suffix

  for (const article of articles) {
    if (!article.article_url || seenUrls.has(article.article_url)) continue;
    if (new Date(article.published_utc).getTime() < cutoffMs) continue;

    const graphTickers = (article.tickers ?? []).filter((t) => graphTickerSet.has(t));
    if (graphTickers.length === 0) continue;

    seenUrls.add(article.article_url);

    const headline   = article.title ?? "";
    const summary    = article.description ?? "";
    const titleLower = headline.toLowerCase();

    // If a specific ticker or its company name appears in the headline,
    // it is always stock-specific — prevents mis-classifying e.g. "Trump sells AMZN" as macro.
    const titleTicker = graphTickers.find((t) => {
      if (titleLower.includes(t.toLowerCase())) return true;
      const name = companyNameOf.get(t) ?? "";
      const firstWord = name.split(" ")[0];
      return firstWord.length > 3 && titleLower.includes(firstWord);
    });

    const affectedSectors = new Set(
      graphTickers.map((t) => sectorOf.get(t)).filter(Boolean) as string[]
    );

    // Macro: no specific company in title + very broad reach (7+ tickers, 4+ sectors)
    const isMacro      = !titleTicker && graphTickers.length >= 7 && affectedSectors.size >= 4;
    const primaryTicker = isMacro ? "MARKET" : (titleTicker ?? graphTickers[0]);

    // All other mentioned graph tickers stored for cross-stock lookup
    const otherTickers   = graphTickers.filter((t) => t !== primaryTicker);
    const relatedTickers = otherTickers.length > 0 ? otherTickers.join(",") : null;

    const isSectorWide = !isMacro && affectedSectors.size === 1 && graphTickers.length >= 3;
    const etf          = isSectorWide ? (SECTOR_TO_ETF[Array.from(affectedSectors)[0]] ?? null) : null;
    const cls          = classifyNews(headline, summary, primaryTicker);

    candidates.push({
      ticker:                  primaryTicker,
      headline,
      summary,
      source:                  article.publisher?.name ?? "",
      url:                     article.article_url,
      published_at:            article.published_utc,
      notification_type:       cls.type,
      generates_notification:  !isMacro && !isSectorWide && cls.generatesNotification,
      is_sector_news:          isMacro || isSectorWide,
      sector_id:               isMacro ? null : etf,
      related_tickers:         relatedTickers,
    });
  }

  // Filter out URLs already in DB
  const { data: existing } = await supabase
    .from("news").select("url").in("url", candidates.map((c) => c.url));
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

      const significantTickers = Array.from(new Set(
        toInsert
          .filter((a) => a.generates_notification && a.ticker !== "MARKET")
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
