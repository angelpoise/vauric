import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

function extractUrl(text: string): string | null {
  const match = text.trim().match(/https?:\/\/[^\s\n\r,;'")\]]+/);
  if (!match) return null;
  // Strip trailing punctuation that may be part of prose, not the URL
  return match[0].replace(/[.,;:'")\]]+$/, "");
}

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { ticker?: string; companyName?: string };
  const { ticker, companyName } = body;
  if (!ticker || !companyName) {
    return NextResponse.json({ error: "ticker and companyName required" }, { status: 400 });
  }

  const upper = ticker.toUpperCase();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  try {
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-20250514",
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

    // Extract URL from the final text block (after any tool_use blocks)
    let url: string | null = null;
    for (const block of message.content) {
      if (block.type === "text") {
        const candidate = extractUrl(block.text);
        if (candidate) url = candidate;
      }
    }

    if (!url) {
      return NextResponse.json({ error: "Claude could not find an IR URL" }, { status: 404 });
    }

    await supabaseAdmin
      .from("admin_stocks")
      .update({ investor_relations_url: url })
      .eq("ticker", upper);

    return NextResponse.json({ ticker: upper, url, success: true });
  } catch (err) {
    console.error("[discover-ir]", err);
    return NextResponse.json({ error: "Discovery failed" }, { status: 500 });
  }
}
