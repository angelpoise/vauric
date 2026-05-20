import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// ── Layout constants ──────────────────────────────────────────────────────────
//
// Hierarchy layout uses proportional angular allocation:
//   - Each sector owns an angular wedge pointing outward from the canvas centroid.
//   - Subsectors fan within that wedge at RADIUS_SUB from the sector hub.
//   - Subsubsectors fan from their subsector at RADIUS_SUBSUB.
//   - Stocks fill rings around their assigned leaf node (scatterOffset).
//
// All positions are normalized 0-1; canvas renders at 1600×1100 px.

const RADIUS_SUB        = 0.12;          // 192 px — subsector from sector hub
const RADIUS_SUBSUB     = 0.08;          // 128 px — subsubsector from subsector
const ANGLE_PER_SUB     = 0.50;          // ~28.6° per subsector
const ANGLE_PER_SUBSUB  = 0.55;          // ~31.5° per subsubsector
const MAX_SUB_SPREAD    = Math.PI * 1.5; // 270° max arc for subsectors
const MAX_SUBSUB_SPREAD = Math.PI;       // 180° max arc for subsubsectors

function clamp(v: number, lo = 0.02, hi = 0.98) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Stock scatter rings ───────────────────────────────────────────────────────

function scatterOffset(idx: number, total: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0.09, dy: 0 };
  let ring = 0;
  let remaining = idx;
  let ringCapacity = 10;
  while (remaining >= ringCapacity) {
    remaining -= ringCapacity;
    ring++;
    ringCapacity = (ring + 1) * 10;
  }
  const radius = 0.10 + ring * 0.07;
  const angle  = (remaining / ringCapacity) * 2 * Math.PI;
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius };
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Hierarchy layout ──────────────────────────────────────────────────────────
//
// Mutates x_position / y_position on each node in allNodes so that the
// subsequent stock scatter sees the updated positions.
// Returns DB update records for every hierarchy node that was moved.

function layoutHierarchy(
  allNodes: AdminNode[],
): { id: string; x_position: number; y_position: number }[] {
  const updates: { id: string; x_position: number; y_position: number }[] = [];

  const sectors = allNodes.filter((n) => n.node_type === "sector");

  // Compute canvas centroid from actual sector positions so the "outward"
  // direction is grounded in the real layout, not an assumed (0.5, 0.5).
  const centroid = sectors.length
    ? {
        x: sectors.reduce((s, n) => s + n.x_position, 0) / sectors.length,
        y: sectors.reduce((s, n) => s + n.y_position, 0) / sectors.length,
      }
    : { x: 0.5, y: 0.5 };

  // Build parent → children maps for hierarchy nodes.
  const subsectorsByParent    = new Map<string, AdminNode[]>();
  const subsubsectorsByParent = new Map<string, AdminNode[]>();

  for (const n of allNodes) {
    if (!n.parent_node_id) continue;
    if (n.node_type === "subsector") {
      const arr = subsectorsByParent.get(n.parent_node_id) ?? [];
      arr.push(n);
      subsectorsByParent.set(n.parent_node_id, arr);
    }
    if (n.node_type === "subsubsector") {
      const arr = subsubsectorsByParent.get(n.parent_node_id) ?? [];
      arr.push(n);
      subsubsectorsByParent.set(n.parent_node_id, arr);
    }
  }

  for (const sector of sectors) {
    // "Outward" direction: from centroid towards sector hub.
    const baseAngle = Math.atan2(
      sector.y_position - centroid.y,
      sector.x_position - centroid.x,
    );

    const subs = subsectorsByParent.get(sector.id) ?? [];
    const N = subs.length;
    if (N === 0) continue;

    // Proportional angular spread — more subsectors = wider arc, capped at 270°.
    const subSpread = N === 1 ? 0 : Math.min(N * ANGLE_PER_SUB, MAX_SUB_SPREAD);

    subs.forEach((sub, i) => {
      const angle =
        N === 1
          ? baseAngle
          : baseAngle - subSpread / 2 + (i / (N - 1)) * subSpread;

      const newX = clamp(sector.x_position + Math.cos(angle) * RADIUS_SUB);
      const newY = clamp(sector.y_position + Math.sin(angle) * RADIUS_SUB);

      // Mutate in-place so child nodes reference updated positions below.
      sub.x_position = newX;
      sub.y_position = newY;
      updates.push({ id: sub.id, x_position: newX, y_position: newY });

      // Subsubsectors fan from this subsector in the same outward direction.
      const subsubs = subsubsectorsByParent.get(sub.id) ?? [];
      const M = subsubs.length;
      if (M === 0) return;

      const subsubSpread =
        M === 1 ? 0 : Math.min(M * ANGLE_PER_SUBSUB, MAX_SUBSUB_SPREAD);

      subsubs.forEach((subsub, j) => {
        const subAngle =
          M === 1
            ? angle
            : angle - subsubSpread / 2 + (j / (M - 1)) * subsubSpread;

        const subX = clamp(newX + Math.cos(subAngle) * RADIUS_SUBSUB);
        const subY = clamp(newY + Math.sin(subAngle) * RADIUS_SUBSUB);

        subsub.x_position = subX;
        subsub.y_position = subY;
        updates.push({ id: subsub.id, x_position: subX, y_position: subY });
      });
    });
  }

  return updates;
}

