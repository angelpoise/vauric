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
  const radius = 0.04 + ring * 0.04; // tighter rings than before
  const angle  = (remaining / ringCapacity) * 2 * Math.PI;
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

type AdminNode = {
  id: string;
  ticker: string | null;
  company_name: string | null;
  node_type: string;
  sector: string | null;
  x_position: number;
  y_position: number;
};

const SPECIFICITY: Record<string, number> = { subsubsector: 2, subsector: 1, sector: 0 };

async function buildAssignments(allNodes: AdminNode[], t1Conns: { ticker_a: string; ticker_b: string }[], t2Conns: { ticker_a: string; ticker_b: string }[]) {
  const stockByTick  = new Map<string, AdminNode>();
  const hierByName   = new Map<string, AdminNode>(); // company_name → node
  const hierById     = new Map<string, AdminNode>(); // uuid → node
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

  // T2 peer map
  const peerMap = new Map<string, Set<string>>();
  for (const { ticker_a, ticker_b } of t2Conns) {
    if (!stockByTick.has(ticker_a) || !stockByTick.has(ticker_b)) continue;
    if (!peerMap.has(ticker_a)) peerMap.set(ticker_a, new Set());
    if (!peerMap.has(ticker_b)) peerMap.set(ticker_b, new Set());
    peerMap.get(ticker_a)!.add(ticker_b);
    peerMap.get(ticker_b)!.add(ticker_a);
  }

  // T1 maps — resolve hierarchy by company_name OR uuid
  const stockT1Targets = new Map<string, AdminNode[]>();
  const hierToStocks   = new Map<string, Set<string>>();
  const unresolvedT1: { ticker: string; hierRef: string }[] = [];

  for (const { ticker_a, ticker_b } of t1Conns) {
    const isAStock = stockByTick.has(ticker_a);
    const isBStock = stockByTick.has(ticker_b);
    if (!isAStock && !isBStock) continue;

    const stockTicker = isAStock ? ticker_a : ticker_b;
    const hierRef     = isAStock ? ticker_b : ticker_a;

    // Try company_name lookup first, then UUID lookup
    const hier = hierByName.get(hierRef) ?? hierById.get(hierRef);
    if (!hier) {
      unresolvedT1.push({ ticker: stockTicker, hierRef });
      continue;
    }

    if (!stockT1Targets.has(stockTicker)) stockT1Targets.set(stockTicker, []);
    stockT1Targets.get(stockTicker)!.push(hier);

    const key = hier.company_name ?? hier.id;
    if (!hierToStocks.has(key)) hierToStocks.set(key, new Set());
    hierToStocks.get(key)!.add(stockTicker);
  }

  // Pick best target per stock
  const stockTarget = new Map<string, AdminNode>();

  stockT1Targets.forEach((candidates, ticker) => {
    if (candidates.length === 0) return;
    if (candidates.length === 1) { stockTarget.set(ticker, candidates[0]); return; }

    const peers = peerMap.get(ticker) ?? new Set<string>();
    let best = candidates[0];
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const clusterStocks = hierToStocks.get(candidate.company_name ?? candidate.id) ?? new Set<string>();
      let peerOverlap = 0;
      peers.forEach((peer) => { if (clusterStocks.has(peer)) peerOverlap++; });
      const score =
        (SPECIFICITY[candidate.node_type] ?? 0) * 1_000_000 +
        peerOverlap * 1_000 +
        clusterStocks.size;
      if (score > bestScore) { bestScore = score; best = candidate; }
    }

    stockTarget.set(ticker, best);
  });

  // Peer-propagation pass: stocks with no T1 target look at where their T2 peers
  // are assigned and join the most common peer destination.
  // Run up to 3 iterations so peers-of-peers also propagate.
  for (let iter = 0; iter < 3; iter++) {
    let changed = false;
    stockByTick.forEach((stock) => {
      if (!stock.ticker || stockTarget.has(stock.ticker)) return;
      const peers = peerMap.get(stock.ticker);
      if (!peers || peers.size === 0) return;

      const tally = new Map<string, { target: AdminNode; count: number }>();
      peers.forEach((peerTicker) => {
        const t = stockTarget.get(peerTicker);
        if (!t) return;
        const existing = tally.get(t.id);
        if (existing) { existing.count++; }
        else { tally.set(t.id, { target: t, count: 1 }); }
      });

      // Among peer destinations, prefer the most specific + most common
      let best: AdminNode | null = null;
      let bestScore = -Infinity;
      tally.forEach(({ target, count }) => {
        const score = (SPECIFICITY[target.node_type] ?? 0) * 1_000 + count;
        if (score > bestScore) { bestScore = score; best = target; }
      });

      if (best) { stockTarget.set(stock.ticker, best); changed = true; }
    });
    if (!changed) break;
  }

  // Final fallback to sector node for stocks with neither T1 nor any placed peers
  const noT1: string[] = [];
  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    const sectorNode = stock.sector ? sectorByName.get(stock.sector) : undefined;
    if (sectorNode) {
      stockTarget.set(stock.ticker, sectorNode);
    } else {
      noT1.push(stock.ticker);
    }
  });

  return { stockByTick, stockTarget, peerMap, hierToStocks, unresolvedT1, noT1 };
}

