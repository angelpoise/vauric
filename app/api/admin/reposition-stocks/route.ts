import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// Scatter radius (in normalised coordinate units) for stocks around their industry node.
// Positions are arranged in concentric rings so stocks don't stack on top of each other.
function scatterOffset(idx: number, total: number): { dx: number; dy: number } {
  if (total === 1) return { dx: 0, dy: 0 };
  // Ring layout: 1st ring holds 8, 2nd ring 16, etc.
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

  // 2. Load all T1 (Exposure) connections
  const { data: t1Conns, error: connErr } = await supabaseAdmin
    .from("admin_connections")
    .select("ticker_a, ticker_b")
    .eq("tier", 1);
  if (connErr || !t1Conns) return NextResponse.json({ error: connErr?.message ?? "Failed to load connections" }, { status: 500 });

  // Build lookup maps
  const stockById   = new Map<string, typeof allNodes[number]>();
  const stockByTick = new Map<string, typeof allNodes[number]>();
  const hierByName  = new Map<string, typeof allNodes[number]>();
  const sectorByName = new Map<string, typeof allNodes[number]>(); // sector name → sector node

  for (const n of allNodes) {
    if (n.node_type === "stock" && n.ticker) {
      stockById.set(n.id, n);
      stockByTick.set(n.ticker, n);
    } else if (n.node_type === "subsector" || n.node_type === "subsubsector") {
      if (n.company_name) hierByName.set(n.company_name, n);
    } else if (n.node_type === "sector") {
      if (n.company_name) sectorByName.set(n.company_name, n);
    }
  }

  // 3. For each stock find its best T1 target (subsubsector > subsector)
  const stockTarget = new Map<string, typeof allNodes[number]>(); // ticker → best hierarchy node

  for (const c of t1Conns) {
    const { ticker_a, ticker_b } = c;
    // Determine which end is the stock and which is the hierarchy node
    const stock = stockByTick.get(ticker_a) ?? stockByTick.get(ticker_b);
    const hierName = stockByTick.has(ticker_a) ? ticker_b : ticker_a;
    if (!stock || !stock.ticker) continue;
    const hier = hierByName.get(hierName);
    if (!hier) continue;

    const existing = stockTarget.get(stock.ticker);
    // Prefer subsubsector over subsector
    const betterSpecificity =
      !existing ||
      (hier.node_type === "subsubsector" && existing.node_type !== "subsubsector");
    if (betterSpecificity) stockTarget.set(stock.ticker, hier);
  }

  // 4. For stocks with no T1, fall back to sector node
  stockByTick.forEach((stock) => {
    if (!stock.ticker || stockTarget.has(stock.ticker)) return;
    if (stock.sector) {
      const sectorNode = sectorByName.get(stock.sector);
      if (sectorNode) stockTarget.set(stock.ticker, sectorNode);
    }
  });

  // 5. Group stocks by target node for scatter layout
  const groups = new Map<string, string[]>(); // target node id → [tickers]
  stockTarget.forEach((target, ticker) => {
    const list = groups.get(target.id) ?? [];
    list.push(ticker);
    groups.set(target.id, list);
  });

  // Sort tickers within each group alphabetically for deterministic layout
  groups.forEach((list) => list.sort());

  // 6. Compute new positions
  const updates: { id: string; x_position: number; y_position: number }[] = [];

  groups.forEach((tickers, targetId) => {
    const target = allNodes.find(n => n.id === targetId);
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

  // 7. Batch-update positions in chunks of 500
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
