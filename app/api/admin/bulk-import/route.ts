import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cleanCompanyName, sectorFromPolygon } from "@/lib/tickerLookupUtils";
import { hydrateSingleTicker } from "@/lib/fundamentalsUtils";

interface PolygonResult {
  name?: string;
  sic_code?: string;
}

// Maps sector display name → ETF ticker used as sector node ID in the graph
const SECTOR_TO_ETF: Record<string, string> = {
  "Information Technology": "XLK",
  "Energy":                 "XLE",
  "Healthcare":             "XLV",
  "Financials":             "XLF",
  "Industrials":            "XLI",
  "Consumer Staples":       "XLP",
  "Consumer Discretionary": "XLY",
  "Communication Services": "XLC",
  "Materials":              "XLB",
  "Real Estate":            "XLRE",
  "Utilities":              "XLU",
};

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

// Place stock near its sector node with a random spread.
// Returns normalised x/y (0–1) ready for the DB.
function positionNearSector(
  sector: string | null,
  sectorPositions: Map<string, { x: number; y: number }>,
): { x: number; y: number } {
  const etf  = sector ? SECTOR_TO_ETF[sector] : null;
  const base = etf ? sectorPositions.get(etf) : null;
  if (!base) return { x: 0.5, y: 0.5 };

  const angle  = Math.random() * 2 * Math.PI;
  const radius = 0.07 + Math.random() * 0.12; // 0.07–0.19 normalised units
  return {
    x: Math.max(0.02, Math.min(0.98, base.x + Math.cos(angle) * radius)),
    y: Math.max(0.02, Math.min(0.98, base.y + Math.sin(angle) * radius)),
  };
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

  // Fetch sector node positions so new stocks can be placed near their sector
  const { data: sectorNodes } = await supabaseAdmin
    .from("admin_nodes")
    .select("etf_ticker, x_position, y_position")
    .eq("node_type", "sector");

  const sectorPositions = new Map<string, { x: number; y: number }>();
  for (const s of sectorNodes ?? []) {
    if (s.etf_ticker) sectorPositions.set(s.etf_ticker, { x: s.x_position, y: s.y_position });
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
        const pos = positionNearSector(sector, sectorPositions);
        const { error } = await supabaseAdmin.from("admin_nodes").insert({
          node_type:         "stock",
          ticker,
          company_name:      name   ?? ticker,
          sector:            sector ?? "",
          x_position:        pos.x,
          y_position:        pos.y,
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
