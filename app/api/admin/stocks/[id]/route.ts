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
  // UUIDs go by id; stock tickers go by ticker column
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(params.id);
  const query = isUUID
    ? supabaseAdmin.from("admin_nodes").update(body).eq("id", params.id)
    : supabaseAdmin.from("admin_nodes").update(body).eq("ticker", params.id.toUpperCase());
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
