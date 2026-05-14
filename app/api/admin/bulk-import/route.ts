import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, sectorFromPolygon } from "@/lib/tickerLookupUtils";
import { hydrateSingleTicker } from "@/lib/fundamentalsUtils";

interface PolygonResult {
  name?: string;
  sic_code?: string;
}

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
    const r = json?.results as PolygonResult | undefined;
    const name   = r?.name   ? cleanCompanyName(r.name)           : null;
    const sector = sectorFromPolygon(ticker, r?.sic_code ?? null);
    return { name, sector };
  } catch {
    return { name: null, sector: null };
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ error: "POLYGON_API_KEY not set" }, { status: 500 });

  const { tickers } = await req.json() as { tickers: string[] };
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return NextResponse.json({ error: "tickers array required" }, { status: 400 });
  }

  // Fetch existing tickers to skip duplicates
  const { data: existing } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker")
    .eq("node_type", "stock");
  const existingSet = new Set((existing ?? []).map((r: { ticker: string }) => r.ticker));

  const toAdd = Array.from(new Set(tickers.map((t) => t.toUpperCase().trim()).filter(Boolean)))
    .filter((t) => !existingSet.has(t));

  const added: string[]   = [];
  const skipped: string[] = tickers.filter((t) => existingSet.has(t.toUpperCase().trim()));
  const failed: string[]  = [];

  const CONCURRENCY = 4;

  for (let i = 0; i < toAdd.length; i += CONCURRENCY) {
    const batch = toAdd.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (ticker) => {
        const { name, sector } = await polygonLookup(ticker, polygonKey);
        const { error } = await supabaseAdmin.from("admin_nodes").insert({
          node_type:         "stock",
          ticker,
          company_name:      name   ?? ticker,
          sector:            sector ?? "",
          x_position:        0.5,
          y_position:        0.5,
          analysis_schedule: "weekly",
          scenario_schedule: "weekly",
        });
        if (error) {
          failed.push(ticker);
        } else {
          added.push(ticker);
          hydrateSingleTicker(ticker).catch(() => {});
        }
      }),
    );
  }

  return NextResponse.json({ added, skipped, failed });
}
