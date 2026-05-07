import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyClerkTokenWithTier } from "@/lib/verifyClerkToken";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vauric.io";

function confirmationEmail(
  ticker: string,
  reportDate: string,
  reportTime: string | null,
): string {
  const dateLabel = new Date(reportDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const timeLabel =
    reportTime === "pre-market"    ? " (pre-market)"
    : reportTime === "after-hours"   ? " (after hours)"
    : reportTime === "during-market" ? " (during market hours)"
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:28px">
      <span style="font-size:18px;font-weight:700;letter-spacing:0.12em;color:#fff">VAURIC</span>
    </div>
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:32px">
      <p style="font-size:12px;color:#475569;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 16px">Earnings Reminder Set</p>
      <h1 style="font-size:28px;font-weight:700;letter-spacing:0.06em;color:#f1f5f9;margin:0 0 6px">${ticker}</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 28px">
        We'll remind you before <strong style="color:#94a3b8">${ticker}</strong> reports earnings on<br>
        <strong style="color:#f1f5f9">${dateLabel}${timeLabel}</strong>.
      </p>
      <a href="${APP_URL}/stock/${ticker}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500">View ${ticker} →</a>
    </div>
    <p style="font-size:11px;color:#334155;margin:20px 0 0;text-align:center">
      Vauric · Earnings reminders · <a href="${APP_URL}/account" style="color:#475569">Manage account</a>
    </p>
  </div>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const { isPro, userId: tokenUserId } = await verifyClerkTokenWithTier(
    req.headers.get("authorization"),
  );
  if (!tokenUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPro)       return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });

  const body = await req.json() as { userId?: string; ticker?: string; reportDate?: string };
  const { userId, ticker, reportDate } = body;

  if (tokenUserId !== userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ticker || !reportDate) {
    return NextResponse.json({ error: "ticker and reportDate required" }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();

  // Idempotent — skip insert if reminder already exists
  const { data: existing } = await supabaseAdmin
    .from("earnings_reminders")
    .select("id")
    .eq("clerk_user_id", userId)
    .eq("ticker", upperTicker)
    .eq("report_date", reportDate)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabaseAdmin
      .from("earnings_reminders")
      .insert({ clerk_user_id: userId, ticker: upperTicker, report_date: reportDate });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch report_time for email
  const { data: calRow } = await supabaseAdmin
    .from("earnings_calendar")
    .select("report_time")
    .eq("ticker", upperTicker)
    .eq("report_date", reportDate)
    .maybeSingle();

  // Confirmation email
  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId!);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (email) {
      await resend.emails.send({
        from:    "notifications@vauric.io",
        to:      email,
        subject: `[Vauric] Earnings reminder set — ${upperTicker}`,
        html:    confirmationEmail(upperTicker, reportDate, calRow?.report_time ?? null),
      });
    }
  } catch (err) {
    console.error("[earnings/remind] email failed:", err);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
