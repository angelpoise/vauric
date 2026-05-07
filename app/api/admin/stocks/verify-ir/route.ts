// Vercel cron candidate: { "path": "/api/admin/stocks/verify-ir", "schedule": "0 6 * * 1" }
// (runs weekly on Monday at 6am UTC — IR pages change rarely)

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminRequest } from "@/lib/adminSecret";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const HEAD_TIMEOUT_MS = 5000;

async function headOk(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);
    const res = await fetch(url, {
      method:   "HEAD",
      redirect: "follow",
      signal:   controller.signal,
    });
    clearTimeout(timer);
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
    .from("admin_stocks")
    .select("ticker, company_name, investor_relations_url")
    .not("investor_relations_url", "is", null);

  if (!stocks?.length) return NextResponse.json({ checked: 0, updated: 0, failed: 0 });

  let checked = 0, updated = 0, failed = 0;
  const auth = req.headers.get("authorization") ?? "";

  for (const stock of stocks as Array<{
    ticker: string; company_name: string; investor_relations_url: string;
  }>) {
    if (!stock.investor_relations_url) continue;
    checked++;

    const ok = await headOk(stock.investor_relations_url);
    if (ok) continue;

    // URL is stale — rediscover via discover-ir
    try {
      const res = await fetch(`${APP_URL}/api/admin/stocks/discover-ir`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body:    JSON.stringify({ ticker: stock.ticker, companyName: stock.company_name }),
      });
      if (res.ok) updated++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ checked, updated, failed });
}
