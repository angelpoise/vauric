// company_analysis schema (ticker is any node identifier — stock ticker, ETF ticker, or node name):
//
//   CREATE TABLE company_analysis (
//     ticker            TEXT PRIMARY KEY,
//     segments          TEXT,
//     margins           TEXT,
//     guidance          TEXT,
//     relationships     TEXT,
//     last_generated_at TIMESTAMPTZ DEFAULT NOW()
//   );
//
//   -- admin_nodes must also have:
//   --   analysis_schedule TEXT DEFAULT 'weekly'
//   --   last_visited_at   TIMESTAMPTZ
//   --   visit_count       INTEGER DEFAULT 0

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";
import { generateAnalysis, saveAnalysis } from "@/lib/generateAnalysis";

// Resolve node type for a given identifier so the right prompt is used.
async function resolveNodeType(id: string): Promise<{ nodeType: "stock" | "sector" | "subsector" | "subsubsector"; displayName: string }> {
  const { data } = await supabaseAdmin
    .from("admin_nodes")
    .select("node_type, company_name, display_name, ticker, etf_ticker")
    .or(`ticker.eq.${id},etf_ticker.eq.${id},company_name.eq.${id}`)
    .maybeSingle();

  if (!data) return { nodeType: "stock", displayName: id };
  const displayName = data.display_name ?? data.company_name ?? data.etf_ticker ?? data.ticker ?? id;
  return {
    nodeType: data.node_type as "stock" | "sector" | "subsector" | "subsubsector",
    displayName,
  };
}

export async function GET(req: NextRequest) {
  // ticker is the analysis cache key — can be a stock ticker (NVDA), ETF ticker (XLK/SOXX),
  // or a hierarchy node name (Semiconductors). Do NOT force uppercase — names are case-sensitive.
  const ticker = req.nextUrl.searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const readonly = req.nextUrl.searchParams.get("readonly") === "true";

  const { data: cached } = await supabaseAdmin
    .from("company_analysis")
    .select("segments, margins, guidance, relationships, last_generated_at")
    .eq("ticker", ticker)
    .single();

  console.log(
    `[analysis] ticker=${ticker} readonly=${readonly}`,
    `cached=${cached ? "yes" : "no"}`,
    `path=${cached ? "cache-hit" : readonly ? "no-cache-readonly" : "generate"}`,
  );

  if (cached) {
    return NextResponse.json({
      segments:          cached.segments,
      margins:           cached.margins,
      guidance:          cached.guidance,
      relationships:     cached.relationships,
      last_generated_at: cached.last_generated_at,
    });
  }

  if (readonly) return NextResponse.json({ cached: false });

  // Determine node type so the right prompt is used
  const { nodeType, displayName } = await resolveNodeType(ticker);
  console.log(`[analysis] generating for ${ticker} nodeType=${nodeType}`);

  const analysis = await generateAnalysis(ticker, nodeType, displayName);
  if (!analysis) return NextResponse.json({ error: "Analysis generation failed" }, { status: 500 });
  await saveAnalysis(ticker, analysis);
  return NextResponse.json({ ...analysis, last_generated_at: new Date().toISOString() });
}

export async function DELETE(req: NextRequest) {
  const hasAuth     = !!req.headers.get("authorization");
  const hasPipeline = req.headers.get("x-pipeline-secret") === process.env.PIPELINE_SECRET;
  if (!hasAuth && !hasPipeline) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (hasAuth && !await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticker = req.nextUrl.searchParams.get("ticker")?.trim();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  await supabaseAdmin.from("company_analysis").delete().eq("ticker", ticker);
  return NextResponse.json({ ok: true });
}
