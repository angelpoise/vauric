import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const [stockRes, connRes, industryRes] = await Promise.all([
    supabaseAdmin
      .from("admin_nodes")
      .select("id", { count: "exact", head: true })
      .eq("node_type", "stock"),
    supabaseAdmin
      .from("admin_connections")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("admin_nodes")
      .select("id", { count: "exact", head: true })
      .eq("node_type", "subsubsector"),
  ]);

  return NextResponse.json({
    // Round DOWN to nearest 100/1000/10 so numbers never overstate
    stocks:      Math.floor((stockRes.count   ?? 1300)  / 100)  * 100,
    connections: Math.floor((connRes.count    ?? 18000) / 1000) * 1000,
    industries:  Math.floor((industryRes.count ?? 128)  / 10)   * 10,
  });
}
