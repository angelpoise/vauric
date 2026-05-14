import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";

// Polygon SIC code prefix → GICS sector display name
// SIC major groups: https://www.osha.gov/data/sic-manual
const SIC_TO_GICS: Array<[number, number, string]> = [
  [100,   999,  "Materials"],           // Mining
  [1000,  1499, "Materials"],           // Metal mining / coal
  [1500,  1799, "Industrials"],         // Construction
  [2000,  2099, "Consumer Staples"],    // Food
  [2100,  2199, "Consumer Staples"],    // Tobacco
  [2200,  2399, "Consumer Discretionary"], // Textile / apparel
  [2400,  2799, "Materials"],           // Lumber, paper, printing
  [2800,  2829, "Materials"],           // Chemicals (industrial)
  [2830,  2836, "Healthcare"],          // Pharmaceutical preparations
  [2837,  2899, "Materials"],           // Misc chemicals
  [2900,  2999, "Energy"],              // Petroleum refining
  [3000,  3299, "Materials"],           // Rubber, stone, glass
  [3300,  3499, "Materials"],           // Primary metals
  [3500,  3599, "Industrials"],         // Industrial machinery
  [3600,  3679, "Information Technology"], // Electronic components
  [3680,  3699, "Information Technology"], // Semiconductors / electronics
  [3700,  3799, "Consumer Discretionary"], // Transportation equipment / autos
  [3800,  3841, "Healthcare"],          // Medical instruments / surgical
  [3842,  3851, "Healthcare"],          // Orthopedic / ophthalmic
  [3852,  3899, "Industrials"],         // Misc measuring instruments
  [3900,  3999, "Consumer Discretionary"], // Misc manufacturing
  [4000,  4599, "Industrials"],         // Transportation
  [4600,  4799, "Energy"],              // Pipelines / communications infra
  [4800,  4899, "Communication Services"], // Communications
  [4900,  4999, "Utilities"],           // Electric/gas/water utilities
  [5000,  5199, "Industrials"],         // Wholesale durable/non-durable
  [5200,  5999, "Consumer Discretionary"], // Retail
  [6000,  6199, "Financials"],          // Depository / credit
  [6200,  6299, "Financials"],          // Security brokers
  [6300,  6399, "Financials"],          // Insurance
  [6400,  6499, "Financials"],          // Insurance agents
  [6500,  6599, "Real Estate"],         // Real estate
  [6700,  6799, "Financials"],          // Holding companies
  [7000,  7299, "Consumer Discretionary"], // Hotels / services
  [7300,  7399, "Information Technology"], // Business services / IT
  [7500,  7599, "Consumer Discretionary"], // Auto repair / parking
  [7600,  7699, "Consumer Discretionary"], // Misc repair
  [7800,  7999, "Communication Services"], // Motion pictures / entertainment
  [8000,  8099, "Healthcare"],          // Health services
  [8100,  8299, "Industrials"],         // Legal / engineering services
  [8700,  8999, "Industrials"],         // Management / consulting
];

function sicToGics(sic: number): string | null {
  for (const [lo, hi, sector] of SIC_TO_GICS) {
    if (sic >= lo && sic <= hi) return sector;
  }
  return null;
}

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  const polygonKey = process.env.POLYGON_API_KEY;
  if (!polygonKey) return NextResponse.json({ name: null, sector: null });

  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${polygonKey}`,
    );
    if (!res.ok) return NextResponse.json({ name: null, sector: null });

    const json = await res.json();
    const result = json?.results as Record<string, unknown> | null | undefined;

    const name   = typeof result?.name        === "string" ? result.name        : null;
    const sicRaw = typeof result?.sic_code    === "string" ? result.sic_code    : null;
    const sic    = sicRaw ? parseInt(sicRaw, 10) : null;
    const sector = sic !== null && !isNaN(sic) ? sicToGics(sic) : null;

    return NextResponse.json({ name, sector });
  } catch {
    return NextResponse.json({ name: null, sector: null });
  }
}
