import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extractUrl(text: string): string | null {
  const match = text.trim().match(/https?:\/\/[^\s\n\r,;'")\]]+/);
  if (!match) return null;
  return match[0].replace(/[.,;:'")\]]+$/, "");
}

/**
 * Uses Claude with web_search to find the official IR page for a stock,
 * then persists the URL to admin_stocks.
 * Returns the URL on success, null if not found or on error.
 */
export async function discoverIR(ticker: string, companyName: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const upper = ticker.toUpperCase();

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      messages: [{
        role:    "user",
        content: `Find the official investor relations URL for ${companyName} (${upper} on NASDAQ/NYSE). ` +
                 `Return only the exact URL of their investor relations page, nothing else. ` +
                 `The URL should be the main IR page, not a specific filing or press release.`,
      }],
    });

    let url: string | null = null;
    for (const block of message.content) {
      if (block.type === "text") {
        const candidate = extractUrl(block.text);
        if (candidate) url = candidate;
      }
    }

    if (!url) return null;

    await supabaseAdmin
      .from("admin_stocks")
      .update({ investor_relations_url: url })
      .eq("ticker", upper);

    return url;
  } catch (err) {
    console.error("[discoverIR]", ticker, err);
    return null;
  }
}
