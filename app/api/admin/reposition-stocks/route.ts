import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// Accepts either a Clerk admin session OR the pipeline secret so the route
// can be triggered from the CLI as well as from the browser admin panel.
async function isAuthorised(req: NextRequest): Promise<boolean> {
  const secret = process.env.PIPELINE_SECRET;
  if (secret && req.headers.get("x-pipeline-secret") === secret) return true;
  return isAdminRequest(req);
}

// ── Layout constants ──────────────────────────────────────────────────────────
//
// Hierarchy layout — zone allocation approach:
//   1. Sort sectors by their angle around the centroid.
//   2. Assign each sector a proportional angular zone (more subsectors = wider zone).
//      Zones are non-overlapping and together cover 360°.
//   3. Spread each sector's subsectors within its zone at RADIUS_SUB from the hub.
//   4. Subsubsectors fan from their subsector using a narrower slice of the same zone.
//   5. Stocks fill rings around their leaf node.
//
// Using zone centre (not just raw outward angle) guarantees no two sectors
// share the same angular region, eliminating the central blob.
//
// All positions are normalized 0-1; canvas renders at 1600×1100 px.

// Sector positions are in world-space units (not constrained to 0-1).
// Canvas renders positions as x_position * 1600 / y_position * 1100,
// and the graph has pan/zoom so nodes can legitimately sit outside 0-1.
// DO NOT clamp to 0-1 — that was collapsing off-canvas sectors onto the boundary.

const RADIUS_SUB        = 0.28;          // subsector spread from sector hub
const RADIUS_SUBSUB     = 0.16;          // subsubsector spread from subsector
const MAX_SUBSUB_SPREAD = Math.PI * 0.7; // cap subsubsector arc at 126°

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

function layoutHierarchy(
  allNodes: AdminNode[],
): { id: string; x_position: number; y_position: number }[] {
  const updates: { id: string; x_position: number; y_position: number }[] = [];

  const sectors = allNodes.filter((n) => n.node_type === "sector");

  // Canvas centroid — used only to sort sectors by angular position.
  const centroid = sectors.length
    ? {
        x: sectors.reduce((s, n) => s + n.x_position, 0) / sectors.length,
        y: sectors.reduce((s, n) => s + n.y_position, 0) / sectors.length,
      }
    : { x: 0.5, y: 0.5 };

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

  // ── Zone allocation ────────────────────────────────────────────────────────
  // Sort sectors clockwise by their angle around the centroid, then assign each
  // a proportional angular zone covering the full 360°.  Subsectors spread
  // within the zone, applied outward from the sector hub — guaranteeing no two
  // sectors' children share the same angular region.

  const sorted = sectors
    .map((s) => ({
      s,
      angle: Math.atan2(s.y_position - centroid.y, s.x_position - centroid.x),
      weight: Math.max(subsectorsByParent.get(s.id)?.length ?? 0, 1),
    }))
    .sort((a, b) => a.angle - b.angle);

  const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);

  let zoneStart = -Math.PI;

  for (const { s: sector, weight } of sorted) {
    const zoneWidth  = (weight / totalWeight) * 2 * Math.PI;
    const zoneCenter = zoneStart + zoneWidth / 2;

    const subs = subsectorsByParent.get(sector.id) ?? [];
    const N    = subs.length;

    // Sectors sit on the outer ring; subsectors must spread INWARD toward the
    // canvas interior, not outward (which would go off-screen). Flip 180°.
    const inward = zoneCenter + Math.PI;
    const arc    = zoneWidth * 0.80;

    subs.forEach((sub, i) => {
      const angle = N === 1
        ? inward
        : inward - arc / 2 + (i / (N - 1)) * arc;

      const newX = sector.x_position + Math.cos(angle) * RADIUS_SUB;
      const newY = sector.y_position + Math.sin(angle) * RADIUS_SUB;

      sub.x_position = newX;
      sub.y_position = newY;
      updates.push({ id: sub.id, x_position: newX, y_position: newY });

      // Subsubsectors get a narrower arc within the same zone slice.
      const subsubs = subsubsectorsByParent.get(sub.id) ?? [];
      const M       = subsubs.length;
      if (M === 0) return;

      const subArc = Math.min((arc / N) * 0.9, MAX_SUBSUB_SPREAD);

      subsubs.forEach((subsub, j) => {
        const subAngle = M === 1
          ? angle
          : angle - subArc / 2 + (j / (M - 1)) * subArc;

        const subX = newX + Math.cos(subAngle) * RADIUS_SUBSUB;
        const subY = newY + Math.sin(subAngle) * RADIUS_SUBSUB;

        subsub.x_position = subX;
        subsub.y_position = subY;
        updates.push({ id: subsub.id, x_position: subX, y_position: subY });
      });
    });

    zoneStart += zoneWidth;
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
  if (!await isAuthorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (!await isAuthorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // 1. Layout hierarchy nodes — mutates positions in `nodes` so stock scatter
  //    references the updated coordinates.
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
        x_position: target.x_position + dx,
        y_position: target.y_position + dy,
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
    ok:               true,
    hierRepositioned: hierUpdates.length,
    stockRepositioned: stockUpdates.length,
    total:            updated,
  });
}
