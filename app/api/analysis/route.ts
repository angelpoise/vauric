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
//   -- admin_stocks must also have:
//   --   analysis_schedule TEXT DEFAULT 'weekly'
//   --   last_visited_at   TIMESTAMPTZ
//   --   visit_count       INTEGER DEFAULT 0

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";
import { generateAnalysis, saveAnalysis } from "@/lib/generateAnalysis";

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const { data: cached } = await supabaseAdmin
    .from("company_analysis")
    .select("segments, margins, guidance, relationships, last_generated_at")
    .eq("ticker", ticker)
    .single();

  console.log(
    `[analysis] ticker=${ticker}`,
    `cached=${cached ? "yes" : "no"}`,
    `last_generated_at=${(cached as { last_generated_at?: string } | null)?.last_generated_at ?? "n/a"}`,
    `path=${cached ? "cache-hit" : "generate"}`,
  );

  // Cache hit — always return if row exists (no TTL, schedule handles refresh)
  if (cached) {
    return NextResponse.json({
      segments:          cached.segments,
      margins:           cached.margins,
      guidance:          cached.guidance,
      relationships:     cached.relationships,
      last_generated_at: cached.last_generated_at,
    });
  }

  // No cache — generate synchronously
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
