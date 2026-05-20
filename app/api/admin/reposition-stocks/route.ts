import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

function scatterOffset(idx: number, total: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0.09, dy: 0 }; // single stock: push right rather than sitting on the label
  let ring = 0;
  let remaining = idx;
  let ringCapacity = 10;
  while (remaining >= ringCapacity) {
    remaining -= ringCapacity;
    ring++;
    ringCapacity = (ring + 1) * 10;
  }
  // Ring 0 at 0.10 normalized = 160px from parent — enough breathing room.
  // Each subsequent ring adds 0.07 (112px), keeping stocks readable.
  const radius = 0.10 + ring * 0.07;
  const angle  = (remaining / ringCapacity) * 2 * Math.PI;
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

type AdminNode = {
  id: string;
  ticker: string | null;
  company_name: string | null;
  node_type: string;
  sector: string | null;
  parent_node_id: string | null;
  x_position: number;
  y_position: number;
};

const SPECIFICITY: Record<string, number> = { subsubsector: 2, subsector: 1, sector: 0 };

async function buildAssignments(
  allNodes: AdminNode[],
  t1Conns: { ticker_a: string; ticker_b: string }[],
  t2Conns: { ticker_a: string; ticker_b: string }[],
) {
  const stockByTick  = new Map<string, AdminNode>();
  const hierByName   = new Map<string, AdminNode>();
  const hierById     = new Map<string, AdminNode>();
  const sectorByName = new Map<string, AdminNode>();

  for (const n of allNodes) {
    if (n.node_type === "stock" && n.ticker) {
      stockByTick.set(n.ticker, n);
    } else if (n.node_type === "subsector" || n.node_type === "subsubsector") {
      if (n.company_name) hierByName.set(n.company_name, n);
      hierById.set(n.id, n);
    } else if (n.node_type === "sector") {
      if (n.company_name) sectorByName.set(n.company_name, n);
      hierByName.set(n.company_name ?? "", n);
      hierById.set(n.id, n);
    }
  }

  // Build hierarchy node → sector ETF mapping by traversing parent_node_id chain.
  // Used to constrain peer propagation to same-sector placements only.
  const sectorIdToEtf = new Map<string, string>(); // sector node id → etf_ticker-ish key
  for (const n of allNodes) {
    if (n.node_type === "sector") sectorIdToEtf.set(n.id, n.id); // sector id is its own key
  }
  const nodeToSectorId = new Map<string, string>(); // any hier node id → ancestor sector id
  // subsectors
  for (const n of allNodes) {
    if (n.node_type === "subsector" && n.parent_node_id && sectorIdToEtf.has(n.parent_node_id)) {
      nodeToSectorId.set(n.id, n.parent_node_id);
    }
  }
  // subsubsectors
  for (const n of allNodes) {
    if (n.node_type === "subsubsector" && n.parent_node_id) {
      const ancestorSector = nodeToSectorId.get(n.parent_node_id);
      if (ancestorSector) nodeToSectorId.set(n.id, ancestorSector);
    }
  }

  // Build stock sector → sector node id map (using stock.sector field)
  // Normalise sector names to match sector node company_name
  const sectorNameToId = new Map<string, string>();
  for (const n of allNodes) {
    if (n.node_type === "sector" && n.company_name) {
      sectorNameToId.set(n.company_name.toLowerCase().replace(/\s+/g, ""), n.id);
    }
  }
  function stockSectorId(stock: AdminNode): string | null {
    if (!stock.sector) return null;
    const key = stock.sector.toLowerCase().replace(/\s+/g, "");
    return sectorNameToId.get(key) ?? null;
  }

  // T2 peer map
  const peerMap = new Map<string, Set<string>>();
  for (const { ticker_a, ticker_b } of t2Conns) {
    if (!stockByTick.has(ticker_a) || !stockByTick.has(ticker_b)) continue;
    if (!peerMap.has(ticker_a)) peerMap.set(ticker_a, new Set());
    if (!peerMap.has(ticker_b)) peerMap.set(ticker_b, new Set());
    peerMap.get(ticker_a)!.add(ticker_b);
    peerMap.get(ticker_b)!.add(ticker_a);
  }

  // T1 maps
  const stockT1Targets = new Map<string, AdminNode[]>();
  const unresolvedT1: { ticker: string; hierRef: string }[] = [];

  for (const { ticker_a, ticker_b } of t1Conns) {
    const isAStock = stockByTick.has(ticker_a);
    const isBStock = stockByTick.has(ticker_b);
    if (!isAStock && !isBStock) continue;

    const stockTicker = isAStock ? ticker_a : ticker_b;
    const hierRef     = isAStock ? ticker_b : ticker_a;
    const hier = hierByName.get(hierRef) ?? hierById.get(hierRef);
    if (!hier) { unresolvedT1.push({ ticker: stockTicker, hierRef }); continue; }

    if (!stockT1Targets.has(stockTicker)) stockT1Targets.set(stockTicker, []);
    stockT1Targets.get(stockTicker)!.push(hier);
  }

  // Pick best T1 target per stock: specificity first, peer overlap second
  const stockTarget = new Map<string, AdminNode>();

  stockT1Targets.forEach((candidates, ticker) => {
    if (candidates.length === 0) return;
    if (candidates.length === 1) { stockTarget.set(ticker, candidates[0]); return; }

    const peers = peerMap.get(ticker) ?? new Set<string>();
    // Group candidates by specificity tier, then score within each tier by peer overlap
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      // Count peers also connected to this candidate (via T1)
      let peerOverlap = 0;
      peers.forEach((peer) => {
        const peerTargets = stockT1Targets.get(peer);
        if (peerTargets?.some((t) => t.id === candidate.id)) peerOverlap++;
      });
      const score =
        (SPECIFICITY[candidate.node_type] ?? 0) * 1_000_000 +
        peerOverlap * 1_000;
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    stockTarget.set(ticker, best);
  });

  // Single-pass peer propagation for stocks with no T1 target.
  // CONSTRAINT: only follow peers whose assigned node belongs to the SAME sector
  // as this stock, preventing cross-sector snowball effects.
  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    const peers = peerMap.get(stock.ticker);
    if (!peers || peers.size === 0) return;

    const thisSectorId = stockSectorId(stock);
    const tally = new Map<string, { target: AdminNode; count: number }>();

    peers.forEach((peerTicker) => {
      const t = stockTarget.get(peerTicker);
      if (!t) return;
      // Reject if the peer's target is in a different sector
      if (thisSectorId) {
        const targetSectorId = t.node_type === "sector"
          ? t.id
          : nodeToSectorId.get(t.id);
        if (targetSectorId && targetSectorId !== thisSectorId) return;
      }
      const existing = tally.get(t.id);
      if (existing) { existing.count++; }
      else { tally.set(t.id, { target: t, count: 1 }); }
    });

    let best: AdminNode | null = null;
    let bestScore = -Infinity;
    tally.forEach(({ target, count }) => {
      const score = (SPECIFICITY[target.node_type] ?? 0) * 1_000 + count;
      if (score > bestScore) { bestScore = score; best = target; }
    });
    if (best) stockTarget.set(stock.ticker, best);
  });

  // Final fallback: sector node
  const noT1: string[] = [];
  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    const sectorNode = stock.sector ? sectorByName.get(stock.sector) : undefined;
    if (sectorNode) { stockTarget.set(stock.ticker, sectorNode); }
    else { noT1.push(stock.ticker); }
  });

  return { stockByTick, stockTarget, peerMap, unresolvedT1, noT1 };
}

