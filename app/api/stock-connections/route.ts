import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export interface StockConnection {
  id: string;
  name: string;
  nodeType: "stock" | "subsector" | "subsubsector" | "sector";
  tier: number;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) return NextResponse.json([], { status: 400 });

  const [connsRes, nodesRes] = await Promise.all([
    supabase
      .from("admin_connections")
      .select("ticker_a, ticker_b, tier")
      .or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`),
    supabase
      .from("admin_nodes")
      .select("node_type, ticker, company_name, display_name, etf_ticker"),
  ]);

  if (connsRes.error || nodesRes.error) {
    return NextResponse.json([], { status: 500 });
  }

  const nodeMap = new Map<string, { node_type: string; display_name: string | null; company_name: string | null; etf_ticker: string | null }>();
  for (const n of nodesRes.data ?? []) {
    const key = n.node_type === "stock" ? n.ticker : (n.company_name ?? n.etf_ticker ?? "");
    if (key) nodeMap.set(key, n);
  }

  const connections: StockConnection[] = [];
  for (const c of connsRes.data ?? []) {
    const otherId = c.ticker_a === ticker ? c.ticker_b : c.ticker_a;
    const node    = nodeMap.get(otherId);
    if (!node) continue;

    const name =
      node.node_type === "stock"
        ? (nodeMap.get(otherId)?.company_name ?? otherId)
        : (node.display_name ?? node.company_name ?? otherId);

    connections.push({
      id:       otherId,
      name,
      nodeType: node.node_type as StockConnection["nodeType"],
      tier:     c.tier,
    });
  }

  connections.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));

  return NextResponse.json(connections, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
