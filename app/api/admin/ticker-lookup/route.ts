import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { cleanCompanyName, sectorFromPolygon } from "@/lib/tickerLookupUtils";

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

    const rawName = typeof result?.name     === "string" ? result.name     : null;
    const sicCode = typeof result?.sic_code === "string" ? result.sic_code : null;

    const name   = rawName ? cleanCompanyName(rawName) : null;
    const sector = sectorFromPolygon(ticker, sicCode);

    return NextResponse.json({ name, sector });
  } catch {
    return NextResponse.json({ name: null, sector: null });
  }
}