// ── GET: dry-run diagnostic ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allNodes, error: nodesErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name, node_type, sector, parent_node_id, x_position, y_position");
  if (nodesErr || !allNodes) return NextResponse.json({ error: nodesErr?.message }, { status: 500 });

  const [t1Res, t2Res] = await Promise.all([
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 1),
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 2),
  ]);
  if (t1Res.error) return NextResponse.json({ error: t1Res.error.message }, { status: 500 });
  if (t2Res.error) return NextResponse.json({ error: t2Res.error.message }, { status: 500 });

  const { stockByTick, stockTarget, unresolvedT1, noT1 } =
    await buildAssignments(allNodes as AdminNode[], t1Res.data ?? [], t2Res.data ?? []);

  const dist: Record<string, number> = { subsubsector: 0, subsector: 0, sector: 0, none: noT1.length };
  const fallbackToSector: string[] = [];
  stockTarget.forEach((target, ticker) => {
    const type = target.node_type;
    dist[type] = (dist[type] ?? 0) + 1;
    if (type === "sector") fallbackToSector.push(ticker);
  });

  // All hierarchy nodes with their assigned stock counts and node type
  const clusterMap = new Map<string, { count: number; type: string }>();
  for (const n of allNodes) {
    if (n.node_type === "subsector" || n.node_type === "subsubsector") {
      const key = n.company_name ?? n.id;
      if (!clusterMap.has(key)) clusterMap.set(key, { count: 0, type: n.node_type });
    }
  }
  stockTarget.forEach((target) => {
    if (target.node_type === "subsector" || target.node_type === "subsubsector") {
      const key = target.company_name ?? target.id;
      const existing = clusterMap.get(key);
      if (existing) existing.count++;
    }
  });
  const clusters: { name: string; count: number; type: string }[] = [];
  clusterMap.forEach(({ count, type }, name) => clusters.push({ name, count, type }));
  clusters.sort((a, b) => b.count - a.count);

  return NextResponse.json({
    total: stockByTick.size,
    distribution: dist,
    unresolvedT1Count: unresolvedT1.length,
    unresolvedSample: unresolvedT1.slice(0, 20),
    fallbackToSector: fallbackToSector.slice(0, 50),
    noT1: noT1.slice(0, 50),
    topClusters: clusters,
  });
}