// ── Stock assignment ──────────────────────────────────────────────────────────

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

  const sectorIdToEtf  = new Map<string, string>();
  const nodeToSectorId = new Map<string, string>();

  for (const n of allNodes) {
    if (n.node_type === "sector") sectorIdToEtf.set(n.id, n.id);
  }
  for (const n of allNodes) {
    if (n.node_type === "subsector" && n.parent_node_id && sectorIdToEtf.has(n.parent_node_id)) {
      nodeToSectorId.set(n.id, n.parent_node_id);
    }
  }
  for (const n of allNodes) {
    if (n.node_type === "subsubsector" && n.parent_node_id) {
      const ancestorSector = nodeToSectorId.get(n.parent_node_id);
      if (ancestorSector) nodeToSectorId.set(n.id, ancestorSector);
    }
  }

  const sectorNameToId = new Map<string, string>();
  for (const n of allNodes) {
    if (n.node_type === "sector" && n.company_name) {
      sectorNameToId.set(n.company_name.toLowerCase().replace(/\s+/g, ""), n.id);
    }
  }
  function stockSectorId(stock: AdminNode): string | null {
    if (!stock.sector) return null;
    return sectorNameToId.get(stock.sector.toLowerCase().replace(/\s+/g, "")) ?? null;
  }

  const peerMap = new Map<string, Set<string>>();
  for (const { ticker_a, ticker_b } of t2Conns) {
    if (!stockByTick.has(ticker_a) || !stockByTick.has(ticker_b)) continue;
    if (!peerMap.has(ticker_a)) peerMap.set(ticker_a, new Set());
    if (!peerMap.has(ticker_b)) peerMap.set(ticker_b, new Set());
    peerMap.get(ticker_a)!.add(ticker_b);
    peerMap.get(ticker_b)!.add(ticker_a);
  }

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

  const stockTarget = new Map<string, AdminNode>();

  stockT1Targets.forEach((candidates, ticker) => {
    if (candidates.length === 0) return;
    if (candidates.length === 1) { stockTarget.set(ticker, candidates[0]); return; }
    const peers = peerMap.get(ticker) ?? new Set<string>();
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      let peerOverlap = 0;
      peers.forEach((peer) => {
        if (stockT1Targets.get(peer)?.some((t) => t.id === candidate.id)) peerOverlap++;
      });
      const score = (SPECIFICITY[candidate.node_type] ?? 0) * 1_000_000 + peerOverlap * 1_000;
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    stockTarget.set(ticker, best);
  });

  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    const peers = peerMap.get(stock.ticker);
    if (!peers || peers.size === 0) return;
    const thisSectorId = stockSectorId(stock);
    const tally = new Map<string, { target: AdminNode; count: number }>();
    peers.forEach((peerTicker) => {
      const t = stockTarget.get(peerTicker);
      if (!t) return;
      if (thisSectorId) {
        const targetSectorId = t.node_type === "sector" ? t.id : nodeToSectorId.get(t.id);
        if (targetSectorId && targetSectorId !== thisSectorId) return;
      }
      const existing = tally.get(t.id);
      if (existing) existing.count++;
      else tally.set(t.id, { target: t, count: 1 });
    });
    let best: AdminNode | null = null;
    let bestScore = -Infinity;
    tally.forEach(({ target, count }) => {
      const score = (SPECIFICITY[target.node_type] ?? 0) * 1_000 + count;
      if (score > bestScore) { bestScore = score; best = target; }
    });
    if (best) stockTarget.set(stock.ticker, best);
  });

  const noT1: string[] = [];
  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    const sectorNode = stock.sector ? sectorByName.get(stock.sector) : undefined;
    if (sectorNode) stockTarget.set(stock.ticker, sectorNode);
    else noT1.push(stock.ticker);
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

  const nodes = allNodes as AdminNode[];
  const hierUpdates = layoutHierarchy(nodes);
  const { stockByTick, stockTarget, unresolvedT1, noT1 } =
    await buildAssignments(nodes, t1Res.data ?? [], t2Res.data ?? []);

  const dist: Record<string, number> = { subsubsector: 0, subsector: 0, sector: 0, none: noT1.length };
  const fallbackToSector: string[] = [];
  stockTarget.forEach((target, ticker) => {
    const type = target.node_type;
    dist[type] = (dist[type] ?? 0) + 1;
    if (type === "sector") fallbackToSector.push(ticker);
  });

  const clusterMap = new Map<string, { count: number; type: string }>();
  for (const n of nodes) {
    if (n.node_type === "subsector" || n.node_type === "subsubsector") {
      clusterMap.set(n.company_name ?? n.id, { count: 0, type: n.node_type });
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
    hierUpdates: hierUpdates.length,
    distribution: dist,
    unresolvedT1Count: unresolvedT1.length,
    unresolvedSample: unresolvedT1.slice(0, 20),
    fallbackToSector: fallbackToSector.slice(0, 50),
    noT1: noT1.slice(0, 50),
    topClusters: clusters.slice(0, 30),
  });
}

