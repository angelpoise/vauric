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
// Ellipse-based layout — clean reset every run:
//   1. Sectors are placed on a fixed ellipse (sorts preserved, positions reset).
//   2. For each sector the "outward" direction is from ellipse centre → sector hub.
//   3. Subsectors fan outward at RADIUS_SUB in that direction.
//   4. Subsubsectors fan further outward at RADIUS_SUBSUB.
//   5. Stocks fill rings outward from their leaf node.
//
// All positions are in world-space units; canvas renders x*1600, y*1100.
// Graph has pan/zoom so nodes may legitimately sit outside 0-1.

// Ellipse on which sector hubs sit — uniform spacing (equal arc per sector).
const EL_CX = 1.2;
const EL_CY = 0.45;
const EL_A  = 3.20;  // sector ring radius (horizontal) — larger → more room for children
const EL_B  = 2.40;  // sector ring radius (vertical)

// Each child level progressively further out.
const RADIUS_SUB    = 1.60;
const RADIUS_SUBSUB = 1.10;
const STOCK_RADIUS  = 1.30;

// Per-node spread angle — no zone cap, just a fixed maximum arc so large sectors
// fan wide and small sectors scale proportionally.
// With EL_A=3.20 the inter-sector chord is ~1.80; subsectors overlap at >68°.
// We accept that tradeoff so the fans are actually visible.
const ANGLE_PER_SUB    = 0.20;   // ~11.5° per subsector
const MAX_SUB_ARC      = 1.20;   // ~69° hard cap for subsectors
const ANGLE_PER_SUBSUB = 0.22;   // ~12.6° per subsubsector
const MAX_SUBSUB_ARC   = 0.90;   // ~52° hard cap for subsubsectors

// Stocks sit on one curved arc.
const ANGLE_PER_STOCK = 0.055;
const MAX_STOCK_ARC   = Math.PI * 1.2;

// ── Stock curved-row placement ────────────────────────────────────────────────
// All stocks for a given parent sit on a single arc at STOCK_RADIUS,
// centred on the outward direction from the ellipse centre through the parent.

function stockArcOffset(
  idx: number,
  total: number,
  outwardAngle: number,
): { dx: number; dy: number } {
  const arc   = Math.min(total * ANGLE_PER_STOCK, MAX_STOCK_ARC);
  const angle = total === 1
    ? outwardAngle
    : outwardAngle - arc / 2 + (idx / (total - 1)) * arc;
  return { dx: Math.cos(angle) * STOCK_RADIUS, dy: Math.sin(angle) * STOCK_RADIUS };
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

  // Sort by name — stable regardless of current DB positions (which may have
  // degenerated to a single point after prior scaling runs).
  const sorted = sectors
    .map((s) => ({ s, nSubs: subsectorsByParent.get(s.id)?.length ?? 0 }))
    .sort((a, b) => (a.s.company_name ?? "").localeCompare(b.s.company_name ?? ""));

  // ── Step 1: Place sectors on the ellipse — UNIFORM spacing ─────────────────
  // Equal arc per sector regardless of subsector count → uniform gaps in the ring.
  const uniformArc = (2 * Math.PI) / sorted.length;
  let ellipseAngle = -Math.PI;

  for (const { s: sector } of sorted) {
    const mid         = ellipseAngle + uniformArc / 2;
    sector.x_position = EL_CX + Math.cos(mid) * EL_A;
    sector.y_position = EL_CY + Math.sin(mid) * EL_B;
    updates.push({ id: sector.id, x_position: sector.x_position, y_position: sector.y_position });
    ellipseAngle     += uniformArc;
  }

  // ── Step 2: Fan children outward ─────────────────────────────────────────────
  // Outward = ellipse centre → sector hub (always unambiguous).
  // Arc is capped at ZONE_CAP * uniformArc so children never cross into
  // an adjacent sector's territory.

  ellipseAngle = -Math.PI;

  for (const { s: sector, nSubs } of sorted) {
    const outward  = Math.atan2(sector.y_position - EL_CY, sector.x_position - EL_CX);
    const subArc   = Math.min(nSubs * ANGLE_PER_SUB, MAX_SUB_ARC);

    const subs = subsectorsByParent.get(sector.id) ?? [];
    const N    = subs.length;

    subs.forEach((sub, i) => {
      const angle = N === 1
        ? outward
        : outward - subArc / 2 + (i / (N - 1)) * subArc;

      const newX = sector.x_position + Math.cos(angle) * RADIUS_SUB;
      const newY = sector.y_position + Math.sin(angle) * RADIUS_SUB;
      sub.x_position = newX;
      sub.y_position = newY;
      updates.push({ id: sub.id, x_position: newX, y_position: newY });

      const subsubs   = subsubsectorsByParent.get(sub.id) ?? [];
      const M         = subsubs.length;
      if (M === 0) return;

      const ssArc    = Math.min(M * ANGLE_PER_SUBSUB, MAX_SUBSUB_ARC);

      subsubs.forEach((subsub, j) => {
        const sa   = M === 1 ? angle : angle - ssArc / 2 + (j / (M - 1)) * ssArc;
        const subX = newX + Math.cos(sa) * RADIUS_SUBSUB;
        const subY = newY + Math.sin(sa) * RADIUS_SUBSUB;
        subsub.x_position = subX;
        subsub.y_position = subY;
        updates.push({ id: subsub.id, x_position: subX, y_position: subY });
      });
    });

    ellipseAngle += uniformArc;
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
    // Outward direction for this cluster: from ellipse centre through the parent node.
    const outwardAngle = Math.atan2(target.y_position - EL_CY, target.x_position - EL_CX);
    tickers.forEach((ticker, idx) => {
      const stock = stockByTick.get(ticker);
      if (!stock) return;
      const { dx, dy } = stockArcOffset(idx, tickers.length, outwardAngle);
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

  const sectorSample = hierUpdates.slice(0, 11).map(u => ({ id: u.id, x: u.x_position, y: u.y_position }));

  return NextResponse.json({
    ok:               true,
    hierRepositioned: hierUpdates.length,
    stockRepositioned: stockUpdates.length,
    total:            updated,
    sectorSample,
    elA: EL_A,
    elB: EL_B,
  });
}
