import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, sectorFromPolygon, YAHOO_TO_GICS } from "@/lib/tickerLookupUtils";
import { getYahooSession, fetchFundamentalsForTicker } from "@/lib/fundamentalsUtils";

export interface QualityIssue {
  ticker: string;
  currentName: string;
  currentSector: string;
  suggestedName: string | null;
  suggestedSector: string | null;
}

// GET — scan all stocks and return quality issues
export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  const { data: stocks, error } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, sector")
    .eq("node_type", "stock")
    .order("ticker");

  if (error || !stocks) return NextResponse.json({ error: "DB error" }, { status: 500 });

  // Get Yahoo session once for sector lookups
  const yahooSession = await getYahooSession();

  const issues: QualityIssue[] = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < stocks.length; i += CONCURRENCY) {
    const batch = stocks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (stock) => {
        // ── Name from Polygon ───────────────────────────────────────────────
        let suggestedName: string | null = null;
        try {
          const res = await fetch(
            `https://api.polygon.io/v3/reference/tickers/${stock.ticker}?apiKey=${polygonKey}`,
          );
          if (res.ok) {
            const json = await res.json();
            const r = json?.results as Record<string, unknown> | undefined;
            const rawName = typeof r?.name === "string" ? r.name : null;
            const sicCode = typeof r?.sic_code === "string" ? r.sic_code : null;
            if (rawName) suggestedName = cleanCompanyName(rawName);

            // Fall back to Polygon SIC sector if Yahoo fails later
            if (!yahooSession) {
              const sicSector = sectorFromPolygon(stock.ticker, sicCode);
              const sectorDiffers = sicSector !== null && sicSector !== stock.sector;
              const nameDiffers   = suggestedName !== null && suggestedName !== stock.company_name;
              if (!nameDiffers && !sectorDiffers) return null;
              return {
                ticker:          stock.ticker,
                currentName:     stock.company_name ?? "",
                currentSector:   stock.sector       ?? "",
                suggestedName:   nameDiffers   ? suggestedName   : null,
                suggestedSector: sectorDiffers ? sicSector       : null,
              } satisfies QualityIssue;
            }
          }
        } catch { /* ignore — name stays null */ }

        // ── Sector from Yahoo Finance (more accurate GICS mapping) ──────────
        let suggestedSector: string | null = null;
        if (yahooSession) {
          try {
            const entry = await fetchFundamentalsForTicker(stock.ticker, yahooSession);
            if (entry?.sector) {
              suggestedSector = YAHOO_TO_GICS[entry.sector] ?? entry.sector;
            }
          } catch { /* ignore */ }
        }

        // Also flag stocks where company_name = ticker (failed lookup fallback)
        const nameIsTickerFallback = stock.company_name === stock.ticker;
        const nameDiffers   = (suggestedName !== null && suggestedName !== stock.company_name) || nameIsTickerFallback;
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
