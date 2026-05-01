import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300;

export async function GET() {
  const [stocksRes, connectionsRes] = await Promise.all([
    supabase
      .from("admin_stocks")
      .select("ticker, company_name, sector, x_position, y_position")
      .order("ticker"),
    supabase
      .from("admin_connections")
      .select("ticker_a, ticker_b")
      .order("ticker_a"),
  ]);

  if (stocksRes.error || connectionsRes.error) {
    return NextResponse.json({ error: "Failed to load graph data" }, { status: 500 });
  }

  return NextResponse.json({
    stocks: stocksRes.data,
    connections: connectionsRes.data,
  });
}
