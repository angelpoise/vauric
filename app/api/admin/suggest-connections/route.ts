import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

interface DBNode {
  node_type: string;
  ticker: string | null;
  company_name: string | null;
  display_name: string | null;
  etf_ticker: string | null;
}

function nodeId(n: DBNode): string {
  if (n.node_type === "stock")  return n.ticker ?? "";
  if (n.node_type === "sector") return n.etf_ticker ?? n.company_name ?? "";
  return n.company_name ?? "";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.ticker) return NextResponse.json({ error: "ticker required" }, { status: 400 });

  const ticker = (body.ticker as string).toUpperCase();

  const [stockRes, allNodesRes, existingRes] = await Promise.all([
    supabase
      .from("admin_nodes")
      .select("ticker, company_name, sector")
      .eq("node_type", "stock")
      .eq("ticker", ticker)
      .single(),
    supabase
      .from("admin_nodes")
      .select("node_type, ticker, company_name, display_name, etf_ticker")
      .order("node_type"),
    supabase
      .from("admin_connections")
      .select("ticker_a, ticker_b")
      .or(`ticker_a.eq.${ticker},ticker_b.eq.${ticker}`),
  ]);

  if (stockRes.error || !stockRes.data) {
    return NextResponse.json({ error: "Stock not found" }, { status: 404 });
  }

  const stock = stockRes.data;
  const allNodes: DBNode[] = allNodesRes.data ?? [];
  const existing = existingRes.data ?? [];

  const existingIds = new Set(
    existing.map((c) => (c.ticker_a === ticker ? c.ticker_b : c.ticker_a))
  );

  const subsectors    = allNodes.filter((n) => n.node_type === "subsector");
  const subsubsectors = allNodes.filter((n) => n.node_type === "subsubsector");
  const otherStocks   = allNodes.filter((n) => n.node_type === "stock" && n.ticker !== ticker);

  // Build prompt context
  const subsectorLines    = subsectors.map((n)    => `  "${n.company_name}"`).join("\n") || "  (none)";
  const subsubsectorLines = subsubsectors.map((n) => `  "${n.company_name}"`).join("\n") || "  (none)";
  const stockLines        = otherStocks.map((n)   => `  ${n.ticker} — ${n.company_name ?? ""}`).join("\n") || "  (none)";
  const existingNote      = existingIds.size > 0
    ? `Already connected to: ${Array.from(existingIds).join(", ")}`
    : "No existing explicit connections.";

  const graphTickerSet = new Set(otherStocks.map((n) => n.ticker ?? "").filter(Boolean));

  const prompt = `You are curating a financial knowledge graph. Suggest connections for this stock.

Stock: ${ticker} (${stock.company_name ?? "Unknown"})
GICS Sector: ${stock.sector ?? "Unknown"}
${existingNote}

Available sub-sectors:
${subsectorLines}

Available sub-sub-sectors:
${subsubsectorLines}

Other stocks in graph:
${stockLines}

Connection tiers:
- T1 (Structural membership): Every sub-sector or sub-sub-sector where this company has a PRIMARY business presence — meaning the company manufactures, develops, or delivers that category as a core product line, not just as a customer or end-user. A stock should get T1 for ALL sub-sectors it genuinely belongs to. For example, a DRAM/NAND memory chip maker belongs in BOTH "Semiconductors" (it fabricates chips) AND any storage-related sub-sector (its products ARE storage). Do not artificially limit to one T1 just because the company has a dominant category.
- T2 (Strong peers/themes): Direct competitor stocks or close peers; stocks with strong supply-chain or thematic overlap; sub-sectors where this stock has a meaningful but secondary/adjacent presence.
- T3 (Indirect/weak): Loose thematic links only — e.g., a raw material supplier to this company's industry, or end-market customers of a loosely related product. If you are unsure whether something is T2 or T3, prefer T2.

Rules:
- Use EXACT text from the lists (e.g., "Semiconductors" not "semiconductor")
- Do NOT suggest sector ETF nodes (XLK, XLF, etc.) — those auto-connect via the sector field
- Do NOT suggest nodes already in the existing connections list
- Aim for 1-3 T1 items (more if genuinely warranted), 2-5 T2 items, 0-3 T3 items
- Each reason ≤ 10 words
- When in doubt between T1 and T2, ask: does the company MAKE/BUILD things in that category (→ T1) or just USE/COMPETE-ADJACENT to them (→ T2)?

Additionally, identify up to 5 important companies NOT currently in the graph that would be highly relevant connections for ${ticker} if they were added. Only include companies with a genuine, significant relationship (direct competitor, major supplier, key customer, or strong thematic peer). Do not include companies already in the "Other stocks in graph" list above.

Return ONLY valid JSON, no other text:
{
  "t1": [{"id": "exact name or ticker", "reason": "brief reason"}],
  "t2": [{"id": "exact name or ticker", "reason": "brief reason"}],
  "t3": [{"id": "exact name or ticker", "reason": "brief reason"}],
  "missing": [{"ticker": "TICKER", "name": "Full Company Name", "reason": "brief reason", "tier": 1}]
}`;

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: "AI response parsing failed" }, { status: 500 });

    const parsed = JSON.parse(jsonMatch[0]) as {
      t1?: { id: string; reason: string }[];
      t2?: { id: string; reason: string }[];
      t3?: { id: string; reason: string }[];
      missing?: { ticker: string; name: string; reason: string; tier: number }[];
    };

    // Map node ID → node_type for enriching the response
    const nodeTypeMap = new Map<string, string>(
      allNodes.map((n) => [nodeId(n), n.node_type])
    );

    // Valid IDs: only subsectors, subsubsectors, and stocks (not sector ETFs)
    const validIds = new Set([
      ...subsectors.map((n) => n.company_name ?? ""),
      ...subsubsectors.map((n) => n.company_name ?? ""),
      ...otherStocks.map((n) => n.ticker ?? ""),
    ].filter(Boolean));

    const validate = (arr: { id: string; reason: string }[] | undefined) =>
      (arr ?? [])
        .filter((s) => validIds.has(s.id) && !existingIds.has(s.id))
        .map((s) => ({ id: s.id, reason: s.reason, nodeType: nodeTypeMap.get(s.id) ?? "stock" }));

    const missing = (parsed.missing ?? [])
      .filter((m) => m.ticker && !graphTickerSet.has(m.ticker.toUpperCase()) && m.ticker.toUpperCase() !== ticker)
      .map((m) => ({ ticker: m.ticker.toUpperCase(), name: m.name, reason: m.reason, tier: m.tier as 1|2|3 }));

    return NextResponse.json({
      t1: validate(parsed.t1),
      t2: validate(parsed.t2),
      t3: validate(parsed.t3),
      missing,
    });
  } catch (err) {
    console.error("suggest-connections error:", err);
    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}
