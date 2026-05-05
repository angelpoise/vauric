import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { data, error } = await supabaseAdmin.from("admin_stocks").update(body).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — updates x_position/y_position by ticker (used by graph edit mode)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isNumericId = /^\d+$/.test(params.id);
  const query = isNumericId
    ? supabaseAdmin.from("admin_stocks").delete().eq("id", params.id)
    : supabaseAdmin.from("admin_stocks").delete().eq("ticker", params.id.toUpperCase());
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
