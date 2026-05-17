import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * One-time migration to the new tier system:
 * - T1 = Exposure  (stock → industry/subsector)
 * - T2 = Peer      (stock → stock, direct)
 * - T3 = Impact    (stock → stock, indirect)
 *
 * Changes:
 * 1. Stock → subsector connections: T2 → T1 (were mistreated as peers)
 * 2. Stock → sector connections: T3 → T1 (shouldn't be T3)
 * 3. Hierarchy → hierarchy connections: delete (redundant with parent_node_id)
 */
export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load all nodes to build type lookup
  const { data: nodes } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, etf_ticker, node_type");

  if (!nodes) return NextResponse.json({ error: "Failed to load nodes" }, { status: 500 });

  const typeMap = new Map<string, string>();
  for (const n of nodes) {
    if (n.ticker)       typeMap.set(n.ticker,       n.node_type);
    if (n.company_name) typeMap.set(n.company_name, n.node_type);
    if (n.etf_ticker)   typeMap.set(n.etf_ticker,   n.node_type);
  }

  const { data: conns } = await supabaseAdmin
    .from("admin_connections")
    .select("id, ticker_a, ticker_b, tier");

  if (!conns) return NextResponse.json({ error: "Failed to load connections" }, { status: 500 });

  const hierarchyTypes = new Set(["sector", "subsector", "subsubsector"]);

  const toDelete: number[]                             = [];
  const toT1:     number[]                             = [];

  for (const c of conns) {
    const typeA = typeMap.get(c.ticker_a);
    const typeB = typeMap.get(c.ticker_b);
    const aIsHierarchy = typeA ? hierarchyTypes.has(typeA) : false;
    const bIsHierarchy = typeB ? hierarchyTypes.has(typeB) : false;

    if (aIsHierarchy && bIsHierarchy) {
      // Hierarchy → hierarchy: delete (covered by parent_node_id)
      toDelete.push(c.id);
    } else if (aIsHierarchy || bIsHierarchy) {
      // Stock → hierarchy: must be T1 (Exposure)
      if (c.tier !== 1) toT1.push(c.id);
    }
    // Stock → stock: leave as-is (T2=Peer, T3=Impact)
  }

  let deleted = 0;
  let updated = 0;

  if (toDelete.length > 0) {
    const { error } = await supabaseAdmin
      .from("admin_connections")
      .delete()
      .in("id", toDelete);
    if (!error) deleted = toDelete.length;
  }

  if (toT1.length > 0) {
    const { error } = await supabaseAdmin
      .from("admin_connections")
      .update({ tier: 1 })
      .in("id", toT1);
    if (!error) updated = toT1.length;
  }

  return NextResponse.json({
    deleted,
    updated,
    message: `Migration complete: ${deleted} hierarchy-hierarchy connections removed, ${updated} connections updated to T1 (Exposure).`,
  });
}
