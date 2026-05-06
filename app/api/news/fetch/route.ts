// CRON JOB CONFIG (add to vercel.json when upgrading to Vercel Pro):
// {
//   "crons": [{
//     "path": "/api/news/fetch",
//     "schedule": "0 * * * *"
//   }]
// }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { classifyNews } from "@/lib/newsClassifier";
import { checkRateLimit } from "@/lib/rateLimit";

// Required Supabase schema:
//
//   CREATE TABLE news (
//     id             BIGSERIAL PRIMARY KEY,
//     ticker         TEXT NOT NULL,
//     headline       TEXT NOT NULL,
//     summary        TEXT,
//     url            TEXT UNIQUE,
//     source         TEXT,
//     published_at   TIMESTAMPTZ NOT NULL,
//     notification_type TEXT NOT NULL,
//     created_at     TIMESTAMPTZ DEFAULT NOW()
//   );
//
//   CREATE TABLE pipeline_config (
//     id                   INT PRIMARY KEY DEFAULT 1,
//     news_pipeline_enabled BOOLEAN DEFAULT TRUE,
//     last_run_at          TIMESTAMPTZ
//   );

const GRAPH_TICKERS = [
  "NVDA", "MSFT", "PLTR", "AMD", "ARM", "SMCI",
  "XOM",  "CVX",  "FANG", "SLB",
  "LLY",  "HIMS", "RXRX", "MRNA",
  "PYPL", "COIN", "HOOD", "AFRM", "SOFI",
];

interface FinnhubArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number; // Unix seconds
  related: string;
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

// Returns the ratio of shared words to the larger word count of either headline.
// Used to catch near-duplicate articles with slightly different URLs.
function wordOverlapRatio(a: string, b: string): number {
  const words = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
  const wa = words(a);
  const wb = words(b);
  const shared = Array.from(wa).filter((w) => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size, 1);
}