// ── POST: apply full layout ───────────────────────────────────────────────────

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

  const nodes = allNodes as AdminNode[];

  // 1. Layout hierarchy nodes (subsectors + subsubsectors).
  //    Mutates positions in `nodes` so stock scatter uses updated coordinates.
  const hierUpdates = layoutHierarchy(nodes);

  // 2. Assign each stock to its best hierarchy target and scatter into rings.
  const { stockByTick, stockTarget, peerMap } =
    await buildAssignments(nodes, t1Res.data ?? [], t2Res.data ?? []);

  const groups = new Map<string, string[]>();
  stockTarget.forEach((target, ticker) => {
    const list = groups.get(target.id) ?? [];
    list.push(ticker);
    groups.set(target.id, list);
  });
  groups.forEach((list) => {
    list.sort((a, b) => (peerMap.get(b)?.size ?? 0) - (peerMap.get(a)?.size ?? 0));
  });

  const stockUpdates: { id: string; x_position: number; y_position: number }[] = [];
  groups.forEach((tickers, targetId) => {
    const target = nodes.find((n) => n.id === targetId);
    if (!target) return;
    tickers.forEach((ticker, idx) => {
      const stock = stockByTick.get(ticker);
      if (!stock) return;
      const { dx, dy } = scatterOffset(idx, tickers.length);
      stockUpdates.push({
        id:         stock.id,
        x_position: clamp(target.x_position + dx),
        y_position: clamp(target.y_position + dy),
      });
    });
  });

  // 3. Write hierarchy + stock updates together in chunks.
  const allUpdates = [...hierUpdates, ...stockUpdates];
  const CHUNK = 500;
  let updated = 0;
  for (let i = 0; i < allUpdates.length; i += CHUNK) {
    const chunk = allUpdates.slice(i, i + CHUNK);
    const { error } = await supabaseAdmin.from("admin_nodes").upsert(chunk, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += chunk.length;
  }

  return NextResponse.json({
    ok:              true,
    hierRepositioned: hierUpdates.length,
    stockRepositioned: stockUpdates.length,
    total:           updated,
  });
}
