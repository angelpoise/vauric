import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";
import { hydrateSingleTicker } from "@/lib/fundamentalsUtils";

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("admin_stocks").select("*").order("ticker");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { ticker, company_name, sector, x_position, y_position, investor_relations_url } = body;
  if (!ticker || !company_name || !sector) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("admin_stocks")
    .insert({
      ticker: ticker.toUpperCase(), company_name, sector,
      x_position: x_position ?? 0.5, y_position: y_position ?? 0.5,
      ...(investor_relations_url ? { investor_relations_url } : {}),
    })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget: pre-warm the fundamentals cache for the new ticker so its
  // detail page and AI analysis have real data immediately without waiting for
  // the next full fundamentals refresh.
  hydrateSingleTicker(ticker.toUpperCase()).catch((err) =>
    console.error(`[admin/stocks] fundamentals hydration failed for ${ticker}:`, err)
  );

  revalidatePath("/api/graph");
  revalidatePath("/graph");
  revalidatePath("/api/fundamentals");

  return NextResponse.json(data, { status: 201 });
}

