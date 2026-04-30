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
  try {
    const url =
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}` +
      `&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Fetch all tickers in parallel
  const fetched = await Promise.allSettled(
    GRAPH_TICKERS.map(async (ticker) => {
      const articles = await fetchTicker(ticker, twoDaysAgo, today, finnhubKey);
      return { ticker, articles };
    }),
  );

  // Flatten all articles and deduplicate by url within this batch
  interface Article { ticker: string; headline: string; summary: string; source: string; url: string; published_at: string; notification_type: string; }
  const allArticles: Article[] = [];
  const seenUrls = new Set<string>();

  for (const r of fetched) {
    if (r.status !== "fulfilled") continue;
    const { ticker, articles } = r.value;
    for (const a of articles) {
      if (!a.url || seenUrls.has(a.url)) continue;
      // Skip articles older than 48 hours at insert time
      if (a.datetime * 1000 < cutoffMs) continue;
      seenUrls.add(a.url);
      allArticles.push({
        ticker,
        headline:          a.headline ?? "",
        summary:           a.summary  ?? "",
        source:            a.source   ?? "",
        url:               a.url,
        published_at:      new Date(a.datetime * 1000).toISOString(),
        notification_type: classifyNews(a.headline ?? "", a.summary ?? ""),
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
  const toInsert = allArticles.filter((a) => !existingSet.has(a.url));
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
