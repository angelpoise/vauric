import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";
import { clerkClient } from "@clerk/nextjs/server";

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [
    nodeCountsRes,
    t1Res, t2Res, t3Res,
    articlesRes,
    configRes,
    focusListsRes,
    analysisRes,
  ] = await Promise.all([
    supabaseAdmin.from("admin_nodes").select("node_type"),
    supabaseAdmin.from("admin_connections").select("id", { count: "exact", head: true }).eq("tier", 1),
    supabaseAdmin.from("admin_connections").select("id", { count: "exact", head: true }).eq("tier", 2),
    supabaseAdmin.from("admin_connections").select("id", { count: "exact", head: true }).eq("tier", 3),
    supabaseAdmin.from("news").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("pipeline_config").select("news_pipeline_enabled, last_run_at").eq("id", 1).single(),
    supabaseAdmin.from("focus_lists").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("admin_nodes").select("id", { count: "exact", head: true })
      .eq("node_type", "stock").not("cached_overview", "is", null),
  ]);

  // Node counts by type
  const nodes = nodeCountsRes.data ?? [];
  const nodeCounts = { stock: 0, sector: 0, subsector: 0, subsubsector: 0 };
  for (const n of nodes) {
    if (n.node_type in nodeCounts) nodeCounts[n.node_type as keyof typeof nodeCounts]++;
  }

  // Stocks with no T1 connections
  const t1ConnsRes = await supabaseAdmin
    .from("admin_connections")
    .select("ticker_a, ticker_b")
    .eq("tier", 1);
  const stocksRes = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker")
    .eq("node_type", "stock");

  const hasT1 = new Set<string>();
  for (const c of t1ConnsRes.data ?? []) {
    hasT1.add(c.ticker_a);
    hasT1.add(c.ticker_b);
  }
  const stocksWithNoT1 = (stocksRes.data ?? []).filter(s => s.ticker && !hasT1.has(s.ticker)).length;

  // Clerk user stats
  let clerkTotal = 0, clerkPro = 0, clerkPlus = 0;
  try {
    const client = await clerkClient();
    const result = await client.users.getUserList({ limit: 500 });
    clerkTotal = result.totalCount;
    for (const u of result.data) {
      if (u.publicMetadata?.isPro) clerkPro++;
      else if (u.publicMetadata?.isPlus) clerkPlus++;
    }
  } catch {
    clerkTotal = -1;
  }

  return NextResponse.json({
    nodes: nodeCounts,
    connections: {
      t1: t1Res.count ?? 0,
      t2: t2Res.count ?? 0,
      t3: t3Res.count ?? 0,
      stocksNoT1: stocksWithNoT1,
    },
    news: {
      articles:        articlesRes.count ?? 0,
      pipelineEnabled: configRes.data?.news_pipeline_enabled ?? null,
      lastRunAt:       configRes.data?.last_run_at ?? null,
    },
    analysis: {
      withCache: analysisRes.count ?? 0,
      total:     nodeCounts.stock,
    },
    users: {
      total: clerkTotal,
      pro:   clerkPro,
      plus:  clerkPlus,
      free:  clerkTotal >= 0 ? clerkTotal - clerkPro - clerkPlus : -1,
    },
    focusLists: focusListsRes.count ?? 0,
  });
}
