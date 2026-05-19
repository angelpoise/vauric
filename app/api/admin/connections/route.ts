import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// Tier system:
// T1 = Exposure  — stock → industry (subsubsector) or sub-sector it belongs to
// T2 = Peer      — stock → stock, direct competitor or close relationship
// T3 = Impact    — stock → stock, indirect (supply chain, macro theme, cross-sector)
// Default for stock-stock = T2 (Peer); Impact (T3) must be set explicitly.
async function computeTier(idA: string, idB: string): Promise<number> {
  const { data: nodes } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, etf_ticker, node_type");

  const findType = (id: string): string | null => {
    if (!nodes) return null;
    return (
      nodes.find(
        (n) =>
          (n.ticker && n.ticker === id) ||
          (n.company_name && n.company_name === id) ||
          (n.etf_ticker && n.etf_ticker === id),
      )?.node_type ?? null
    );
  };

  const typeA = findType(idA);
  const typeB = findType(idB);
  const types = [typeA, typeB];

  // Any connection involving a hierarchy node is an Exposure connection
  if (types.includes("subsubsector") || types.includes("subsector") || types.includes("sector")) return 1;
  return 2; // stock-to-stock defaults to Peer
}

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();

  // Per-ticker lookup: no pagination needed, result is always small
  if (ticker) {
    const { data, error } = await supabaseAdmin
      .from("admin_connections")
      .select("*")
      .order("tier").order("ticker_a")
      .or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Full table: paginate in 1k pages to stay under Supabase max_rows cap
  const PAGE = 1000;
  const pages = await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      supabaseAdmin
        .from("admin_connections")
        .select("*")
        .order("tier").order("ticker_a")
        .range(i * PAGE, (i + 1) * PAGE - 1)
    )
  );
  const fetchError = pages.find((p) => p.error)?.error ?? null;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  const data = pages.flatMap((p) => p.data ?? []);
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ticker_a, ticker_b } = await req.json();
  if (!ticker_a || !ticker_b) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  // Delete either ordering — use exact strings, no forced case change so hierarchy names match
  const { error } = await supabaseAdmin
    .from("admin_connections")
    .delete()
    .or(
      `and(ticker_a.eq.${ticker_a},ticker_b.eq.${ticker_b}),` +
      `and(ticker_a.eq.${ticker_b},ticker_b.eq.${ticker_a})`,
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as { ticker_a?: string; ticker_b?: string; tier?: number; reason?: string };
  const { ticker_a, ticker_b } = body;
  if (!ticker_a || !ticker_b) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Auto-compute tier from node types; respect explicit override if valid
  const autoTier = await computeTier(ticker_a, ticker_b);
  const tier = (typeof body.tier === "number" && [1, 2, 3].includes(body.tier))
    ? body.tier
    : autoTier;

  const { data, error } = await supabaseAdmin
    .from("admin_connections")
    .insert({ ticker_a, ticker_b, tier, reason: body.reason ?? null })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
