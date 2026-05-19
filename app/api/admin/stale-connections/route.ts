import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30");
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: stocks, error } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, sector, connections_last_analyzed")
    .eq("node_type", "stock")
    .order("ticker")
    .limit(50000);

  if (error || !stocks) return NextResponse.json({ error: error?.message }, { status: 500 });

  const never   = stocks.filter((s) => !s.connections_last_analyzed);
  const stale   = stocks.filter((s) => s.connections_last_analyzed && s.connections_last_analyzed < cutoff);
  const current = stocks.filter((s) => s.connections_last_analyzed && s.connections_last_analyzed >= cutoff);

  return NextResponse.json({
    never:   never.map((s) => s.ticker),
    stale:   stale.map((s) => s.ticker),
    current: current.length,
    total:   stocks.length,
    days,
  });
}
