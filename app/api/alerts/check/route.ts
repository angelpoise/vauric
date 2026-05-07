// CRON — add to vercel.json "crons" array when upgrading to Vercel Pro:
//   { "path": "/api/alerts/check", "schedule": "0,15,30,45 * * * *" }
// Runs every 15 minutes to check price alerts against live market data.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { clerkClient } from "@clerk/nextjs/server";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIPELINE_SECRET;
  return !!secret && req.headers.get("x-pipeline-secret") === secret;
}

function alertEmail(
  ticker: string,
  direction: string,
  targetPrice: number,
  currentPrice: number,
  appUrl: string,
): string {
  const dirLabel = direction === "above" ? "risen above" : "fallen below";
  const sign     = direction === "above" ? "▲" : "▼";
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:520px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:28px">
      <span style="font-size:18px;font-weight:700;letter-spacing:0.12em;color:#fff">VAURIC</span>
    </div>
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:32px">
      <p style="font-size:12px;color:#475569;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 16px">Price Alert Triggered</p>
      <h1 style="font-size:28px;font-weight:700;letter-spacing:0.06em;color:#f1f5f9;margin:0 0 6px">${ticker}</h1>
      <p style="font-size:14px;color:#64748b;margin:0 0 28px">has ${dirLabel} your target price</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <tr>
          <td style="padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:8px 8px 0 0;border-bottom:1px solid rgba(255,255,255,0.05)">
            <span style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.06em">Target</span><br>
            <span style="font-size:20px;font-weight:600;color:#f1f5f9">${sign} $${targetPrice.toFixed(2)}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:0 0 8px 8px">
            <span style="font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.06em">Current price</span><br>
            <span style="font-size:20px;font-weight:600;color:#3b82f6">$${currentPrice.toFixed(2)}</span>
          </td>
        </tr>
      </table>
      <a href="${appUrl}/stock/${ticker}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:500">View ${ticker} →</a>
    </div>
    <p style="font-size:11px;color:#334155;margin:20px 0 0;text-align:center">
      Vauric · Price alert notifications · <a href="${appUrl}/account" style="color:#475569">Manage alerts</a>
    </p>
  </div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vauric.io";

  // Fetch all untriggered alerts
  const { data: alerts, error: alertsErr } = await supabaseAdmin
    .from("price_alerts")
    .select("id, clerk_user_id, ticker, target_price, direction");

  if (alertsErr || !alerts) {
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }

  if (alerts.length === 0) {
    return NextResponse.json({ checked: 0, triggered: 0 });
  }

  // Fetch current market prices
  let prices: Record<string, number> = {};
  try {
    const mdRes = await fetch(`${appUrl}/api/market-data`);
    if (mdRes.ok) {
      const md = await mdRes.json();
      for (const [ticker, entry] of Object.entries(md)) {
        prices[ticker] = (entry as { price: number }).price;
      }
    }
  } catch { /* use empty prices — alerts won't trigger */ }

  let triggered = 0;
  const clerk = await clerkClient();

  for (const alert of alerts as Array<{
    id: string;
    clerk_user_id: string;
    ticker: string;
    target_price: number;
    direction: string;
  }>) {
    const currentPrice = prices[alert.ticker];
    if (currentPrice == null) continue;

    const hit =
      (alert.direction === "above" && currentPrice >= alert.target_price) ||
      (alert.direction === "below" && currentPrice <= alert.target_price);

    if (!hit) continue;

    // Mark as triggered
    await supabaseAdmin
      .from("price_alerts")
      .update({ triggered: true, triggered_at: new Date().toISOString() })
      .eq("id", alert.id);

    triggered++;

    // Get user email from Clerk
    try {
      const clerkUser = await clerk.users.getUser(alert.clerk_user_id);
      const email     = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) continue;

      await resend.emails.send({
        from:    "notifications@vauric.io",
        to:      email,
        subject: `[Vauric] Price alert triggered — ${alert.ticker}`,
        html:    alertEmail(alert.ticker, alert.direction, alert.target_price, currentPrice, appUrl),
      });
    } catch (err) {
      console.error(`[alerts/check] email failed for alert ${alert.id}:`, err);
    }
  }

  console.log(`[alerts/check] checked=${alerts.length} triggered=${triggered}`);
  return NextResponse.json({ checked: alerts.length, triggered });
}
