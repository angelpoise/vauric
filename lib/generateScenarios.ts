import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface ScenarioCase {
  "6m": string;
  "1y": string;
  "2y": string;
  target6m: { low: number; high: number };
  target1y: { low: number; high: number };
  target2y: { low: number; high: number };
}

export interface Scenarios {
  bull: ScenarioCase;
  base: ScenarioCase;
  bear: ScenarioCase;
}

export async function generateScenarios(ticker: string): Promise<Scenarios | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const [fundsRes, newsRes, rsRes] = await Promise.allSettled([
    fetch(`${APP_URL}/api/fundamentals`),
    fetch(`${APP_URL}/api/news?ticker=${ticker}&limit=5`),
    fetch(`${APP_URL}/api/relative-strength?ticker=${ticker}`),
  ]);

  let ctx = "";

  if (fundsRes.status === "fulfilled" && fundsRes.value.ok) {
    const all = await fundsRes.value.json();
    const f = all[ticker];
    if (f) {
      ctx += `Business: ${(f.longBusinessSummary as string | null)?.slice(0, 400) ?? "N/A"}\n`;
      ctx += `Sector: ${f.sector ?? "N/A"} | Market cap: ${f.marketCap ? `$${((f.marketCap as number) / 1e9).toFixed(1)}B` : "N/A"}\n`;
      ctx += `Trailing P/E: ${(f.trailingPE as number | null)?.toFixed(1) ?? "N/A"} | Forward P/E: ${(f.forwardPE as number | null)?.toFixed(1) ?? "N/A"} | Beta: ${(f.beta as number | null)?.toFixed(2) ?? "N/A"}\n`;
    }
  }

  if (newsRes.status === "fulfilled" && newsRes.value.ok) {
    const articles = await newsRes.value.json() as Array<{ headline: string }>;
    if (Array.isArray(articles) && articles.length > 0) {
      ctx += `Recent news:\n${articles.slice(0, 5).map(a => `- ${a.headline}`).join("\n")}\n`;
    }
  }

  if (rsRes.status === "fulfilled" && rsRes.value.ok) {
    const rs = await rsRes.value.json() as { vs1m?: number | null; trend?: string } | null;
    if (rs) {
      ctx += `Relative strength vs sector ETF: 1M=${rs.vs1m != null ? rs.vs1m.toFixed(1) + "%" : "N/A"}, trend=${rs.trend ?? "N/A"}\n`;
    }
  }

  const prompt =
    `Return ONLY the JSON object with no preamble, explanation, or markdown. Start your response with { and end with }.\n\n` +
    `You are a senior equity analyst writing a professional scenario note for ${ticker}. ` +
    `Based on the data below, generate detailed bull, base, and bear case scenarios.\n\n` +
    ctx + "\n" +
    `For each scenario (bull / base / bear) and each timeframe (6m / 1y / 2y), write 4-6 sentences that cover:\n` +
    `1. The specific catalysts that would drive this scenario\n` +
    `2. Key risks or assumptions that must hold for it to play out\n` +
    `3. Expected price range and the multiple or metric that justifies it\n` +
    `4. Key milestones or events to watch (earnings, product launches, macro inflection points, etc.)\n` +
    `5. How current market conditions support or challenge this scenario\n\n` +
    `Each timeframe should read like a paragraph from a professional analyst note — specific, analytical, and grounded in the data provided.\n\n` +
    `For each scenario, provide a separate price target per timeframe (target6m, target1y, target2y). Each target must be:\n` +
    `- Tightly ranged: no more than 15-20% spread between low and high\n` +
    `- Progressive: each timeframe's target logically follows from the previous (6m feeds into 1y, 1y into 2y)\n` +
    `- Grounded in the current stock price: reference the current price explicitly and set targets relative to it\n\n` +
    `Return ONLY a JSON object — no markdown, no explanation. The response must be complete, valid JSON — do not truncate mid-sentence or mid-object:\n` +
    `{"bull":{"6m":"...","1y":"...","2y":"...","target6m":{"low":0,"high":0},"target1y":{"low":0,"high":0},"target2y":{"low":0,"high":0}},"base":{"6m":"...","1y":"...","2y":"...","target6m":{"low":0,"high":0},"target1y":{"low":0,"high":0},"target2y":{"low":0,"high":0}},"bear":{"6m":"...","1y":"...","2y":"...","target6m":{"low":0,"high":0},"target1y":{"low":0,"high":0},"target2y":{"low":0,"high":0}}}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    console.log(`[generateScenarios] calling Anthropic for ${ticker}`);
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4000,
      messages:   [{ role: "user", content: prompt }],
    });
    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    console.log(`[generateScenarios] raw response length=${raw.length} for ${ticker}`);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed: Scenarios;
    try {
      if (!jsonMatch) throw new Error("no JSON object found in response");
      parsed = JSON.parse(jsonMatch[0]) as Scenarios;
    } catch (parseErr) {
      console.error(`[generateScenarios] JSON parse failed for ${ticker}:`, parseErr, "raw:", raw.slice(0, 500));
      return null;
    }
    if (!parsed.bull || !parsed.base || !parsed.bear) {
      console.error(`[generateScenarios] missing bull/base/bear for ${ticker}, parsed:`, JSON.stringify(parsed).slice(0, 500));
      return null;
    }
    return parsed;
  } catch (err) {
    console.error(`[generateScenarios] Anthropic call failed for ${ticker}:`, err);
    return null;
  }
}

export async function saveScenarios(ticker: string, scenarios: Scenarios): Promise<void> {
  const payload = { ticker, ...scenarios, generated_at: new Date().toISOString() };
  console.log("[saveScenarios] upserting", ticker, JSON.stringify(payload));
  const { error } = await supabaseAdmin
    .from("stock_scenarios")
    .upsert(payload);
  if (error) {
    console.error("[saveScenarios] upsert error", JSON.stringify(error));
  } else {
    console.log("[saveScenarios] upsert success", ticker);
  }
}
