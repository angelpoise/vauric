import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";
import { discoverIR } from "@/lib/discoverIR";

export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { ticker?: string; companyName?: string };
  const { ticker, companyName } = body;
  if (!ticker || !companyName) {
    return NextResponse.json({ error: "ticker and companyName required" }, { status: 400 });
  }

  const url = await discoverIR(ticker, companyName);
  if (!url) {
    return NextResponse.json({ error: "Claude could not find an IR URL" }, { status: 404 });
  }

  return NextResponse.json({ ticker: ticker.toUpperCase(), url, success: true });
}