// ── GET: dry-run diagnostic ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: allNodes, error: nodesErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker, company_name, node_type, sector, x_position, y_position");
  if (nodesErr || !allNodes) return NextResponse.json({ error: nodesErr?.message }, { status: 500 });

  const [t1Res, t2Res] = await Promise.all([
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 1),
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 2),
  ]);
  if (t1Res.error) return NextResponse.json({ error: t1Res.error.message }, { status: 500 });
  if (t2Res.error) return NextResponse.json({ error: t2Res.error.message }, { status: 500 });

  const { stockByTick, stockTarget, unresolvedT1, noT1 } =
    await buildAssignments(allNodes as AdminNode[], t1Res.data ?? [], t2Res.data ?? []);

  // Distribution by node type
  const dist: Record<string, number> = { subsubsector: 0, subsector: 0, sector: 0, none: noT1.length };
  const fallbackToSector: string[] = [];

  stockTarget.forEach((target, ticker) => {
    const type = target.node_type;
    dist[type] = (dist[type] ?? 0) + 1;
    if (type === "sector") fallbackToSector.push(ticker);
  });

  // Build cluster list from ALL hierarchy nodes (not just those with stocks)
  // so nodes with zero assigned stocks are visible too.
  const clusterMap = new Map<string, number>();
  for (const n of allNodes) {
    if (n.node_type === "subsector" || n.node_type === "subsubsector") {
      const key = n.company_name ?? n.id;
      if (!clusterMap.has(key)) clusterMap.set(key, 0);
    }
  }
  // Fill in actual counts from the assignment results
  stockTarget.forEach((target) => {
    if (target.node_type === "subsector" || target.node_type === "subsubsector") {
      const key = target.company_name ?? target.id;
      clusterMap.set(key, (clusterMap.get(key) ?? 0) + 1);
    }
  });
  const clusters: { name: string; count: number }[] = [];
  clusterMap.forEach((count, name) => clusters.push({ name, count }));
  clusters.sort((a, b) => b.count - a.count);

  // Sample unresolved (first 20)
  const unresolvedSample = unresolvedT1.slice(0, 20);

  return NextResponse.json({
    total: stockByTick.size,
    distribution: dist,
    unresolvedT1Count: unresolvedT1.length,
    unresolvedSample,
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
    .select("id, ticker, company_name, node_type, sector, x_position, y_position");
  if (nodesErr || !allNodes) return NextResponse.json({ error: nodesErr?.message ?? "Failed to load nodes" }, { status: 500 });

  const [t1Res, t2Res] = await Promise.all([
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 1),
    supabaseAdmin.from("admin_connections").select("ticker_a, ticker_b").eq("tier", 2),
  ]);
  if (t1Res.error) return NextResponse.json({ error: t1Res.error.message }, { status: 500 });
  if (t2Res.error) return NextResponse.json({ error: t2Res.error.message }, { status: 500 });

  const { stockByTick, stockTarget, peerMap } =
    await buildAssignments(allNodes as AdminNode[], t1Res.data ?? [], t2Res.data ?? []);

  // Group stocks by target node
  const groups = new Map<string, string[]>();
  stockTarget.forEach((target, ticker) => {
    const list = groups.get(target.id) ?? [];
    list.push(ticker);
    groups.set(target.id, list);
  });

  // Sort within each group: most-connected stocks toward centre
  groups.forEach((list) => {
    list.sort((a, b) => (peerMap.get(b)?.size ?? 0) - (peerMap.get(a)?.size ?? 0));
  });

  // Compute new positions
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

  // Batch-update in chunks of 500
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
