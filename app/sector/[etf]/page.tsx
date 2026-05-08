import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import HierarchyDetail, { type HierarchyNode, type ConstituentStock } from "@/components/HierarchyDetail";

// Legacy slug → ETF ticker (for URLs generated before Build 2c)
const SLUG_TO_ETF: Record<string, string> = {
  tech:     "XLK",
  energy:   "XLE",
  health:   "XLV",
  healthcare: "XLV",
  finance:  "XLF",
  consumer: "XLY",
  industrials: "XLI",
  communication: "XLC",
  materials: "XLB",
  "real-estate": "XLRE",
  utilities: "XLU",
};

interface Props { params: { etf: string } }

export default async function SectorPage({ params }: Props) {
  const raw = params.etf;

  // Redirect old slug URLs (e.g. /sector/tech → /sector/XLK)
  if (SLUG_TO_ETF[raw.toLowerCase()]) {
    redirect(`/sector/${SLUG_TO_ETF[raw.toLowerCase()]}`);
  }

  const etf = raw.toUpperCase();

  const { data: node } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, colour, x_position, y_position")
    .eq("node_type", "sector")
    .eq("etf_ticker", etf)
    .maybeSingle();

  if (!node) return notFound();

  // Constituent stocks: admin_nodes rows where sector matches the sector's display name
  const sectorName = node.display_name ?? node.company_name ?? "";
  const { data: stocks } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name")
    .eq("node_type", "stock")
    .eq("sector", sectorName)
    .order("company_name");

  const analysisKey = node.etf_ticker ?? sectorName;

  return (
    <HierarchyDetail
      node={node as HierarchyNode}
      stocks={(stocks ?? []) as ConstituentStock[]}
      analysisKey={analysisKey}
    />
  );
}
