import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// Determine tier from the node types of the two endpoints.
// Tier 1 = most specific (sub-sub-sector), Tier 3 = broadest (sector).
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

  if (types.includes("subsubsector")) return 1;
  if (types.includes("subsector"))    return 2;
  if (types.includes("sector"))       return 3;
  return 2; // stock-to-stock peer connection
}

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("admin_connections")
    .select("*")
    .order("tier")
    .order("ticker_a");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
  const body = await req.json() as { ticker_a?: string; ticker_b?: string; tier?: number };
  const { ticker_a, ticker_b } = body;
  if (!ticker_a || !ticker_b) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Auto-compute tier from node types; respect explicit override if valid
  const autoTier = await computeTier(ticker_a, ticker_b);
  const tier = (typeof body.tier === "number" && [1, 2, 3].includes(body.tier))
    ? body.tier
    : autoTier;

  const { data, error } = await supabaseAdmin
    .from("admin_connections")
    .insert({ ticker_a, ticker_b, tier })
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
