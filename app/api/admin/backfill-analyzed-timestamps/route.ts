import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// One-time backfill: stocks that already have connections are marked as stale
// (60 days ago) so they show up for periodic refresh but aren't "never analyzed".
// Stocks with zero connections stay null — they're the priority queue.
export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load all stocks
  const { data: stocks, error: stockErr } = await supabaseAdmin
    .from("admin_nodes")
    .select("id, ticker")
    .eq("node_type", "stock")
    .limit(50000);
  if (stockErr || !stocks) return NextResponse.json({ error: stockErr?.message }, { status: 500 });

  // Load distinct tickers that appear in admin_connections
  const { data: conns, error: connErr } = await supabaseAdmin
    .from("admin_connections")
    .select("ticker_a, ticker_b")
    .limit(500000);
  if (connErr || !conns) return NextResponse.json({ error: connErr?.message }, { status: 500 });

  const connectedTickers = new Set<string>();
  for (const c of conns) {
    connectedTickers.add(c.ticker_a);
    connectedTickers.add(c.ticker_b);
  }

  // Stocks that appear in connections → mark as stale (60 days ago)
  const staleDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const toBackfill = stocks
    .filter((s) => s.ticker && connectedTickers.has(s.ticker))
    .map((s) => s.id);

  const CHUNK = 500;
  let updated = 0;
  for (let i = 0; i < toBackfill.length; i += CHUNK) {
    const { error } = await supabaseAdmin
      .from("admin_nodes")
      .update({ connections_last_analyzed: staleDate })
      .in("id", toBackfill.slice(i, i + CHUNK));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated += Math.min(CHUNK, toBackfill.length - i);
  }

  return NextResponse.json({
    ok: true,
    backfilled: updated,
    neverAnalyzed: stocks.length - updated,
    total: stocks.length,
  });
}
