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

// Field labels per node type — used to generate node-appropriate prompts
// while keeping the JSON schema identical for all types.
const FIELD_LABELS: Record<string, { segments: string; margins: string; guidance: string; relationships: string }> = {
  stock: {
    segments:      "Main business segments and revenue sources",
    margins:       "Profitability, margins trend, and unit economics",
    guidance:      "Recent management guidance and near-term outlook",
    relationships: "Notable customers, suppliers, partners, or competitive relationships",
  },
  sector: {
    segments:      "Key themes and macro drivers defining this sector right now",
    margins:       "Sector performance and flows — outperforming or underperforming the broader market and why",
    guidance:      "Near-term catalysts and risks over the next 1-3 months",
    relationships: "Key constituent themes, leading sub-sectors, and cross-sector relationships",
  },
  subsector: {
    segments:      "What makes this sub-sector distinct — unique drivers vs the parent sector",
    margins:       "Recent performance of constituent stocks and the sub-sector ETF (if applicable)",
    guidance:      "Specific catalysts and risks unique to this sub-sector",
    relationships: "Leading constituent stocks and how they relate to broader sector themes",
  },
  subsubsector: {
    segments:      "The specific investment theme — what it is and why it matters now",
    margins:       "Performance of the key beneficiary stocks and any tracking ETF",
    guidance:      "Key near-term catalysts: product launches, policy changes, earnings, milestones",
    relationships: "Top beneficiary stocks, the bear case, and how this theme fits the broader narrative",
  },
};

export async function generateAnalysis(
  ticker:      string,
  nodeType:    "stock" | "sector" | "subsector" | "subsubsector" = "stock",
  displayName?: string,
): Promise<AnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const isStock = nodeType === "stock";
  const label   = FIELD_LABELS[nodeType] ?? FIELD_LABELS.stock;
  const name    = displayName ?? ticker;

  // Fetch fundamentals + news in parallel.
  // For stocks: the /api/fundamentals cache covers them; for ETFs we fall back
  // to a direct Yahoo call (using the shared cached session in the ETF holdings route).
  const [fundsRes, newsRes] = await Promise.allSettled([
    fetch(`${APP_URL}/api/fundamentals`),
    fetch(`${APP_URL}/api/news?ticker=${encodeURIComponent(ticker)}&limit=10`),
  ]);

  // Resolve fundamentals — prefer in-process cache, fall back to direct Yahoo
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
    if (isStock) {
      fundamentalCtx =
        `Business summary: ${f.longBusinessSummary ?? "Not available"}\n` +
        `Sector: ${f.sector ?? "Unknown"} | Industry: ${f.industry ?? "Unknown"}\n` +
        `Market Cap: ${f.marketCap ? `$${(f.marketCap / 1e9).toFixed(1)}B` : "n/a"} | ` +
        `Trailing P/E: ${f.trailingPE?.toFixed(1) ?? "n/a"} | Forward P/E: ${f.forwardPE?.toFixed(1) ?? "n/a"}\n` +
        `Full-time employees: ${f.fullTimeEmployees?.toLocaleString() ?? "n/a"}`;
    } else {
      fundamentalCtx =
        `ETF / Instrument: ${ticker}\n` +
        `Description: ${f.longBusinessSummary ?? "Not available"}\n` +
        `Category: ${f.sector ?? f.industry ?? "n/a"}\n` +
        `52-week range: ${f.fiftyTwoWeekLow?.toFixed(2) ?? "n/a"} – ${f.fiftyTwoWeekHigh?.toFixed(2) ?? "n/a"}`;
    }
  }

  // Resolve news
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

  const subject = isStock ? (f?.sector ? `${name} (${f.sector})` : name) : name;
  const nodeTypeLabel = nodeType === "subsubsector" ? "investment theme / sub-sub-sector" : nodeType;

  const prompt =
    `You are a senior financial analyst. Write a concise, factual analysis of the ${nodeTypeLabel} "${subject}".\n` +
    `Use your training knowledge to supplement any gaps in the provided data.\n\n` +
    `DATA:\n${fundamentalCtx || "No instrument data available."}\n\n` +
    `RECENT NEWS:\n${newsCtx || "No recent news available."}\n\n` +
    `Respond ONLY with a JSON object in this exact format (no markdown, no extra text):\n` +
    `{"segments":"2-3 sentences on ${label.segments}.","margins":"2-3 sentences on ${label.margins}.","guidance":"2-3 sentences on ${label.guidance}.","relationships":"2-3 sentences on ${label.relationships}."}\n\n` +
    `Base your response on the data provided. Be specific and analytical.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const maxTokens = isStock ? 1200 : 1500;
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages:   [{ role: "user", content: prompt }],
    });
    const raw    = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const json   = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    const parsed = JSON.parse(json) as AnalysisResult;
    if (!parsed.segments || !parsed.margins || !parsed.guidance || !parsed.relationships) return null;
    return parsed;
  } catch (err) {
    console.error(`[generateAnalysis] failed for ${ticker}:`, err);
    return null;
  }
}

export async function saveAnalysis(ticker: string, analysis: AnalysisResult): Promise<void> {
  const payload = { ticker, ...analysis, last_generated_at: new Date().toISOString() };
  console.log("[saveAnalysis] upserting", ticker);
  const { error } = await supabaseAdmin.from("company_analysis").upsert(payload);
  if (error) console.error("[saveAnalysis] upsert error", JSON.stringify(error));
  else       console.log("[saveAnalysis] upsert success", ticker);
}
