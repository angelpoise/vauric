import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Universal visit tracker for any node type.
// Body: { id: string } (UUID) or { ticker: string } (stock backward compat).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: string; ticker?: string };

    let nodeId: string | null = null;
    let currentCount = 0;

    if (body.id) {
      const { data } = await supabaseAdmin
        .from("admin_nodes")
        .select("id, visit_count")
        .eq("id", body.id)
        .maybeSingle();
      if (data) { nodeId = data.id as string; currentCount = (data.visit_count as number | null) ?? 0; }
    } else if (body.ticker) {
      const { data } = await supabaseAdmin
        .from("admin_nodes")
        .select("id, visit_count")
        .eq("ticker", (body.ticker as string).toUpperCase())
        .maybeSingle();
      if (data) { nodeId = data.id as string; currentCount = (data.visit_count as number | null) ?? 0; }
    }

    if (nodeId) {
      await supabaseAdmin
        .from("admin_nodes")
        .update({ visit_count: currentCount + 1, last_visited_at: new Date().toISOString() })
        .eq("id", nodeId);
    }
  } catch {
    // Silent — visit tracking must never block or surface errors to the user
  }
  return NextResponse.json({ ok: true });
}
