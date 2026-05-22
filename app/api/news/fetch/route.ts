import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";


// ─── Auth ──────────────────────────────────────────────────────────────────────
function isAuthorized(req: NextRequest): boolean {
  const pipelineSecret = process.env.PIPELINE_SECRET;
  const cronSecret     = process.env.VERCEL_CRON_SECRET;
  const customHeader   = req.headers.get("x-pipeline-secret");
  const authHeader     = req.headers.get("authorization");
  if (pipelineSecret && customHeader === pipelineSecret) return true;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  return false;
}

// ─── Handler ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "pipeline";
  if (!checkRateLimit(`pipeline:${ip}`, 1, 60 * 1000))
    return NextResponse.json({ error: "Pipeline triggered too recently — wait 1 minute" }, { status: 429 });

  return NextResponse.json({ processed: 0, inserted: 0, skipped: 0, message: "News source not configured" });
}
