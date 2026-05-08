// Vercel cron candidate: { "path": "/api/admin/stocks/verify-ir", "schedule": "0 6 * * 1" }
// (runs weekly on Monday at 6am UTC — IR pages change rarely)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";
import { discoverIR } from "@/lib/discoverIR";

const TIMEOUT_MS = 5000;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":     "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function urlOk(url: string): Promise<boolean> {
  // First try HEAD (cheap, no body download)
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal, headers: BROWSER_HEADERS });
    clearTimeout(t);
    if (res.status >= 200 && res.status < 400) return true;
  } catch { /* fall through */ }

  // Some IR pages block HEAD — retry with GET before declaring stale
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: BROWSER_HEADERS });
    clearTimeout(t);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: stocks } = await supabaseAdmin
    .from("admin_nodes")
    .select("ticker, company_name, investor_relations_url")
    .eq("node_type", "stock")
    .not("investor_relations_url", "is", null);

  if (!stocks?.length) return NextResponse.json({ checked: 0, updated: 0, failed: 0 });

  let checked = 0, updated = 0, failed = 0;

  for (const stock of stocks as Array<{
    ticker: string; company_name: string; investor_relations_url: string;
  }>) {
    if (!stock.investor_relations_url) continue;
    checked++;

    const ok = await urlOk(stock.investor_relations_url);
    if (ok) continue;

    // Both HEAD and GET failed — URL is stale, rediscover directly
    const newUrl = await discoverIR(stock.ticker, stock.company_name);
    if (newUrl) updated++;
    else failed++;
  }

  return NextResponse.json({ checked, updated, failed });
}
