import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, sectorFromPolygon } from "@/lib/tickerLookupUtils";

async function polygonLookup(
  ticker: string,
  apiKey: string,
): Promise<{ name: string | null; sector: string | null }> {
  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${apiKey}`,
    );
    if (!res.ok) return { name: null, sector: null };
    const json = await res.json();
    const r = json?.results as Record<string, unknown> | undefined;
    return {
      name:   typeof r?.name     === "string" ? cleanCompanyName(r.name)              : null,
      sector: typeof r?.sic_code === "string" ? sectorFromPolygon(ticker, r.sic_code) : null,
    };
  } catch {
    return { name: null, sector: null };
  }
}

/**
 * POST — scans all stock nodes where company_name = ticker AND sector = ''
 * (the fingerprint of a failed Polygon lookup at import time).
 * Valid tickers get their name + sector corrected; invalid ones are deleted
 * along with their connections.
 */
export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  const { data: rawNodes } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name")
    .eq("node_type", "stock")
    .eq("sector", "")
    .limit(2000);

  // Only nodes where name was never resolved (company_name still equals ticker)
  const candidates = (rawNodes ?? []).filter(
    (n: { ticker: string; company_name: string }) => n.company_name === n.ticker,
  ) as Array<{ id: string; ticker: string }>;

  const updated: string[] = [];
  const deleted: string[]  = [];
  const CONCURRENCY = 4;

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async ({ id, ticker }) => {
      const { name, sector } = await polygonLookup(ticker, polygonKey);
      if (name) {
        await supabaseAdmin
          .from("admin_nodes")
          .update({ company_name: name, sector: sector ?? "" })
          .eq("id", id);
        updated.push(ticker);
      } else {
        await supabaseAdmin
          .from("admin_connections")
          .delete()
          .or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`);
        await supabaseAdmin
          .from("admin_nodes")
          .delete()
          .eq("id", id);
        deleted.push(ticker);
      }
    }));
  }

  return NextResponse.json({ candidates: candidates.length, updated: updated.length, deleted: deleted.length });
}
