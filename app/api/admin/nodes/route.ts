import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

// POST /api/admin/nodes — bulk actions on hierarchy nodes
export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json() as { action?: string };

  if (action === "clear-overviews") {
    const { error } = await supabaseAdmin
      .from("admin_nodes")
      .update({ cached_overview: null, cached_overview_generated_at: null })
      .in("node_type", ["sector", "subsector", "subsubsector"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "All hierarchy overviews cleared. They will regenerate on next page visit." });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
