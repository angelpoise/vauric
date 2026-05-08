// Required Supabase schema:
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

export async function GET(req: NextRequest) {
  const ticker   = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  // readonly=true — only return cached content, never generate.
  // StockDetail always calls with this param; generation is scheduled-only.
  const readonly = req.nextUrl.searchParams.get("readonly") === "true";

  const { data: cached } = await supabaseAdmin
    .from("company_analysis")
    .select("segments, margins, guidance, relationships, last_generated_at")
    .eq("ticker", ticker)
    .single();

  console.log(
    `[analysis] ticker=${ticker} readonly=${readonly}`,
    `cached=${cached ? "yes" : "no"}`,
    `last_generated_at=${(cached as { last_generated_at?: string } | null)?.last_generated_at ?? "n/a"}`,
    `path=${cached ? "cache-hit" : readonly ? "no-cache-readonly" : "generate"}`,
  );

  // Cache hit — return immediately regardless of readonly flag
  if (cached) {
    return NextResponse.json({
      segments:          cached.segments,
      margins:           cached.margins,
      guidance:          cached.guidance,
      relationships:     cached.relationships,
      last_generated_at: cached.last_generated_at,
    });
  }

  // No cache + readonly — tell the client to show the "being prepared" message
  if (readonly) {
    return NextResponse.json({ cached: false });
  }

  // No cache + not readonly — generate (admin panel / scheduled route only)
  const analysis = await generateAnalysis(ticker);
  if (!analysis) return NextResponse.json({ error: "Analysis generation failed" }, { status: 500 });
  await saveAnalysis(ticker, analysis);
  return NextResponse.json({ ...analysis, last_generated_at: new Date().toISOString() });
}

// DELETE — clear cached analysis (admin only, or internal pipeline)
export async function DELETE(req: NextRequest) {
  const hasAuth    = !!req.headers.get("authorization");
  const hasPipeline = req.headers.get("x-pipeline-secret") === process.env.PIPELINE_SECRET;
  if (!hasAuth && !hasPipeline) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (hasAuth && !await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  await supabaseAdmin.from("company_analysis").delete().eq("ticker", ticker);
  return NextResponse.json({ ok: true });
}
