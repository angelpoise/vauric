import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";

export async function GET(req: NextRequest) {
  const { userId, isPro } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPro) return NextResponse.json([]);

  const { data, error } = await supabaseAdmin
    .from("focus_lists")
    .select("id, name, tickers, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { userId, isPro } = await verifyClerkTokenWithTier(req.headers.get("authorization"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPro) return NextResponse.json({ error: "Pro required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { name, tickers } = body ?? {};
  if (!name || !Array.isArray(tickers)) {
    return NextResponse.json({ error: "name and tickers required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("focus_lists")
    .insert({ user_id: userId, name: String(name).trim(), tickers })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
