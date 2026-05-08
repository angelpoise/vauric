import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface OverviewNode {
  id:           string;
  node_type:    "sector" | "subsector" | "subsubsector";
  company_name: string | null;
  display_name: string | null;
  etf_ticker:   string | null;
}

function buildPrompt(node: OverviewNode, parentName: string | null): string {
  const name = node.display_name ?? node.company_name ?? node.etf_ticker ?? "this node";
  const etf  = node.etf_ticker ? ` (${node.etf_ticker})` : "";

  if (node.node_type === "sector") {
    return (
      `Write a one-paragraph factual overview of the ${name}${etf} sector. ` +
      `Cover what kinds of companies belong to it, the main drivers and themes that affect its performance, ` +
      `and what role it plays in a typical investor's portfolio. ` +
      `Keep it neutral and educational, not promotional. 150–200 words.`
    );
  }
  if (node.node_type === "subsector") {
    const parent = parentName ?? "its parent sector";
    return (
      `Write a one-paragraph factual overview of the ${name}${etf} sub-sector within ${parent}. ` +
      `Cover what distinguishes it from the broader sector, the kinds of companies in it, ` +
      `and the specific themes or catalysts that drive its performance. ` +
      `150–200 words.`
    );
  }
  // subsubsector
  const parent = parentName ?? "its parent sub-sector";
  return (
    `Write a one-paragraph factual overview of the ${name} investment theme within ${parent}. ` +
    `Cover what the theme represents, what kinds of companies benefit from it, ` +
    `and what is driving investor interest in this area. ` +
    `150–200 words.`
  );
}

export async function generateOverview(
  node: OverviewNode,
  parentName?: string | null,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 400,
      messages:   [{ role: "user", content: buildPrompt(node, parentName ?? null) }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text.trim() : null;
    if (!text) return null;

    await supabaseAdmin
      .from("admin_nodes")
      .update({ cached_overview: text, cached_overview_generated_at: new Date().toISOString() })
      .eq("id", node.id);

    return text;
  } catch (err) {
    console.error("[generateOverview] failed for", node.id, err);
    return null;
  }
}
