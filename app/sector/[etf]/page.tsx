import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import HierarchyDetail, { type HierarchyNode, type ConstituentStock } from "@/components/HierarchyDetail";

interface Props { params: { etf: string } }

export default async function SectorPage({ params }: Props) {
  const etf = params.etf.toUpperCase();

  const { data: node } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, colour, x_position, y_position")
    .eq("node_type", "sector")
    .eq("etf_ticker", etf)
    .maybeSingle();

  if (!node) return notFound();

  // Constituent stocks: admin_nodes rows where sector = display_name or company_name
  const sectorName = node.display_name ?? node.company_name ?? "";
  const { data: stocks } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name")
    .eq("node_type", "stock")
    .eq("sector", sectorName)
    .order("company_name");

  // Analysis key: ETF ticker for sectors (XLK, XLF, etc.)
  const analysisKey = node.etf_ticker ?? sectorName;

  return (
    <HierarchyDetail
      node={node as HierarchyNode}
      stocks={(stocks ?? []) as ConstituentStock[]}
      analysisKey={analysisKey}
    />
  );
}
