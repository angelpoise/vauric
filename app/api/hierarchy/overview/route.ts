import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateOverview } from "@/lib/generateOverview";

export async function POST(req: NextRequest) {
  const { nodeId, parentName } = await req.json() as { nodeId?: string; parentName?: string };
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });

  const { data: node } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, cached_overview")
    .eq("id", nodeId)
    .maybeSingle();

  if (!node) return NextResponse.json({ error: "node not found" }, { status: 404 });

  // Return existing cache immediately if present
  if (node.cached_overview) {
    return NextResponse.json({ overview: node.cached_overview, cached: true });
  }

  // Generate and cache
  const overview = await generateOverview(
    node as Parameters<typeof generateOverview>[0],
    parentName,
  );
  return NextResponse.json({ overview, cached: false });
}

// DELETE — clear cached overview (admin)
export async function DELETE(req: NextRequest) {
  const nodeId = req.nextUrl.searchParams.get("nodeId");
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  await supabaseAdmin
    .from("admin_nodes")
    .update({ cached_overview: null, cached_overview_generated_at: null })
    .eq("id", nodeId);
  return NextResponse.json({ ok: true });
}
