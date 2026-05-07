// CRON — daily at 8am UTC
// vercel.json: { "path": "/api/earnings-calendar/check", "schedule": "0 8 * * *" }

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vauric.io";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIPELINE_SECRET;
  return !!secret && req.headers.get("x-pipeline-secret") === secret;
}

function reminderEmail(
  ticker: string,
  reportDate: string,
  reportTime: string | null,
): string {
  const dateLabel = new Date(reportDate + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });
  const timeChip =
    reportTime === "pre-market"    ? "(pre-market)"
    : reportTime === "after-hours"   ? "(after hours)"
    : reportTime === "during-market" ? "(during market hours)"
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:28px">
      <span style="font-size:18px;font-weight:700;letter-spacing:0.12em;color:#fff">VAURIC</span>
    </div>
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:32px">
      <p style="font-size:12px;color:#475569;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 16px">Earnings Tomorrow</p>
      <h1 style="font-size:28px;font-weight:700;letter-spacing:0.06em;color:#f1f5f9;margin:0 0 6px">${ticker}</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 28px">
        reports earnings tomorrow, <strong style="color:#f1f5f9">${dateLabel}</strong>
        ${timeChip ? `<span style="color:#94a3b8"> ${timeChip}</span>` : ""}.
      </p>
      <a href="${APP_URL}/stock/${ticker}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500">View analysis →</a>
    </div>
    <p style="font-size:11px;color:#334155;margin:20px 0 0;text-align:center">
      Vauric · Earnings reminders · <a href="${APP_URL}/account" style="color:#475569">Manage account</a>
    </p>
  </div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split("T")[0];

  const { data: reminders, error } = await supabaseAdmin
    .from("earnings_reminders")
    .select("id, clerk_user_id, ticker, report_date")
    .eq("report_date", tomorrow)
    .eq("reminded", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!reminders || reminders.length === 0) {
    return NextResponse.json({ checked: 0, sent: 0 });
  }

  // Fetch report times for all tickers reporting tomorrow
  const tickers = Array.from(new Set(reminders.map((r: { ticker: string }) => r.ticker)));
  const { data: calRows } = await supabaseAdmin
    .from("earnings_calendar")
    .select("ticker, report_time")
    .in("ticker", tickers)
    .eq("report_date", tomorrow);

  const timeMap: Record<string, string | null> = {};
  for (const row of calRows ?? []) timeMap[row.ticker] = row.report_time;

  const clerk = await clerkClient();
  let sent = 0;

  for (const reminder of reminders as Array<{
    id: string; clerk_user_id: string; ticker: string; report_date: string;
  }>) {
    try {
      const clerkUser = await clerk.users.getUser(reminder.clerk_user_id);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) continue;

      await resend.emails.send({
        from:    "notifications@vauric.io",
        to:      email,
        subject: `[Vauric] Earnings reminder — ${reminder.ticker} reports tomorrow`,
        html:    reminderEmail(reminder.ticker, reminder.report_date, timeMap[reminder.ticker] ?? null),
      });

      await supabaseAdmin
        .from("earnings_reminders")
        .update({ reminded: true })
        .eq("id", reminder.id);

      sent++;
    } catch (err) {
      console.error(`[earnings/check] failed for reminder ${reminder.id}:`, err);
    }
  }

  console.log(`[earnings/check] checked=${reminders.length} sent=${sent}`);
  return NextResponse.json({ checked: reminders.length, sent });
}
