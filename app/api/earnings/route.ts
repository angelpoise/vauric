// Required Supabase schema:
//
//   CREATE TABLE earnings (
//     id           BIGSERIAL PRIMARY KEY,
//     ticker       TEXT NOT NULL,
//     filing_type  TEXT NOT NULL,  -- '10-K' or '10-Q'
//     period       TEXT,           -- e.g. 'Q1 2026'
//     filing_date  DATE NOT NULL,
//     filing_url   TEXT NOT NULL,
//     created_at   TIMESTAMPTZ DEFAULT NOW()
//   );

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface EarningsRow {
  filing_type: string;
  period: string | null;
  filing_date: string;
  filing_url: string;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const { data } = await supabase
    .from("earnings")
    .select("filing_type, period, filing_date, filing_url")
    .eq("ticker", ticker)
    .order("filing_date", { ascending: false })
    .limit(10);

  return NextResponse.json((data ?? []) as EarningsRow[]);
}
