import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import HierarchyDetail, { type HierarchyNode, type ConstituentStock } from "@/components/HierarchyDetail";

interface Props { params: { name: string } }

export default async function SubSubSectorPage({ params }: Props) {
  const name = decodeURIComponent(params.name);

  const { data: node } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, colour, x_position, y_position")
    .eq("node_type", "subsubsector")
    .eq("company_name", name)
    .maybeSingle();

  if (!node) return notFound();

  // Stocks connected to this sub-sub-sector via admin_connections
  const { data: conns } = await supabaseAdmin
    .from("admin_connections")
    .select("ticker_a, ticker_b")
    .or(`ticker_a.eq.${name},ticker_b.eq.${name}`);

  const connectedIds = new Set<string>();
  for (const c of conns ?? []) {
    const other = c.ticker_a === name ? c.ticker_b : c.ticker_a;
    connectedIds.add(other);
  }

  let stocks: ConstituentStock[] = [];
  if (connectedIds.size > 0) {
    const { data: stockRows } = await supabaseAdmin
      .from("admin_nodes")
      .select("ticker, company_name")
      .eq("node_type", "stock")
      .in("ticker", [...connectedIds]);
    stocks = (stockRows ?? []) as ConstituentStock[];
  }

  // Analysis key: own ETF if available, else company_name
  const analysisKey = node.etf_ticker ?? name;

  return (
    <HierarchyDetail
      node={node as HierarchyNode}
      stocks={stocks}
      analysisKey={analysisKey}
    />
  );
}
