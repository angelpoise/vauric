import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// Only these fields may be updated via the admin API
const ALLOWED_PUT_FIELDS = new Set([
  "ticker", "company_name", "sector", "x_position", "y_position",
]);

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const raw = await req.json();
  // Strip any fields not in the allowlist before passing to Supabase
  const body = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(([k]) => ALLOWED_PUT_FIELDS.has(k))
  );
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from("admin_stocks").update(body).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — updates x_position/y_position by ticker (used by graph edit mode)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { x_position, y_position } = await req.json();
  if (x_position === undefined || y_position === undefined) {
    return NextResponse.json({ error: "x_position and y_position are required" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("admin_stocks")
    .update({ x_position, y_position })
    .eq("ticker", params.id.toUpperCase());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — numeric [id] uses database PK; ticker string uses ticker column
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isNumericId = /^\d+$/.test(params.id);
  const query = isNumericId
    ? supabaseAdmin.from("admin_stocks").delete().eq("id", params.id)
    : supabaseAdmin.from("admin_stocks").delete().eq("ticker", params.id.toUpperCase());
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
