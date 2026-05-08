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
  const etf  = node.etf_ticker ? ` (tracked by ${node.etf_ticker})` : "";

  if (node.node_type === "sector") {
    return (
      `Write a concise 2-paragraph overview of the ${name} sector${etf}.\n\n` +
      `First paragraph: explain what kinds of companies belong to this sector — give 3-4 representative examples of the types of businesses (not specific stock picks). Describe the main business activities and economic role of the sector.\n\n` +
      `Second paragraph: explain what drives the sector's performance — interest rate sensitivity, economic cycle exposure, regulatory factors, technological trends, or other key macro drivers. Mention typical investor use cases (defensive vs growth, cyclical vs secular, etc.).\n\n` +
      `Be educational and neutral. Do not recommend buying or selling anything. Aim for 150–200 words total. Write flowing prose, not bullet points.`
    );
  }

  if (node.node_type === "subsector") {
    const parent = parentName ? `the ${parentName} sector` : "its parent sector";
    return (
      `Write a concise 2-paragraph overview of the ${name} sub-sector within ${parent}.\n\n` +
      `First paragraph: explain what makes this sub-sector distinct from the broader sector. What kinds of companies belong specifically to this group? Give 2-3 representative examples of the types of businesses.\n\n` +
      `Second paragraph: explain the specific themes, trends, or catalysts that drive this sub-sector's performance, particularly things that might affect it differently from the parent sector. Include what makes it attractive to investors and key risks.\n\n` +
      `Be educational and neutral. Aim for 150–200 words total. Write flowing prose.`
    );
  }

  // subsubsector
  const parent = parentName ? `the ${parentName} sub-sector` : "its parent sub-sector";
  return (
    `Write a concise 2-paragraph overview of the ${name} theme within ${parent}.\n\n` +
    `First paragraph: explain what this specific theme represents. What is the underlying narrative or trend driving investor interest? What kinds of companies stand to benefit, and why is this theme generating attention now?\n\n` +
    `Second paragraph: discuss the maturity stage of this theme, key catalysts to watch in the next 12–24 months, and the main risks or counterarguments. Be balanced — include the bear case as well as the bull case.\n\n` +
    `Be educational and neutral. Aim for 150–200 words total. Write flowing prose.`
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
