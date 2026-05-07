// Cron reminder check: app/api/earnings-calendar/check
// vercel.json: { "path": "/api/earnings-calendar/check", "schedule": "0 8 * * *" }

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EarningsEntry {
  ticker: string;
  company_name: string | null;
  report_date: string;
  report_time: "pre-market" | "after-hours" | "during-market" | null;
  eps_estimate: number | null;
}

// ─── Module-level cache (1 hour) ──────────────────────────────────────────────

let cache: { data: EarningsEntry[]; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoAhead(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().split("T")[0];
}

function finnhubHour(h: string | null | undefined): EarningsEntry["report_time"] {
  if (h === "bmo") return "pre-market";
  if (h === "amc") return "after-hours";
  if (h === "dmh") return "during-market";
  return null;
}

// ─── Fetch + merge ────────────────────────────────────────────────────────────

async function fetchAndMerge(): Promise<EarningsEntry[]> {
  const today  = new Date().toISOString().split("T")[0];
  const ahead30 = isoAhead(30);

  const [{ data: dbRows }, { data: stocks }] = await Promise.all([
    supabaseAdmin
      .from("earnings_calendar")
      .select("ticker, report_date, report_time, eps_estimate")
      .gte("report_date", today)
      .lte("report_date", ahead30)
      .order("report_date", { ascending: true }),
    supabaseAdmin
      .from("admin_stocks")
      .select("ticker, company_name"),
  ]);

  const nameMap: Record<string, string> = {};
  const knownTickers = new Set<string>();
  for (const s of stocks ?? []) {
    knownTickers.add(s.ticker);
    if (s.company_name) nameMap[s.ticker] = s.company_name;
  }

  // Finnhub
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const finnhubRows: EarningsEntry[] = [];
  if (finnhubKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${ahead30}&token=${finnhubKey}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const json = await res.json() as {
          earningsCalendar?: Array<{ symbol: string; date: string; hour?: string; epsEstimate?: number | null }>;
        };
        for (const e of json.earningsCalendar ?? []) {
          if (!knownTickers.has(e.symbol)) continue;
          finnhubRows.push({
            ticker:       e.symbol,
            company_name: nameMap[e.symbol] ?? null,
            report_date:  e.date,
            report_time:  finnhubHour(e.hour),
            eps_estimate: e.epsEstimate ?? null,
          });
        }
      }
    } catch { /* continue without Finnhub */ }
  }

  // Merge — Supabase takes precedence for same ticker+date
  const merged = new Map<string, EarningsEntry>();

  for (const row of dbRows ?? []) {
    merged.set(`${row.ticker}|${row.report_date}`, {
      ticker:       row.ticker,
      company_name: nameMap[row.ticker] ?? null,
      report_date:  row.report_date,
      report_time:  (row.report_time as EarningsEntry["report_time"]) ?? null,
      eps_estimate: row.eps_estimate ?? null,
    });
  }

  for (const row of finnhubRows) {
    const key = `${row.ticker}|${row.report_date}`;
    if (!merged.has(key)) merged.set(key, row);
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.report_date.localeCompare(b.report_date)
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Past earnings path — direct DB query, not from the upcoming cache
  if (req.nextUrl.searchParams.get("past") === "true") {
    const tickerParam = req.nextUrl.searchParams.get("ticker");
    if (!tickerParam) return NextResponse.json({ error: "ticker required" }, { status: 400 });

    const upper = tickerParam.toUpperCase();
    const today = new Date().toISOString().split("T")[0];

    const [{ data: rows }, { data: stockRow }] = await Promise.all([
      supabaseAdmin
        .from("earnings_calendar")
        .select("ticker, report_date, report_time, eps_estimate")
        .eq("ticker", upper)
        .lt("report_date", today)
        .order("report_date", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("admin_stocks")
        .select("company_name")
        .eq("ticker", upper)
        .maybeSingle(),
    ]);

    if (!rows || rows.length === 0) return NextResponse.json([]);
    const row = rows[0];
    return NextResponse.json([{
      ticker:       row.ticker,
      company_name: (stockRow as { company_name: string | null } | null)?.company_name ?? null,
      report_date:  row.report_date,
      report_time:  (row.report_time as EarningsEntry["report_time"]) ?? null,
      eps_estimate: row.eps_estimate ?? null,
    }]);
  }

  if (!cache || Date.now() - cache.ts > CACHE_TTL) {
    cache = { data: await fetchAndMerge(), ts: Date.now() };
  }

  let results = cache.data;

  const ticker       = req.nextUrl.searchParams.get("ticker");
  const daysParam    = req.nextUrl.searchParams.get("days");
  const tickersParam = req.nextUrl.searchParams.get("tickers");

  if (ticker) {
    results = results.filter((e) => e.ticker === ticker.toUpperCase());
  }

  if (tickersParam) {
    const set = new Set(tickersParam.split(",").map((t) => t.trim().toUpperCase()));
    results = results.filter((e) => set.has(e.ticker));
  }

  if (daysParam) {
    const n = parseInt(daysParam, 10);
    if (!isNaN(n)) {
      const cutoff = isoAhead(n);
      results = results.filter((e) => e.report_date <= cutoff);
    }
  }

  return NextResponse.json(results);
}
