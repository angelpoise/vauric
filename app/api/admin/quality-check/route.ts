import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, YAHOO_TO_GICS } from "@/lib/tickerLookupUtils";
import { getYahooSession } from "@/lib/fundamentalsUtils";

export interface QualityIssue {
  ticker: string;
  currentName: string;
  currentSector: string;
  suggestedName: string | null;
  suggestedSector: string | null;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function yahooLookup(
  ticker: string,
  session: { cookie: string; crumb: string },
): Promise<{ name: string | null; sector: string | null }> {
  try {
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=quoteType,assetProfile&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: session.cookie } });
    if (!res.ok) return { name: null, sector: null };
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] as Record<string, unknown> | undefined;
    const qt = result?.quoteType    as Record<string, unknown> | undefined;
    const ap = result?.assetProfile as Record<string, unknown> | undefined;

    const rawName   = typeof qt?.longName  === "string" ? qt.longName
                    : typeof qt?.shortName === "string" ? qt.shortName
                    : null;
    const rawSector = typeof ap?.sector    === "string" ? ap.sector : null;

    return {
      name:   rawName   ? cleanCompanyName(rawName)           : null,
      sector: rawSector ? (YAHOO_TO_GICS[rawSector] ?? null) : null,
    };
  } catch {
    return { name: null, sector: null };
  }
}

// GET — scan all stocks and return quality issues
export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: stocks, error } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, sector")
    .eq("node_type", "stock")
    .order("ticker");

  if (error || !stocks) return NextResponse.json({ error: "DB error" }, { status: 500 });

  const session = await getYahooSession();
  if (!session) return NextResponse.json({ error: "Could not reach Yahoo Finance" }, { status: 503 });

  const issues: QualityIssue[] = [];
  const CONCURRENCY = 5;

  for (let i = 0; i < stocks.length; i += CONCURRENCY) {
    const batch = stocks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (stock) => {
        const { name: suggestedName, sector: suggestedSector } =
          await yahooLookup(stock.ticker, session);

        const nameIsTickerFallback = stock.company_name === stock.ticker;
        const nameDiffers   = nameIsTickerFallback
          || (suggestedName !== null && suggestedName !== stock.company_name);
        const sectorDiffers = suggestedSector !== null && suggestedSector !== stock.sector;

        if (!nameDiffers && !sectorDiffers) return null;

        return {
          ticker:          stock.ticker,
          currentName:     stock.company_name ?? "",
          currentSector:   stock.sector       ?? "",
          suggestedName:   nameDiffers   ? suggestedName   : null,
          suggestedSector: sectorDiffers ? suggestedSector : null,
        } satisfies QualityIssue;
      }),
    );
    issues.push(...(results.filter(Boolean) as QualityIssue[]));
  }

  return NextResponse.json(issues);
}

// POST — apply selected fixes
export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fixes = await req.json() as Array<{
    ticker: string;
    company_name?: string;
    sector?: string;
  }>;

  await Promise.all(
    fixes.map(async ({ ticker, company_name, sector }) => {
      const update: Record<string, string> = {};
      if (company_name) update.company_name = company_name;
      if (sector)       update.sector       = sector;
      if (!Object.keys(update).length) return;
      await supabaseAdmin
        .from("admin_nodes")
        .update(update)
        .eq("ticker", ticker)
        .eq("node_type", "stock");
    }),
  );

  return NextResponse.json({ ok: true });
}
