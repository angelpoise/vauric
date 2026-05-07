import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchFundamentalsForTicker,
  getYahooSession,
  type FundamentalsEntry,
} from "@/lib/fundamentalsUtils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface AnalysisResult {
  segments:      string;
  margins:       string;
  guidance:      string;
  relationships: string;
}

export async function generateAnalysis(ticker: string): Promise<AnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const [fundsRes, newsRes] = await Promise.allSettled([
    fetch(`${APP_URL}/api/fundamentals`),
    fetch(`${APP_URL}/api/news?ticker=${ticker}&limit=10`),
  ]);

  // Prefer in-process cache; fall back to direct Yahoo Finance if cold
  let f: FundamentalsEntry | null = null;
  if (fundsRes.status === "fulfilled" && fundsRes.value.ok) {
    const all = await fundsRes.value.json() as Record<string, FundamentalsEntry>;
    f = all[ticker] ?? null;
  }
  if (!f) {
    const session = await getYahooSession();
    if (session) f = await fetchFundamentalsForTicker(ticker, session);
  }

  let fundamentalCtx = "";
  if (f) {
    fundamentalCtx =
      `Business summary: ${f.longBusinessSummary ?? "Not available"}\n` +
      `Sector: ${f.sector ?? "Unknown"} | Industry: ${f.industry ?? "Unknown"}\n` +
      `Market Cap: ${f.marketCap ? `$${(f.marketCap / 1e9).toFixed(1)}B` : "n/a"} | ` +
      `Trailing P/E: ${f.trailingPE?.toFixed(1) ?? "n/a"} | ` +
      `Forward P/E: ${f.forwardPE?.toFixed(1) ?? "n/a"}\n` +
      `Full-time employees: ${f.fullTimeEmployees?.toLocaleString() ?? "n/a"}`;
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

  const company = f?.sector ? `${ticker} (${f.sector})` : ticker;
  const prompt =
    `You are a financial analyst. Based on the information below, write a concise, factual analysis of ${company}. Use your training knowledge to supplement any gaps in the provided data.\n\n` +
    `COMPANY DATA:\n${fundamentalCtx || "No fundamental data available."}\n\n` +
    `RECENT NEWS HEADLINES:\n${newsCtx || "No recent news available."}\n\n` +
    `Respond ONLY with a JSON object in this exact format (no markdown, no extra text):\n` +
    `{"segments":"2-3 sentences on main business segments and revenue sources.","margins":"2-3 sentences on profitability, margins trend, and unit economics.","guidance":"2-3 sentences on recent management guidance and near-term outlook.","relationships":"2-3 sentences on notable customers, suppliers, partners, or competitive relationships."}\n\n` +
    `Base your response on the data provided. If a section has no data, say so briefly.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1200,
      messages:   [{ role: "user", content: prompt }],
    });
    const text   = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const parsed = JSON.parse(text) as AnalysisResult;
    if (!parsed.segments || !parsed.margins || !parsed.guidance || !parsed.relationships) return null;
    return parsed;
  } catch { return null; }
}

export async function saveAnalysis(ticker: string, analysis: AnalysisResult): Promise<void> {
  await supabaseAdmin
    .from("company_analysis")
    .upsert({ ticker, ...analysis, last_generated_at: new Date().toISOString() });
}
