// Required Supabase schema additions to admin_nodes:
//
//   ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS visit_count INTEGER DEFAULT 0;
//   ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMPTZ;
//   ALTER TABLE admin_nodes ADD COLUMN IF NOT EXISTS analysis_schedule TEXT DEFAULT 'on_visit';

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ticker = (body?.ticker as string | undefined)?.toUpperCase();
    if (!ticker) return NextResponse.json({ ok: true });

    // Read current count then increment (race condition acceptable for a view counter)
    const { data } = await supabaseAdmin
      .from("admin_nodes")
      .select("visit_count")
      .eq("ticker", ticker)
      .single();

    await supabaseAdmin
      .from("admin_nodes")
      .update({
        visit_count:     (data?.visit_count ?? 0) + 1,
        last_visited_at: new Date().toISOString(),
      })
      .eq("ticker", ticker);
  } catch {
    // Silently ignore — visit tracking must never block or error-surface to the user
  }
  return NextResponse.json({ ok: true });
}
