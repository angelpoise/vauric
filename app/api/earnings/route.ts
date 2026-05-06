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

interface EdgarHit {
  _id: string;
  _source: {
    period_of_report?: string;
    form_type?: string;
    file_date?: string;
    display_date_filed?: string;
    entity_id?: string;
    accession_no?: string;
  };
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

function buildFilingUrl(hit: EdgarHit): string {
  const { entity_id, accession_no } = hit._source;
  if (entity_id && accession_no) {
    const acc = accession_no.replace(/-/g, "");
    return `https://www.sec.gov/Archives/edgar/data/${entity_id}/${acc}/`;
  }
  // Fallback: link to EDGAR search
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${hit._source.entity_id ?? ""}&type=${hit._source.form_type ?? ""}&dateb=&owner=include&count=10`;
}

async function fetchEdgarFilings(ticker: string): Promise<EarningsRow[]> {
  const today       = fmt(new Date());
  const oneYearAgo  = fmt(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

  try {
    const url =
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(ticker)}%22` +
      `&dateRange=custom&startdt=${oneYearAgo}&enddt=${today}&forms=10-K,10-Q`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Vauric/1.0 contact@vauric.com" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const json = await res.json();
    const hits: EdgarHit[] = json?.hits?.hits ?? [];

    return hits.map((h) => ({
      filing_type: h._source.form_type ?? "10-K",
      period:      h._source.period_of_report ?? null,
      filing_date: h._source.file_date ?? h._source.display_date_filed ?? "",
      filing_url:  buildFilingUrl(h),
    })).filter((r) => r.filing_date);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // 1. Manual/curated earnings from the database
  const { data: manual } = await supabase
    .from("earnings")
    .select("filing_type, period, filing_date, filing_url")
    .eq("ticker", ticker)
    .order("filing_date", { ascending: false })
    .limit(10);

  const manualRows: EarningsRow[] = (manual ?? []) as EarningsRow[];

  // 2. Auto-fetch from SEC EDGAR
  const edgarRows = await fetchEdgarFilings(ticker);

  // 3. Merge and deduplicate by filing_url
  const seen = new Set(manualRows.map((r) => r.filing_url));
  const merged: EarningsRow[] = [...manualRows];
  for (const row of edgarRows) {
    if (!seen.has(row.filing_url)) {
      seen.add(row.filing_url);
      merged.push(row);
    }
  }

  // Sort descending by date, return top 10
  merged.sort((a, b) => b.filing_date.localeCompare(a.filing_date));

  return NextResponse.json(merged.slice(0, 10));
}
