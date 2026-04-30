import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [stocksRes, articlesRes, configRes] = await Promise.all([
    supabaseAdmin.from("admin_stocks").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("news").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("pipeline_config").select("news_pipeline_enabled, last_run_at").eq("id", 1).single(),
  ]);

  return NextResponse.json({
    stocks:          stocksRes.count ?? 0,
    sectors:         5,
    articles:        articlesRes.count ?? 0,
    pipelineEnabled: configRes.data?.news_pipeline_enabled ?? null,
    lastRunAt:       configRes.data?.last_run_at ?? null,
  });
}
