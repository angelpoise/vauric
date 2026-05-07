// SQL — run once in Supabase:
//
// create table public.stock_scenarios (
//   ticker       text        primary key,
//   bull         jsonb       not null,
//   base         jsonb       not null,
//   bear         jsonb       not null,
//   generated_at timestamptz not null default now()
// );

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface ScenarioCase {
  "6m": string;
  "1y": string;
  "2y": string;
  priceTarget: number;
}
export interface Scenarios {
  bull: ScenarioCase;
  base: ScenarioCase;
  bear: ScenarioCase;
}

async function generateScenarios(ticker: string): Promise<Scenarios | null> {
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
    `You are a stock analyst. Based on the following data for ${ticker}, generate concise bull, base, and bear case scenarios.\n\n` +
    ctx + "\n" +
    `Return ONLY a JSON object — no markdown, no explanation:\n` +
    `{"bull":{"6m":"...","1y":"...","2y":"...","priceTarget":0},"base":{"6m":"...","1y":"...","2y":"...","priceTarget":0},"bear":{"6m":"...","1y":"...","2y":"...","priceTarget":0}}\n\n` +
    `Each timeframe text must be exactly 1-2 concise sentences. Be specific. Price targets must be realistic numbers.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 800,
      messages:   [{ role: "user", content: prompt }],
    });
    const raw  = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(json) as Scenarios;
    if (!parsed.bull || !parsed.base || !parsed.bear) return null;
    return parsed;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // peek=1 — return cached data only, never trigger generation (used on mount)
  const peek = req.nextUrl.searchParams.get("peek") === "1";

  const { data: cached } = await supabaseAdmin
    .from("stock_scenarios")
    .select("bull, base, bear, generated_at")
    .eq("ticker", ticker)
    .maybeSingle();

  const ageMs   = cached ? Date.now() - new Date(cached.generated_at as string).getTime() : null;
  const isFresh = ageMs !== null && ageMs < WEEK_MS;
  console.log(
    `[scenarios] ticker=${ticker} peek=${peek}`,
    `cached=${cached ? "yes" : "no"}`,
    `generated_at=${(cached as { generated_at?: string } | null)?.generated_at ?? "n/a"}`,
    `age_days=${ageMs !== null ? (ageMs / 86_400_000).toFixed(1) : "n/a"}`,
    `fresh=${isFresh}`,
    `path=${!cached ? "no-cache" : isFresh ? "cache-hit" : "stale"}`,
  );

  if (cached && isFresh) {
    return NextResponse.json({ ...cached, ticker });
  }

  if (peek) return NextResponse.json(null); // cache cold/stale — let client show Generate button

  const scenarios = await generateScenarios(ticker);
  if (!scenarios) return NextResponse.json({ error: "Generation failed" }, { status: 500 });

  const generated_at = new Date().toISOString();
  await supabaseAdmin.from("stock_scenarios").upsert({ ticker, ...scenarios, generated_at });

  return NextResponse.json({ ...scenarios, ticker, generated_at });
}

export async function DELETE(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });
  await supabaseAdmin.from("stock_scenarios").delete().eq("ticker", ticker);
  return NextResponse.json({ ok: true });
}
