// Required Supabase table:
//
//   CREATE TABLE manual_notifications (
//     id                BIGSERIAL PRIMARY KEY,
//     ticker            TEXT NOT NULL,
//     notification_type TEXT NOT NULL,
//     note              TEXT,
//     created_at        TIMESTAMPTZ DEFAULT NOW()
//   );

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("manual_notifications").select("*").order("ticker").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

const VALID_NOTIF_TYPES = new Set([
  "news", "analyst", "squeeze", "delisting", "split", "earnings", "ipo",
]);

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ticker, notification_type, note } = await req.json();
  if (!ticker || !notification_type) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (!VALID_NOTIF_TYPES.has(notification_type)) {
    return NextResponse.json(
      { error: `Invalid notification_type. Must be one of: ${Array.from(VALID_NOTIF_TYPES).join(", ")}` },
      { status: 400 }
    );
  }
  const safeNote = typeof note === "string" ? note.slice(0, 500) : null;
  const { data, error } = await supabaseAdmin.from("manual_notifications").insert({ ticker: ticker.toUpperCase(), notification_type, note: safeNote }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("manual_notifications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