function isAuthorized(req: NextRequest): boolean {
  const pipelineSecret  = process.env.PIPELINE_SECRET;
  const cronSecret      = process.env.VERCEL_CRON_SECRET;
  const customHeader    = req.headers.get("x-pipeline-secret");
  const authHeader      = req.headers.get("authorization");

  if (pipelineSecret && customHeader === pipelineSecret) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

async function fetchTicker(
  ticker: string,
  from: string,
  to: string,
  apiKey: string,
): Promise<FinnhubArticle[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000); // 10s per ticker
  try {
    const url =
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}` +
      `&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: pipeline is heavy — max 1 trigger per minute globally
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "pipeline";
  if (!checkRateLimit(`pipeline:${ip}`, 1, 60 * 1000)) {
    return NextResponse.json({ error: "Pipeline triggered too recently — wait 1 minute" }, { status: 429 });
  }

  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) {
    return NextResponse.json({ error: "FINNHUB_API_KEY not set" }, { status: 500 });
  }

  // Check pipeline kill-switch
  try {
    const { data: config } = await supabase
      .from("pipeline_config")
      .select("news_pipeline_enabled")
      .eq("id", 1)
      .single();

    if (config && config.news_pipeline_enabled === false) {
      return NextResponse.json({ message: "Pipeline disabled" });
    }
  } catch {
    // Table may not exist yet — proceed anyway
  }

  const now = new Date();
  const cutoffMs   = now.getTime() - 48 * 60 * 60 * 1000;
  const today      = fmt(now);
  const twoDaysAgo = fmt(new Date(cutoffMs));

  // Note: Finnhub free tier returns predominantly Yahoo Finance sourced articles.
  // This is a known free tier limitation — paid plans unlock Reuters, Bloomberg, etc.

  // Fetch tickers in batches to avoid Finnhub free-tier rate limiting.
  // Parallel bursts of all 19 tickers cause silent 429s; batches of 5 with a
  // short delay between stay well within the rate limit.
  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 700;
  const fetched: Array<PromiseFulfilledResult<{ ticker: string; articles: FinnhubArticle[] }>> = [];

  for (let i = 0; i < GRAPH_TICKERS.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    const batch = GRAPH_TICKERS.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (ticker) => ({ ticker, articles: await fetchTicker(ticker, twoDaysAgo, today, finnhubKey) })),
    );
    for (const r of results) {
      if (r.status === "fulfilled") fetched.push(r);
    }
  }

  // Flatten articles — deduplicate by URL and by headline similarity within this batch.
  // Same story sometimes appears under slightly different Yahoo Finance URLs for multiple tickers.
  interface Article { ticker: string; headline: string; summary: string; source: string; url: string; published_at: string; notification_type: string; }
  const allArticles: Article[] = [];
  const seenUrls = new Set<string>();
  // Per-ticker seen headlines — catches same story with minor headline wording differences
  const seenHeadlines = new Map<string, string[]>();

  for (const r of fetched) {
    const { ticker, articles } = r.value;
    for (const a of articles) {
      if (!a.url || seenUrls.has(a.url)) continue;
      if (a.datetime * 1000 < cutoffMs) continue;
      const headline = a.headline ?? "";
      const tickerSeen = seenHeadlines.get(ticker) ?? [];
      if (tickerSeen.some((h) => wordOverlapRatio(h, headline) > 0.8)) continue;
      seenUrls.add(a.url);
      tickerSeen.push(headline);
      seenHeadlines.set(ticker, tickerSeen);
      allArticles.push({
        ticker,
        headline,
        summary:           a.summary  ?? "",
        source:            a.source   ?? "",
        url:               a.url,
        published_at:      new Date(a.datetime * 1000).toISOString(),
        notification_type: classifyNews(headline, a.summary ?? "", ticker),
      });
    }
  }

  if (allArticles.length === 0) {
    await supabase.from("pipeline_config").upsert({ id: 1, last_run_at: now.toISOString() });
    return NextResponse.json({ processed: 0, inserted: 0, skipped: 0, errors: [] });
  }

  // Batch-check existing URLs to avoid duplicates
  const urls = allArticles.map((a) => a.url);
  const { data: existing } = await supabase
    .from("news")
    .select("url")
    .in("url", urls);

  const existingSet = new Set((existing ?? []).map((r: { url: string }) => r.url));
  let urlFiltered = allArticles.filter((a) => !existingSet.has(a.url));

  // Secondary dedup: check existing DB headlines per ticker for the past 48 h.
  // Catches cases where the same story was already stored under a different URL.
  if (urlFiltered.length > 0) {
    const tickersNeeded = Array.from(new Set(urlFiltered.map((a) => a.ticker)));
    const { data: recentRows } = await supabase
      .from("news")
      .select("ticker, headline")
      .in("ticker", tickersNeeded)
      .gte("published_at", new Date(cutoffMs).toISOString());

    const dbHeadlines = new Map<string, string[]>();
    for (const row of recentRows ?? []) {
      const arr = dbHeadlines.get(row.ticker) ?? [];
      arr.push(row.headline as string);
      dbHeadlines.set(row.ticker, arr);
    }

    urlFiltered = urlFiltered.filter((a) => {
      const dbExisting = dbHeadlines.get(a.ticker) ?? [];
      return !dbExisting.some((h) => wordOverlapRatio(h, a.headline) > 0.8);
    });
  }

  const toInsert = urlFiltered;
  const errors: string[] = [];
  let inserted = 0;

  if (toInsert.length > 0) {
    const { error } = await supabase.from("news").insert(toInsert);
    if (error) {
      errors.push(error.message);
    } else {
      inserted = toInsert.length;
    }
  }

  await supabase.from("pipeline_config").upsert({ id: 1, last_run_at: now.toISOString() });

  return NextResponse.json({
    processed: allArticles.length,
    inserted,
    skipped:   allArticles.length - toInsert.length,
    errors,
  });
}
