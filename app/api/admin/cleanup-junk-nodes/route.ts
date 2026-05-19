import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, sectorFromPolygon, YAHOO_TO_GICS } from "@/lib/tickerLookupUtils";
import { getYahooSession } from "@/lib/fundamentalsUtils";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Tickers that match these patterns are definitely junk — no API call needed
function isObviousJunk(ticker: string): boolean {
  if (/[.\s_+&|,;:@#%^*(){}<>[\]/\\]/.test(ticker)) return true; // special chars / dots / spaces
  if (ticker.length > 6) return true;                              // US tickers are max 5-6 chars
  if (/[a-z]/.test(ticker)) return true;                          // lowercase = company name, not ticker
  return false;
}

async function polygonLookup(ticker: string, apiKey: string): Promise<{ name: string | null; sector: string | null }> {
  try {
    const res = await fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`);
    if (!res.ok) return { name: null, sector: null };
    const json = await res.json();
    const r = json?.results as Record<string, unknown> | undefined;
    return {
      name:   typeof r?.name     === "string" ? cleanCompanyName(r.name)              : null,
      sector: typeof r?.sic_code === "string" ? sectorFromPolygon(ticker, r.sic_code) : null,
    };
  } catch { return { name: null, sector: null }; }
}

async function yahooLookup(ticker: string, session: { cookie: string; crumb: string }): Promise<{ name: string | null; sector: string | null }> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=quoteType,assetProfile&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: session.cookie } });
    if (!res.ok) return { name: null, sector: null };
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] as Record<string, unknown> | undefined;
    const qt = result?.quoteType    as Record<string, unknown> | undefined;
    const ap = result?.assetProfile as Record<string, unknown> | undefined;
    const rawName   = typeof qt?.longName === "string" ? qt.longName : typeof qt?.shortName === "string" ? qt.shortName : null;
    const rawSector = typeof ap?.sector   === "string" ? ap.sector : null;
    return {
      name:   rawName   ? cleanCompanyName(rawName)          : null,
      sector: rawSector ? (YAHOO_TO_GICS[rawSector] ?? null) : null,
    };
  } catch { return { name: null, sector: null }; }
}

/**
 * GET  — dry run: returns what would be deleted/fixed without making changes
 * POST — executes the cleanup
 *
 * Only targets nodes where company_name = ticker AND sector = ''.
 * Obvious junk (special chars, lowercase, length > 6) deleted immediately.
 * Ambiguous tickers validated one-at-a-time against Polygon then Yahoo with delays.
 */
export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runCleanup(req, true);
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return runCleanup(req, false);
}

// Company names that indicate a fund/ETF/ETN rather than an individual stock
function isEtfName(name: string): boolean {
  const n = name.toUpperCase();
  return n.includes(" ETF") || n.includes(" ETN") || n.endsWith(" ETF") || n.endsWith(" ETN")
    || n.includes("EXCHANGE TRADED") || n.includes("LEVERAGED ETN");
}

async function runCleanup(req: NextRequest, dryRun: boolean) {
  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  // First: remove ETF/ETN nodes by name pattern regardless of sector
  const { data: allStocks } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name")
    .eq("node_type", "stock")
    .limit(50000);

  const etfNodes = (allStocks ?? []).filter(
    (n: { ticker: string; company_name: string }) => n.company_name && isEtfName(n.company_name)
  ) as Array<{ id: string; ticker: string }>;

  if (!dryRun && etfNodes.length > 0) {
    for (const { ticker } of etfNodes) {
      await supabaseAdmin.from("admin_connections").delete().or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`);
    }
    await supabaseAdmin.from("admin_nodes").delete().in("id", etfNodes.map(n => n.id));
  }

  const { data: rawNodes } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name")
    .eq("node_type", "stock")
    .eq("sector", "")
    .limit(2000);

  const candidates = (rawNodes ?? []).filter(
    (n: { ticker: string; company_name: string }) => n.company_name === n.ticker,
  ) as Array<{ id: string; ticker: string }>;

  const obviousJunk  = candidates.filter(({ ticker }) => isObviousJunk(ticker));
  const ambiguous    = candidates.filter(({ ticker }) => !isObviousJunk(ticker));

  const yahooSession = await getYahooSession();

  const apiFixed:   string[] = [];
  const apiDeleted: string[] = [];

  // Validate ambiguous tickers one at a time with a 300ms gap to avoid rate limits
  for (const { id, ticker } of ambiguous) {
    let { name, sector } = await polygonLookup(ticker, polygonKey);
    if (!name && yahooSession) {
      const y = await yahooLookup(ticker, yahooSession);
      if (y.name) { name = y.name; sector = y.sector; }
    }

    if (dryRun) {
      if (name) apiFixed.push(ticker); else apiDeleted.push(ticker);
    } else {
      if (name) {
        await supabaseAdmin.from("admin_nodes").update({ company_name: name, sector: sector ?? "" }).eq("id", id);
        apiFixed.push(ticker);
      } else {
        await supabaseAdmin.from("admin_connections").delete().or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`);
        await supabaseAdmin.from("admin_nodes").delete().eq("id", id);
        apiDeleted.push(ticker);
      }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  if (!dryRun) {
    // Delete obvious junk in bulk
    const junkIds = obviousJunk.map(({ id }) => id);
    if (junkIds.length > 0) {
      for (const { ticker } of obviousJunk) {
        await supabaseAdmin.from("admin_connections").delete().or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`);
      }
      await supabaseAdmin.from("admin_nodes").delete().in("id", junkIds);
    }
  }

  return NextResponse.json({
    dryRun,
    etfsRemoved: etfNodes.map(({ ticker }) => ticker),
    candidates: candidates.length,
    obviousJunk: obviousJunk.map(({ ticker }) => ticker),
    apiFixed,
    apiDeleted,
    summary: `${etfNodes.length} ETFs/ETNs removed · ${obviousJunk.length} obvious junk · ${apiFixed.length} API fixed · ${apiDeleted.length} API deleted`,
  });
}
