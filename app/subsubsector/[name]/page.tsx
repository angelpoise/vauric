import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import HierarchyDetail, { type HierarchyNode, type ConstituentStock } from "@/components/HierarchyDetail";

interface Props { params: { name: string } }

export default async function SubSubSectorPage({ params }: Props) {
  const raw     = params.name;
  const decoded = decodeURIComponent(raw);

  console.log(`[subsubsector] params.name=${JSON.stringify(raw)} decoded=${JSON.stringify(decoded)}`);

  const { data: node, error } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, colour, x_position, y_position")
    .eq("node_type", "subsubsector")
    .eq("company_name", decoded)
    .maybeSingle();

  console.log(`[subsubsector] query company_name=${JSON.stringify(decoded)}`,
    `→ node=${node ? JSON.stringify({ id: node.id, company_name: node.company_name, node_type: node.node_type }) : "null"}`,
    `error=${error ? JSON.stringify(error) : "none"}`);

  if (!node) {
    console.log(`[subsubsector] returning notFound for decoded=${JSON.stringify(decoded)}`);
    return notFound();
  }

  const { data: connsA } = await supabaseAdmin
    .from("admin_connections")
    .select("ticker_b")
    .eq("ticker_a", decoded);

  const { data: connsB } = await supabaseAdmin
    .from("admin_connections")
    .select("ticker_a")
    .eq("ticker_b", decoded);

  const connectedIds = new Set<string>([
    ...(connsA ?? []).map((c) => c.ticker_b as string),
    ...(connsB ?? []).map((c) => c.ticker_a as string),
  ]);

  let stocks: ConstituentStock[] = [];
  if (connectedIds.size > 0) {
    const { data: stockRows } = await supabaseAdmin
      .from("admin_nodes")
      .select("ticker, company_name")
      .eq("node_type", "stock")
      .in("ticker", [...connectedIds]);
    stocks = (stockRows ?? []) as ConstituentStock[];
  }

  const analysisKey = node.etf_ticker ?? decoded;

  return (
    <HierarchyDetail
      node={node as HierarchyNode}
      stocks={stocks}
      analysisKey={analysisKey}
    />
  );
}
