import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const revalidate = 300;

export async function GET() {
  const [stocksRes, hierarchyRes, connectionsRes] = await Promise.all([
    supabase
      .from("admin_nodes")
      .select("ticker, company_name, sector, x_position, y_position, investor_relations_url")
      .eq("node_type", "stock")
      .order("ticker"),
    supabase
      .from("admin_nodes")
      .select("id, node_type, company_name, display_name, etf_ticker, colour, parent_node_id, x_position, y_position")
      .in("node_type", ["sector", "subsector", "subsubsector"])
      .order("node_type"),
    supabase
      .from("admin_connections")
      .select("ticker_a, ticker_b, tier")
      .order("ticker_a"),
  ]);

  if (stocksRes.error || hierarchyRes.error || connectionsRes.error) {
    return NextResponse.json({ error: "Failed to load graph data" }, { status: 500 });
  }

  return NextResponse.json({
    stocks:      stocksRes.data,
    hierarchy:   hierarchyRes.data,
    connections: connectionsRes.data,
  });
}
