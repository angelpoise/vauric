import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";
import { hydrateSingleTicker } from "@/lib/fundamentalsUtils";
import { discoverIR } from "@/lib/discoverIR";

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const typeFilter = req.nextUrl.searchParams.get("node_type");
  let query = supabaseAdmin.from("admin_nodes").select("*").order("node_type").order("company_name");
  if (typeFilter) query = query.eq("node_type", typeFilter);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as Record<string, unknown>;
  const nodeType = (body.node_type as string | undefined) ?? "stock";

  if (!["stock", "sector", "subsector", "subsubsector"].includes(nodeType)) {
    return NextResponse.json({ error: "Invalid node_type" }, { status: 400 });
  }

  let payload: Record<string, unknown>;

  if (nodeType === "stock") {
    const { ticker, company_name, sector, x_position, y_position, investor_relations_url } = body;
    if (!ticker || !company_name || !sector) {
      return NextResponse.json({ error: "Missing fields: ticker, company_name, sector" }, { status: 400 });
    }
    payload = {
      node_type: "stock",
      ticker: (ticker as string).toUpperCase(),
      company_name,
      sector,
      x_position: x_position ?? 0.5,
      y_position: y_position ?? 0.5,
      analysis_schedule: "weekly",
      scenario_schedule: "weekly",
      ...(investor_relations_url ? { investor_relations_url } : {}),
    };
  } else {
    const { company_name, display_name, etf_ticker, colour, parent_node_id, x_position, y_position, tags } = body;
    if (!company_name) {
      return NextResponse.json({ error: "Missing field: company_name" }, { status: 400 });
    }
    payload = {
      node_type: nodeType,
      company_name,
      display_name: display_name ?? company_name,
      etf_ticker: etf_ticker ?? null,
      colour: colour ?? null,
      parent_node_id: parent_node_id ?? null,
      x_position: x_position ?? 0.5,
      y_position: y_position ?? 0.5,
      tags: tags ?? [],
    };
  }

  const { data, error } = await supabaseAdmin
    .from("admin_nodes")
    .insert(payload)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (nodeType === "stock") {
    const upper = (body.ticker as string).toUpperCase();
    hydrateSingleTicker(upper).catch((err) =>
      console.error(`[admin/nodes] fundamentals hydration failed for ${upper}:`, err)
    );
    if (!(body.investor_relations_url as string | undefined)?.trim()) {
      discoverIR(upper, body.company_name as string).catch((err) =>
        console.error(`[admin/nodes] IR discovery failed for ${upper}:`, err)
      );
    }
  }

  revalidatePath("/api/graph");
  revalidatePath("/graph");
  if (nodeType === "stock") revalidatePath("/api/fundamentals");

  return NextResponse.json(data, { status: 201 });
}
