import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { getYahooSession } from "@/lib/fundamentalsUtils";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Yahoo Finance sector names → GICS display names used in the DB
const YAHOO_TO_GICS: Record<string, string> = {
  "Technology":             "Information Technology",
  "Healthcare":             "Healthcare",
  "Financial Services":     "Financials",
  "Consumer Cyclical":      "Consumer Discretionary",
  "Consumer Defensive":     "Consumer Staples",
  "Communication Services": "Communication Services",
  "Energy":                 "Energy",
  "Industrials":            "Industrials",
  "Basic Materials":        "Materials",
  "Real Estate":            "Real Estate",
  "Utilities":              "Utilities",
};

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "Missing ticker" }, { status: 400 });

  try {
    const session = await getYahooSession();
    if (!session) return NextResponse.json({ name: null, sector: null });

    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=quoteType,assetProfile&crumb=${encodeURIComponent(session.crumb)}`;

    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: session.cookie },
    });
    if (!res.ok) return NextResponse.json({ name: null, sector: null });

    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] as Record<string, unknown> | null | undefined;

    const qt = result?.quoteType as Record<string, unknown> | null | undefined;
    const ap = result?.assetProfile as Record<string, unknown> | null | undefined;

    const name = (typeof qt?.longName === "string" ? qt.longName : null)
      ?? (typeof qt?.shortName === "string" ? qt.shortName : null);

    const rawSector = typeof ap?.sector === "string" ? ap.sector : null;
    const sector = rawSector ? (YAHOO_TO_GICS[rawSector] ?? rawSector) : null;

    return NextResponse.json({ name, sector });
  } catch {
    return NextResponse.json({ name: null, sector: null });
  }
}
