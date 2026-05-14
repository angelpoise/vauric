import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, sectorFromPolygon } from "@/lib/tickerLookupUtils";

export interface QualityIssue {
  ticker: string;
  currentName: string;
  currentSector: string;
  suggestedName: string | null;
  suggestedSector: string | null;
}

async function polygonLookup(
  ticker: string,
  apiKey: string,
): Promise<{ rawName: string | null; sicCode: string | null }> {
  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`,
    );
    if (!res.ok) return { rawName: null, sicCode: null };
    const json = await res.json();
    const r = json?.results as Record<string, unknown> | undefined;
    return {
      rawName: typeof r?.name     === "string" ? r.name     : null,
      sicCode: typeof r?.sic_code === "string" ? r.sic_code : null,
    };
  } catch {
    return { rawName: null, sicCode: null };
  }
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

  const issues: QualityIssue[] = [];
  const CONCURRENCY = 8;

  for (let i = 0; i < stocks.length; i += CONCURRENCY) {
    const batch = stocks.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (stock) => {
        const { rawName, sicCode } = await polygonLookup(stock.ticker, polygonKey);

        const suggestedName   = rawName ? cleanCompanyName(rawName) : null;
        const suggestedSector = sectorFromPolygon(stock.ticker, sicCode);

        const nameDiffers   = suggestedName   !== null && suggestedName   !== stock.company_name;
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
