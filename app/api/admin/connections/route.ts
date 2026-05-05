import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("admin_connections").select("*").order("ticker_a");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ticker_a, ticker_b } = await req.json();
  if (!ticker_a || !ticker_b) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const a = (ticker_a as string).toUpperCase();
  const b = (ticker_b as string).toUpperCase();
  // Delete either ordering of the connection
  const { error } = await supabaseAdmin
    .from("admin_connections")
    .delete()
    .or(`and(ticker_a.eq.${a},ticker_b.eq.${b}),and(ticker_a.eq.${b},ticker_b.eq.${a})`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ticker_a, ticker_b } = await req.json();
  if (!ticker_a || !ticker_b) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("admin_connections")
    .insert({ ticker_a: ticker_a.toUpperCase(), ticker_b: ticker_b.toUpperCase() })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

