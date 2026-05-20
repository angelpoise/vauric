import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory; resets naturally when the function instance recycles.
// Keyed by `userId:YYYY-MM-DD` so counts are per-calendar-day (UTC).

const RATE_PLUS = 10;
const RATE_PRO  = 20;

const rateLimitMap = new Map<string, number>();

function rlKey(userId: string) {
  return `${userId}:${new Date().toISOString().slice(0, 10)}`;
}

function checkAndIncrement(userId: string, limit: number): boolean {
  const key   = rlKey(userId);
  const count = rateLimitMap.get(key) ?? 0;
  if (count >= limit) return false;
  rateLimitMap.set(key, count + 1);
  return true;
}

// Purge yesterday's keys so the Map doesn't grow across day boundaries.
function purgeOldRateLimits() {
  const today = new Date().toISOString().slice(0, 10);
  rateLimitMap.forEach((_, key) => { if (!key.endsWith(today)) rateLimitMap.delete(key); });
}

// ── Response cache ────────────────────────────────────────────────────────────
// Keyed by `userId:mode:sortedTickers`. TTL = 15 min.
// Means the same user won't hit Anthropic more than once per 15 min for the
// same query, even if they open/close the panel repeatedly.

const CACHE_TTL = 15 * 60 * 1000;

interface CacheEntry { summary: string; generatedAt: string; expiresAt: number }
const summaryCache = new Map<string, CacheEntry>();

function cacheKey(userId: string, mode: string, tickers: string[]) {
  return `${userId}:${mode}:${[...tickers].sort().join(",")}`;
}

function getCache(key: string): CacheEntry | null {
  const entry = summaryCache.get(key);
  if (!entry || entry.expiresAt < Date.now()) { summaryCache.delete(key); return null; }
  return entry;
}

function setCache(key: string, summary: string, generatedAt: string) {
  summaryCache.set(key, { summary, generatedAt, expiresAt: Date.now() + CACHE_TTL });
  // Evict expired entries while we're here.
  summaryCache.forEach((v, k) => { if (v.expiresAt < Date.now()) summaryCache.delete(k); });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const { userId, isPro, isPlus } = await verifyClerkTokenWithTier(authHeader);

  if (!userId || (!isPro && !isPlus)) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mode         = searchParams.get("mode") ?? "general";
  const tickersParam = searchParams.get("tickers") ?? "";

  if (!isPro && mode !== "general") {
    return NextResponse.json({ error: "Pro required for watchlist and custom modes" }, { status: 403 });
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 5);

  // ── Cache check ─────────────────────────────────────────────────────────────
  const ck     = cacheKey(userId, mode, tickers);
  const cached = getCache(ck);
  if (cached) {
    return NextResponse.json({ summary: cached.summary, generatedAt: cached.generatedAt, fromCache: true });
  }

  // ── Rate limit ──────────────────────────────────────────────────────────────
  purgeOldRateLimits();
  const limit  = isPro ? RATE_PRO : RATE_PLUS;
  const allowed = checkAndIncrement(userId, limit);
  if (!allowed) {
    return NextResponse.json(
      { error: `Daily limit of ${limit} summaries reached. Resets at midnight UTC.` },
      { status: 429 },
    );
  }

  // ── Fetch articles ──────────────────────────────────────────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("news")
    .select("ticker, headline, summary, published_at, notification_type")
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if ((mode === "watchlist" || mode === "custom") && tickers.length > 0) {
    query = query.in("ticker", tickers);
  }

  const { data: articles } = await query.limit(40);

  if (!articles || articles.length === 0) {
    return NextResponse.json({
      summary: "No news articles found for the past 24 hours matching your criteria.",
      generatedAt: new Date().toISOString(),
      fromCache: false,
    });
  }

  // Truncate each article to keep input tokens under control (~1,500 tokens total).
  const articleText = articles
    .map((a) => `[${a.ticker}] ${a.headline}${a.summary ? `: ${a.summary.slice(0, 130)}` : ""}`)
    .join("\n");

  const scopeLabel =
    mode === "general"
      ? "the broader market"
      : mode === "watchlist"
      ? `the following stocks: ${tickers.join(", ")}`
      : `these tickers: ${tickers.join(", ")}`;

  // ── Call Anthropic ──────────────────────────────────────────────────────────
  const message = await anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{
      role:    "user",
      content: `You are a concise financial news analyst. Based on the following news articles from the past 24 hours, write a clear market summary covering ${scopeLabel}. Focus on the most significant stories, emerging themes, and notable price-moving events. Write 2–3 short paragraphs. Be direct and factual. Do not use bullet points or headers.\n\nArticles:\n${articleText}`,
    }],
  });

  const summary     = (message.content[0] as { type: string; text: string }).text;
  const generatedAt = new Date().toISOString();

  setCache(ck, summary, generatedAt);

  return NextResponse.json({ summary, generatedAt, fromCache: false });
}
