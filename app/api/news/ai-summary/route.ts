import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const { userId, isPro, isPlus } = await verifyClerkTokenWithTier(authHeader);

  if (!userId || (!isPro && !isPlus)) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mode         = searchParams.get("mode") ?? "general"; // general | watchlist | custom
  const tickersParam = searchParams.get("tickers") ?? "";

  // Plus users can only use general mode
  if (!isPro && mode !== "general") {
    return NextResponse.json({ error: "Pro required for watchlist and custom modes" }, { status: 403 });
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 5);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("news")
    .select("ticker, headline, summary, published_at, notification_type")
    .gte("published_at", since)
    .order("published_at", { ascending: false });

  if ((mode === "watchlist" || mode === "custom") && tickers.length > 0) {
    query = query.in("ticker", tickers);
  }

  const { data: articles } = await query.limit(60);

  if (!articles || articles.length === 0) {
    return NextResponse.json({
      summary: "No news articles found for the past 24 hours matching your criteria.",
      generatedAt: new Date().toISOString(),
    });
  }

  const articleText = articles
    .map((a) => `[${a.ticker}] ${a.headline}${a.summary ? `: ${a.summary.slice(0, 180)}` : ""}`)
    .join("\n");

  const scopeLabel =
    mode === "general"
      ? "the broader market"
      : mode === "watchlist"
      ? `the following stocks: ${tickers.join(", ")}`
      : `these specific tickers: ${tickers.join(", ")}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 450,
    messages: [
      {
        role: "user",
        content: `You are a concise financial news analyst. Based on the following news articles from the past 24 hours, write a clear market summary covering ${scopeLabel}. Focus on the most significant stories, any emerging themes, and notable price-moving events. Write 2–3 short paragraphs. Be direct and factual. Do not use bullet points or headers.\n\nArticles:\n${articleText}`,
      },
    ],
  });

  const summary = (message.content[0] as { type: string; text: string }).text;

  return NextResponse.json(
    { summary, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } },
  );
}
