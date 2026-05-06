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

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface AnalysisResult {
  segments:      string;
  margins:       string;
  guidance:      string;
  relationships: string;
}

async function generateAnalysis(ticker: string): Promise<AnalysisResult | null> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Gather context: fundamentals + recent news headlines
  const [fundsRes, newsRes] = await Promise.allSettled([
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/fundamentals`),
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/news?ticker=${ticker}&limit=10`),
  ]);

  let fundamentalCtx = "";
  if (fundsRes.status === "fulfilled" && fundsRes.value.ok) {
    const all = await fundsRes.value.json();
    const f = all[ticker];
    if (f) {
      fundamentalCtx = `Business summary: ${f.longBusinessSummary ?? "Not available"}\n` +
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

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const parsed: AnalysisResult = JSON.parse(text);
    if (!parsed.segments || !parsed.margins || !parsed.guidance || !parsed.relationships) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  if (!refresh) {
    const { data: cached } = await supabaseAdmin
      .from("company_analysis")
      .select("segments, margins, guidance, relationships, last_generated_at")
      .eq("ticker", ticker)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.last_generated_at as string).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          segments:      cached.segments,
          margins:       cached.margins,
          guidance:      cached.guidance,
          relationships: cached.relationships,
        });
      }
    }
  }

  const analysis = await generateAnalysis(ticker);
  if (!analysis) {
    return NextResponse.json({ error: "Analysis generation failed" }, { status: 500 });
  }

  await supabaseAdmin
    .from("company_analysis")
    .upsert({
      ticker,
      ...analysis,
      last_generated_at: new Date().toISOString(),
    });

  return NextResponse.json(analysis);
}
