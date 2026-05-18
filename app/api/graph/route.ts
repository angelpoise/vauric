import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";

export const dynamic = 'force-dynamic';

export async function GET() {
  const [stocksRes, hierarchyRes, connectionsRes] = await Promise.all([
    supabase
      .from("admin_nodes")
      .select("ticker, company_name, sector, x_position, y_position, investor_relations_url")
      .eq("node_type", "stock")
      .order("ticker")
      .limit(5000),
    supabase
      .from("admin_nodes")
      .select("id, node_type, company_name, display_name, etf_ticker, colour, parent_node_id, x_position, y_position")
      .in("node_type", ["sector", "subsector", "subsubsector"])
      .order("node_type")
      .limit(2000),
    // Paginate to bypass Supabase project-level max_rows cap
    (async () => {
      const PAGE = 10000;
      const pages = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          supabase
            .from("admin_connections")
            .select("ticker_a, ticker_b, tier")
            .order("ticker_a")
            .range(i * PAGE, (i + 1) * PAGE - 1)
        )
      );
      const error = pages.find((p) => p.error)?.error ?? null;
      const data  = error ? null : pages.flatMap((p) => p.data ?? []);
      return { data, error };
    })(),
  ]);

  if (stocksRes.error || hierarchyRes.error || connectionsRes.error) {
    return NextResponse.json({ error: "Failed to load graph data" }, { status: 500 });
  }

  return NextResponse.json({
    stocks:      stocksRes.data,
    hierarchy:   hierarchyRes.data,
    connections: connectionsRes.data,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
