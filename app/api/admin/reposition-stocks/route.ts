import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// Concentric ring scatter around a target node.
function scatterOffset(idx: number, total: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0, dy: 0 };
  let ring = 0;
  let remaining = idx;
  let ringCapacity = 8;
  while (remaining >= ringCapacity) {
    remaining -= ringCapacity;
    ring++;
    ringCapacity = (ring + 1) * 8;
  }
  const radius = 0.06 + ring * 0.06;
  const angle  = (remaining / ringCapacity) * 2 * Math.PI;
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Load all nodes
  const { data: allNodes, error: nodesErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name, node_type, sector, x_position, y_position");
  if (nodesErr || !allNodes) return NextResponse.json({ error: nodesErr?.message ?? "Failed to load nodes" }, { status: 500 });

  // 2. Load T1 (Exposure) and T2 (Peer) connections
  const [t1Res, t2Res] = await Promise.all([
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 1),
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 2),
  ]);
  if (t1Res.error) return NextResponse.json({ error: t1Res.error.message }, { status: 500 });
  if (t2Res.error) return NextResponse.json({ error: t2Res.error.message }, { status: 500 });

  const t1Conns  = t1Res.data ?? [];
  const t2Conns  = t2Res.data ?? [];

  // Build lookup maps
  const stockByTick  = new Map<string, typeof allNodes[number]>();
  const hierByName   = new Map<string, typeof allNodes[number]>();
  const sectorByName = new Map<string, typeof allNodes[number]>();

  for (const n of allNodes) {
    if (n.node_type === "stock" && n.ticker) {
      stockByTick.set(n.ticker, n);
    } else if (n.node_type === "subsector" || n.node_type === "subsubsector") {
      if (n.company_name) hierByName.set(n.company_name, n);
    } else if (n.node_type === "sector") {
      if (n.company_name) sectorByName.set(n.company_name, n);
    }
  }

  // 3. Build T2 peer map: ticker → Set of peer tickers
  const peerMap = new Map<string, Set<string>>();
  for (const { ticker_a, ticker_b } of t2Conns) {
    if (!stockByTick.has(ticker_a) || !stockByTick.has(ticker_b)) continue;
    if (!peerMap.has(ticker_a)) peerMap.set(ticker_a, new Set());
    if (!peerMap.has(ticker_b)) peerMap.set(ticker_b, new Set());
    peerMap.get(ticker_a)!.add(ticker_b);
    peerMap.get(ticker_b)!.add(ticker_a);
  }

  // 4. Build T1 maps:
  //    stockT1Targets: ticker → array of candidate hierarchy nodes
  //    hierToStocks:   hierarchy node name → Set of stock tickers connected to it
  const stockT1Targets = new Map<string, Array<typeof allNodes[number]>>();
  const hierToStocks   = new Map<string, Set<string>>();

  for (const { ticker_a, ticker_b } of t1Conns) {
    const isAStock = stockByTick.has(ticker_a);
    const isBStock = stockByTick.has(ticker_b);
    if (!isAStock && !isBStock) continue; // neither is a stock — skip

    const stockTicker = isAStock ? ticker_a : ticker_b;
    const hierName    = isAStock ? ticker_b : ticker_a;
    const hier = hierByName.get(hierName);
    if (!hier) continue;

    if (!stockT1Targets.has(stockTicker)) stockT1Targets.set(stockTicker, []);
    stockT1Targets.get(stockTicker)!.push(hier);

    if (!hierToStocks.has(hierName)) hierToStocks.set(hierName, new Set());
    hierToStocks.get(hierName)!.add(stockTicker);
  }

  // 5. Pick best T1 target per stock.
  //    Score each candidate by how many of the stock's T2 peers share that same industry.
  //    Tiebreak: subsubsector > subsector (more specific = better).
  //    Secondary tiebreak: larger cluster (more stocks already positioned nearby).
  const SPECIFICITY: Record<string, number> = { subsubsector: 2, subsector: 1, sector: 0 };

  const stockTarget = new Map<string, typeof allNodes[number]>();

  stockT1Targets.forEach((candidates, ticker) => {
    if (candidates.length === 0) return;
    if (candidates.length === 1) { stockTarget.set(ticker, candidates[0]); return; }

    const peers = peerMap.get(ticker) ?? new Set<string>();

    let best = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const clusterStocks = hierToStocks.get(candidate.company_name) ?? new Set<string>();

      // Count how many of this stock's T2 peers live in this candidate's industry
      let peerOverlap = 0;
      peers.forEach((peer) => { if (clusterStocks.has(peer)) peerOverlap++; });

      // Specificity is primary (subsubsector always beats subsector regardless of peer counts),
      // peer overlap breaks ties within the same specificity tier,
      // cluster size is the final tiebreak.
      const score =
        (SPECIFICITY[candidate.node_type] ?? 0) * 1_000_000 +
        peerOverlap * 1_000 +
        clusterStocks.size;

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    stockTarget.set(ticker, best);
  });

  // 6. Fall back to sector node for stocks with no T1 connection at all
  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    if (stock.sector) {
      const sectorNode = sectorByName.get(stock.sector);
      if (sectorNode) stockTarget.set(stock.ticker, sectorNode);
    }
  });

  // 7. Group stocks by target node for scatter layout
  const groups = new Map<string, string[]>(); // target node id → [tickers]
  stockTarget.forEach((target, ticker) => {
    const list = groups.get(target.id) ?? [];
    list.push(ticker);
    groups.set(target.id, list);
  });

  // Sort within each group by number of T2 peers (most connected → centre of ring)
  groups.forEach((list) => {
    list.sort((a, b) => (peerMap.get(b)?.size ?? 0) - (peerMap.get(a)?.size ?? 0));
  });

  // 8. Compute new positions
  const updates: { id: string; x_position: number; y_position: number }[] = [];

  groups.forEach((tickers, targetId) => {
    const target = allNodes.find((n) => n.id === targetId);
    if (!target) return;
    tickers.forEach((ticker, idx) => {
      const stock = stockByTick.get(ticker);
      if (!stock) return;
      const { dx, dy } = scatterOffset(idx, tickers.length);
      updates.push({
        id:         stock.id,
        x_position: target.x_position + dx,
        y_position: target.y_position + dy,
      });
    });
  });

  // 9. Batch-update positions in chunks of 500
  const CHUNK = 500;
  let updated = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin
      .from("admin_nodes")
      .upsert(chunk, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    repositioned: updated,
    withT1: stockTarget.size,
    total: stockByTick.size,
  });
}
