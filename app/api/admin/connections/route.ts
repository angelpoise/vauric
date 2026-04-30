// Required Supabase table:
//
//   CREATE TABLE admin_connections (
//     id         BIGSERIAL PRIMARY KEY,
//     source_id  TEXT NOT NULL,
//     target_id  TEXT NOT NULL,
//     created_at TIMESTAMPTZ DEFAULT NOW(),
//     UNIQUE(source_id, target_id)
//   );

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("admin_connections").select("*").order("source_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { source_id, target_id } = await req.json();
  if (!source_id || !target_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("admin_connections").insert({ source_id, target_id }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
