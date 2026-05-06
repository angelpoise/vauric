// Required Supabase schema:
//
//   CREATE TABLE company_analysis (
//     ticker            TEXT PRIMARY KEY,
//     segments          TEXT,
//     margins           TEXT,
//     guidance          TEXT,
//     relationships     TEXT,
//     last_generated_at TIMESTAMPTZ DEFAULT NOW()
//   );
//
//   -- admin_stocks must also have:
//   --   analysis_schedule TEXT DEFAULT 'on_visit'  ('on_visit' | 'daily' | 'weekly')
//   --   last_visited_at   TIMESTAMPTZ
//   --   visit_count       INTEGER DEFAULT 0

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

const DAY_MS  = 24 * 60 * 60 * 1000;
const WEEK_MS =  7 * DAY_MS;

interface AnalysisResult {
  segments:      string;
  margins:       string;
  guidance:      string;
  relationships: string;
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────

function isAfterETMarketClose(): boolean {
  try {
    const etHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        hour12: false,
      }).format(new Date()),
      10,
    );
    return etHour >= 16;
  } catch {
    return true; // safe fallback
  }
}

function shouldRegenerate(
  lastGeneratedAt: string | null,
  schedule: string,
  lastVisitedAt:  string | null,
): boolean {
  if (!lastGeneratedAt) return true; // no cache at all

  const age          = Date.now() - new Date(lastGeneratedAt).getTime();
  const daysSinceVisit = lastVisitedAt
    ? (Date.now() - new Date(lastVisitedAt).getTime()) / DAY_MS
    : Infinity;

  if (schedule === "weekly") return age > WEEK_MS;

  if (schedule === "daily") {
    return age > DAY_MS && isAfterETMarketClose();
  }

  // on_visit (default): regenerate if stale AND stock was visited within 30 days
  if (age <= DAY_MS) return false;
  return daysSinceVisit <= 30;
}

// ─── Analysis generation ──────────────────────────────────────────────────────

async function generateAnalysis(ticker: string): Promise<AnalysisResult | null> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const [fundsRes, newsRes] = await Promise.allSettled([
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/fundamentals`),
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/news?ticker=${ticker}&limit=10`),
  ]);

  let fundamentalCtx = "";
  if (fundsRes.status === "fulfilled" && fundsRes.value.ok) {
    const all = await fundsRes.value.json();
    const f = all[ticker];
    if (f) {
      fundamentalCtx =
        `Business summary: ${f.longBusinessSummary ?? "Not available"}\n` +
        `Sector: ${f.sector ?? "Unknown"} | Industry: ${f.industry ?? "Unknown"}\n` +
        `Market Cap: ${f.marketCap ? `$${(f.marketCap / 1e9).toFixed(1)}B` : "n/a"} | ` +
        `Trailing P/E: ${f.trailingPE?.toFixed(1) ?? "n/a"} | ` +
        `Forward P/E: ${f.forwardPE?.toFixed(1) ?? "n/a"}\n` +
        `Full-time employees: ${f.fullTimeEmployees?.toLocaleString() ?? "n/a"}`;
    }
  }

  let newsCtx = "";
  if (newsRes.status === "fulfilled" && newsRes.value.ok) {
    const articles = await newsRes.value.json();
    if (Array.isArray(articles) && articles.length > 0) {
      newsCtx = articles
        .slice(0, 10)
        .map((a: { headline: string; published_at: string }) =>
          `- ${a.headline} (${new Date(a.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
        )
        .join("\n");
    }
  }

  const prompt = `You are a financial analyst. Based on the information below, write a concise, factual analysis of ${ticker}.

COMPANY DATA:
${fundamentalCtx || "No fundamental data available."}

RECENT NEWS HEADLINES:
${newsCtx || "No recent news available."}

Respond ONLY with a JSON object in this exact format (no markdown, no extra text):
{
  "segments": "2-3 sentences on the company's main business segments and revenue sources.",
  "margins": "2-3 sentences on profitability, margins trend, and unit economics.",
  "guidance": "2-3 sentences on recent management guidance and near-term outlook from earnings or news.",
  "relationships": "2-3 sentences on notable customers, suppliers, partners, or competitive relationships."
}

Base your response on the data provided. If information is unavailable for a section, say so briefly rather than inventing details.`;

  try {
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    });
    const text   = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const parsed = JSON.parse(text) as AnalysisResult;
    if (!parsed.segments || !parsed.margins || !parsed.guidance || !parsed.relationships) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function saveAnalysis(ticker: string, analysis: AnalysisResult) {
  await supabaseAdmin
    .from("company_analysis")
    .upsert({ ticker, ...analysis, last_generated_at: new Date().toISOString() });
}

// Background regeneration — fire and forget (best-effort in serverless)
function regenInBackground(ticker: string) {
  generateAnalysis(ticker)
    .then((a) => { if (a) saveAnalysis(ticker, a).catch(() => {}); })
    .catch(() => {});
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // Fetch cached analysis and stock schedule/visit metadata in parallel
  const [{ data: cached }, { data: stock }] = await Promise.all([
    supabaseAdmin
      .from("company_analysis")
      .select("segments, margins, guidance, relationships, last_generated_at")
      .eq("ticker", ticker)
      .single(),
    supabaseAdmin
      .from("admin_stocks")
      .select("analysis_schedule, last_visited_at")
      .eq("ticker", ticker)
      .single(),
  ]);

  const schedule    = (stock?.analysis_schedule as string | null) ?? "on_visit";
  const lastVisited = stock?.last_visited_at as string | null;

  // Explicit refresh: regenerate synchronously and return fresh result
  if (refresh) {
    const analysis = await generateAnalysis(ticker);
    if (!analysis) return NextResponse.json({ error: "Analysis generation failed" }, { status: 500 });
    await saveAnalysis(ticker, analysis);
    return NextResponse.json(analysis);
  }

  // Cache hit: return immediately, trigger background regen if schedule says so
  if (cached) {
    if (shouldRegenerate(cached.last_generated_at as string, schedule, lastVisited)) {
      regenInBackground(ticker);
    }
    return NextResponse.json({
      segments:      cached.segments,
      margins:       cached.margins,
      guidance:      cached.guidance,
      relationships: cached.relationships,
    });
  }

  // No cache: generate synchronously (first-time experience)
  const analysis = await generateAnalysis(ticker);
  if (!analysis) return NextResponse.json({ error: "Analysis generation failed" }, { status: 500 });
  await saveAnalysis(ticker, analysis);
  return NextResponse.json(analysis);
}

// ─── DELETE — clear cached analysis (admin only) ──────────────────────────────

export async function DELETE(req: NextRequest) {
  const hasAuth = !!req.headers.get("authorization");
  const isAdmin = await isAdminRequest(req);
  console.log(`[analysis DELETE] hasAuth=${hasAuth} isAdmin=${isAdmin}`);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  console.log(`[analysis DELETE] ticker=${ticker}`);
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("company_analysis")
    .delete()
    .eq("ticker", ticker);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