// ── POST: apply reposition ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allNodes, error: nodesErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name, node_type, sector, parent_node_id, x_position, y_position");
  if (nodesErr || !allNodes) return NextResponse.json({ error: nodesErr?.message ?? "Failed to load nodes" }, { status: 500 });

  const [t1Res, t2Res] = await Promise.all([
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 1),
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 2),
  ]);
  if (t1Res.error) return NextResponse.json({ error: t1Res.error.message }, { status: 500 });
  if (t2Res.error) return NextResponse.json({ error: t2Res.error.message }, { status: 500 });

  const { stockByTick, stockTarget, peerMap } =
    await buildAssignments(allNodes as AdminNode[], t1Res.data ?? [], t2Res.data ?? []);

  const groups = new Map<string, string[]>();
  stockTarget.forEach((target, ticker) => {
    const list = groups.get(target.id) ?? [];
    list.push(ticker);
    groups.set(target.id, list);
  });
  groups.forEach((list) => {
    list.sort((a, b) => (peerMap.get(b)?.size ?? 0) - (peerMap.get(a)?.size ?? 0));
  });

  const updates: { id: string; x_position: number; y_position: number }[] = [];
  groups.forEach((tickers, targetId) => {
    const target = allNodes.find((n) => n.id === targetId);
    if (!target) return;
    tickers.forEach((ticker, idx) => {
      const stock = stockByTick.get(ticker);
      if (!stock) return;
      const { dx, dy } = scatterOffset(idx, tickers.length);
      updates.push({
        id: stock.id,
        x_position: Math.max(0.01, Math.min(0.99, target.x_position + dx)),
        y_position: Math.max(0.01, Math.min(0.99, target.y_position + dy)),
      });
    });
  });

  const CHUNK = 500;
  let updated = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin.from("admin_nodes").upsert(chunk, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += chunk.length;
  }

  return NextResponse.json({ ok: true, repositioned: updated, withT1: stockTarget.size, total: stockByTick.size });
}
