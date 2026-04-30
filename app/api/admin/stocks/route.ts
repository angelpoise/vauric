// Required Supabase table:
//
//   CREATE TABLE admin_stocks (
//     id         BIGSERIAL PRIMARY KEY,
//     ticker     TEXT UNIQUE NOT NULL,
//     name       TEXT NOT NULL,
//     sector_id  TEXT NOT NULL,
//     x          FLOAT NOT NULL DEFAULT 500,
//     y          FLOAT NOT NULL DEFAULT 500,
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/lib/adminAuth";

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("admin_stocks").select("*").order("ticker");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { ticker, name, sector_id, x, y } = body;
  if (!ticker || !name || !sector_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const { data, error } = await supabaseAdmin.from("admin_stocks").insert({ ticker: ticker.toUpperCase(), name, sector_id, x: x ?? 500, y: y ?? 500 }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
