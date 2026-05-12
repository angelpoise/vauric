import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getYahooSession, fetchFundamentalsForTicker, type FundamentalsEntry } from "@/lib/fundamentalsUtils";
import HierarchyDetail, { type HierarchyNode, type ConstituentStock } from "@/components/HierarchyDetail";

const SLUG_TO_ETF: Record<string, string> = {
  tech: "XLK", energy: "XLE", health: "XLV", healthcare: "XLV",
  finance: "XLF", consumer: "XLY", "consumer-staples": "XLP", industrials: "XLI",
  communication: "XLC", materials: "XLB", "real-estate": "XLRE", utilities: "XLU",
};

interface Props { params: { etf: string } }

export default async function SectorPage({ params }: Props) {
  const raw = params.etf;
  if (SLUG_TO_ETF[raw.toLowerCase()]) redirect(`/sector/${SLUG_TO_ETF[raw.toLowerCase()]}`);

  const etf = raw.toUpperCase();

  const { data: node } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, node_type, company_name, display_name, etf_ticker, colour, x_position, y_position, cached_overview")
    .eq("node_type", "sector")
    .eq("etf_ticker", etf)
    .maybeSingle();

  if (!node) return notFound();

  const sectorName = node.display_name ?? node.company_name ?? "";
  const { data: stocks } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name")
    .eq("node_type", "stock")
    .eq("sector", sectorName)
    .order("company_name");

  // Fetch ETF fundamentals server-side so HierarchyDetail has data on first render
  let etfFundamentals: FundamentalsEntry | null = null;
  try {
    const session = await getYahooSession();
    if (session) etfFundamentals = await fetchFundamentalsForTicker(etf, session);
  } catch { /* non-fatal */ }

  const analysisKey = etf;

  return (
    <HierarchyDetail
      node={node as HierarchyNode}
      stocks={(stocks ?? []) as ConstituentStock[]}
      analysisKey={analysisKey}
      initialFundamentals={etfFundamentals}
      initialOverview={node.cached_overview ?? null}
    />
  );
}
