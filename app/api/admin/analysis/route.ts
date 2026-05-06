import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminSecret";

// Admin-gated proxy to /api/analysis/scheduled — keeps PIPELINE_SECRET server-side.
export async function POST(req: NextRequest) {
  if (!await isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host  = req.headers.get("host") ?? "localhost:3000";
  const url   = `${proto}://${host}/api/analysis/scheduled`;

  const result = await fetch(url, {
    headers: { "X-Pipeline-Secret": process.env.PIPELINE_SECRET ?? "" },
  });
  const json = await result.json();
  return NextResponse.json(json);
}
