import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

const ALLOWED_PUT_FIELDS = new Set([
  // stock fields
  "ticker", "company_name", "sector", "x_position", "y_position", "investor_relations_url",
  // hierarchy fields
  "node_type", "display_name", "etf_ticker", "colour", "parent_node_id", "tags",
]);

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.json();
  const body = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([k]) => ALLOWED_PUT_FIELDS.has(k))
  );
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("admin_nodes")
    .update(body)
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/api/graph");
  return NextResponse.json(data);
}

// PATCH — partial update by ticker (stocks) or id (hierarchy)
const ALLOWED_PATCH_FIELDS = new Set([
  "x_position", "y_position", "analysis_schedule", "scenario_schedule",
  "colour", "etf_ticker", "display_name", "parent_node_id", "tags",
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.json();
  const body = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([k]) => ALLOWED_PATCH_FIELDS.has(k))
  );
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  // Resolve the target row in priority order:
  //   UUID        → match admin_nodes.id directly
  //   uppercase   → match admin_nodes.ticker (stocks)
  //   uppercase   → match admin_nodes.etf_ticker (sectors)
  //   as-is       → match admin_nodes.company_name (subsectors/subsubsectors)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(params.id);
  let targetId: string | null = null;

  if (isUUID) {
    targetId = params.id;
  } else {
    const upper = params.id.toUpperCase();

    // 1. Stock ticker
    const { data: byTicker } = await supabaseAdmin
      .from("admin_nodes").select("id").eq("ticker", upper).maybeSingle();
    if (byTicker) {
      targetId = byTicker.id as string;
    } else {
      // 2. Sector ETF ticker
      const { data: byEtf } = await supabaseAdmin
        .from("admin_nodes").select("id").eq("etf_ticker", upper).maybeSingle();
      if (byEtf) {
        targetId = byEtf.id as string;
      } else {
        // 3. Sub-sector / sub-sub-sector company_name (case-sensitive, as stored)
        const { data: byName } = await supabaseAdmin
          .from("admin_nodes").select("id").eq("company_name", params.id).maybeSingle();
        if (byName) targetId = byName.id as string;
      }
    }
  }

  if (!targetId) {
    console.error(`[admin/nodes PATCH] node not found for id=${params.id}`);
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("admin_nodes").update(body).eq("id", targetId);
  if (error) {
    console.error(`[admin/nodes PATCH] id=${params.id} error:`, JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  revalidatePath("/api/graph");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(params.id);
  const query = isUUID
    ? supabaseAdmin.from("admin_nodes").delete().eq("id", params.id)
    : /^\d+$/.test(params.id)
      ? supabaseAdmin.from("admin_nodes").delete().eq("id", params.id)
      : supabaseAdmin.from("admin_nodes").delete().eq("ticker", params.id.toUpperCase());
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/api/graph");
  revalidatePath("/graph");
  return NextResponse.json({ success: true });
}
