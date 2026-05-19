import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load all nodes to build a lookup of what each identifier is
  const { data: nodes, error: nodesErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, etf_ticker, node_type")
    .limit(50000);
  if (nodesErr || !nodes) return NextResponse.json({ error: nodesErr?.message }, { status: 500 });

  // Build a map: any identifier → node_type
  const typeOf = new Map<string, string>();
  for (const n of nodes) {
    if (n.ticker)       typeOf.set(n.ticker,       n.node_type);
    if (n.company_name) typeOf.set(n.company_name, n.node_type);
    if (n.etf_ticker)   typeOf.set(n.etf_ticker,   n.node_type);
  }

  const isHierarchy = (id: string) => {
    const t = typeOf.get(id);
    return t === "sector" || t === "subsector" || t === "subsubsector";
  };
  const isStock = (id: string) => typeOf.get(id) === "stock";

  // Load all connections
  const { data: conns, error: connErr } = await supabaseAdmin
    .from("admin_connections")
    .select("id, ticker_a, ticker_b, tier")
    .limit(500000);
  if (connErr || !conns) return NextResponse.json({ error: connErr?.message }, { status: 500 });

  const toTier1: string[] = []; // should be Exposure but aren't
  const toTier2: string[] = []; // should be Peer but are marked Exposure

  for (const c of conns) {
    const aIsHier = isHierarchy(c.ticker_a);
    const bIsHier = isHierarchy(c.ticker_b);
    const eitherHier = aIsHier || bIsHier;
    const bothStock  = isStock(c.ticker_a) && isStock(c.ticker_b);

    if (eitherHier && c.tier !== 1) toTier1.push(c.id);
    if (bothStock  && c.tier === 1) toTier2.push(c.id);
  }

  // Apply fixes in chunks
  const CHUNK = 500;
  async function updateTier(ids: string[], tier: number) {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { error } = await supabaseAdmin
        .from("admin_connections")
        .update({ tier })
        .in("id", ids.slice(i, i + CHUNK));
      if (error) throw new Error(error.message);
    }
  }

  try {
    await updateTier(toTier1, 1);
    await updateTier(toTier2, 2);
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fixedToExposure: toTier1.length,
    fixedToPeer:     toTier2.length,
    total:           conns.length,
  });
}
