import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getYahooSession, fetchFundamentalsForTicker, type FundamentalsEntry } from "@/lib/fundamentalsUtils";
import HierarchyDetail, { type HierarchyNode, type ConstituentStock } from "@/components/HierarchyDetail";

interface Props { params: { name: string } }

export default async function SubsectorPage({ params }: Props) {
  const raw     = params.name;
  const decoded = decodeURIComponent(raw);

  console.log(`[subsector] params.name=${JSON.stringify(raw)} decoded=${JSON.stringify(decoded)}`);

  const { data: node, error } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, colour, x_position, y_position, parent_node_id, cached_overview")
    .eq("node_type", "subsector")
    .eq("company_name", decoded)
    .maybeSingle();

  console.log(`[subsector] query company_name=${JSON.stringify(decoded)}`,
    `→ node=${node ? JSON.stringify({ id: node.id, company_name: node.company_name }) : "null"}`,
    `error=${error ? JSON.stringify(error) : "none"}`);

  if (!node) {
    console.log(`[subsector] returning notFound for decoded=${JSON.stringify(decoded)}`);
    return notFound();
  }

  // Look up parent sector name for overview generation
  let parentName: string | null = null;
  if (node.parent_node_id) {
    const { data: parent } = await supabaseAdmin
      .from("admin_nodes")
      .select("display_name, company_name")
      .eq("id", node.parent_node_id)
      .maybeSingle();
    parentName = parent?.display_name ?? parent?.company_name ?? null;
  }

  // Stocks connected via admin_connections
  const { data: connsA } = await supabaseAdmin
    .from("admin_connections").select("ticker_b").eq("ticker_a", decoded);
  const { data: connsB } = await supabaseAdmin
    .from("admin_connections").select("ticker_a").eq("ticker_b", decoded);

  const connectedIds = new Set<string>([
    ...(connsA ?? []).map((c) => c.ticker_b as string),
    ...(connsB ?? []).map((c) => c.ticker_a as string),
  ]);

  let stocks: ConstituentStock[] = [];
  if (connectedIds.size > 0) {
    const { data: stockRows } = await supabaseAdmin
      .from("admin_nodes").select("ticker, company_name")
      .eq("node_type", "stock").in("ticker", [...connectedIds]);
    stocks = (stockRows ?? []) as ConstituentStock[];
  }

  // Fetch ETF fundamentals server-side if this subsector has its own ETF
  let etfFundamentals: FundamentalsEntry | null = null;
  if (node.etf_ticker) {
    try {
      const session = await getYahooSession();
      if (session) etfFundamentals = await fetchFundamentalsForTicker(node.etf_ticker, session);
    } catch { /* non-fatal */ }
  }

  const analysisKey = node.etf_ticker ?? decoded;

  return (
    <HierarchyDetail
      node={node as HierarchyNode}
      stocks={stocks}
      analysisKey={analysisKey}
      initialFundamentals={etfFundamentals}
      initialOverview={node.cached_overview ?? null}
      parentName={parentName}
    />
  );
}
