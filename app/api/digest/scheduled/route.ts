// Vercel cron: "0 21 * * 1-5" — weekdays 4pm ET (21:00 UTC)
// Sends daily market close digest to users with daily_digest = true.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { clerkClient } from "@clerk/nextjs/server";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.PIPELINE_SECRET;
  return !!secret && req.headers.get("x-pipeline-secret") === secret;
}

function moveColor(move: number): string {
  return move >= 0 ? "#22c55e" : "#ef4444";
}

function moveLabel(move: number): string {
  return `${move >= 0 ? "+" : ""}${move.toFixed(2)}%`;
}

function digestEmail(
  userName: string,
  portfolio: { ticker: string; move: number; price: number }[],
  alerts: { ticker: string; direction: string; target: number; current: number; pct: number }[],
  appUrl: string,
): string {
  const hasPortfolio = portfolio.length > 0;
  const hasAlerts    = alerts.length > 0;

  const portfolioRows = portfolio.map(({ ticker, move, price }) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;font-weight:600;color:#f1f5f9;letter-spacing:0.04em">${ticker}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;color:#94a3b8;text-align:right">$${price.toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;font-weight:600;color:${moveColor(move)};text-align:right">${moveLabel(move)}</td>
    </tr>`).join("");

  const alertRows = alerts.map(({ ticker, direction, target, current, pct }) => {
    const pctLabel = `${Math.abs(pct).toFixed(1)}% ${direction === "above" ? "below" : "above"} target`;
    return `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;font-weight:600;color:#f1f5f9;letter-spacing:0.04em">${ticker}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:#64748b">${direction === "above" ? "▲" : "▼"} $${target.toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;color:#94a3b8;text-align:right">$${current.toFixed(2)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:11px;color:#475569;text-align:right">${pctLabel}</td>
    </tr>`;
  }).join("");

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07090f;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:28px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:18px;font-weight:700;letter-spacing:0.12em;color:#fff">VAURIC</span>
      <span style="font-size:11px;color:#334155">${today} · Market Close</span>
    </div>

    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:28px;margin-bottom:16px">
      <p style="font-size:12px;color:#475569;letter-spacing:0.08em;text-transform:uppercase;margin:0 0 6px">Daily Digest</p>
      <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 4px">
        ${userName ? `Hey ${userName.split(" ")[0]}` : "Market close summary"}
      </h1>
      <p style="font-size:13px;color:#64748b;margin:0">Here's how your positions closed today.</p>
    </div>

    ${hasPortfolio ? `
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:16px;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <span style="font-size:11px;font-weight:600;color:#475569;letter-spacing:0.08em;text-transform:uppercase">Portfolio — Today's Moves</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${portfolioRows}
      </table>
    </div>` : ""}

    ${hasAlerts ? `
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:16px;overflow:hidden">
      <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06)">
        <span style="font-size:11px;font-weight:600;color:#475569;letter-spacing:0.08em;text-transform:uppercase">Price Alerts — Current Status</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${alertRows}
      </table>
    </div>` : ""}

    ${!hasPortfolio && !hasAlerts ? `
    <div style="background:#0d1117;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:28px;margin-bottom:16px;text-align:center">
      <p style="font-size:13px;color:#475569;margin:0">Add portfolio holdings or price alerts to see your daily summary here.</p>
    </div>` : ""}

    <div style="text-align:center;margin-top:24px">
      <a href="${appUrl}/graph" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:11px 28px;border-radius:8px;font-size:13px;font-weight:500">Open Vauric →</a>
    </div>

    <p style="font-size:11px;color:#1e293b;text-align:center;margin-top:24px">
      You're receiving this because you enabled daily digest in your <a href="${appUrl}/account" style="color:#334155">account settings</a>.
    </p>
  </div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vauric.com";

  // Friday = day 5 in UTC (0=Sun … 6=Sat)
  const isFriday = new Date().getUTCDay() === 5;

  // 1. Get subscribers — daily gets every weekday, weekly gets Fridays only
  const query = supabaseAdmin
    .from("user_preferences")
    .select("clerk_user_id, digest_frequency")
    .in("digest_frequency", isFriday ? ["daily", "weekly"] : ["daily"]);

  const { data: prefs, error: prefsErr } = await query;

  if (prefsErr || !prefs?.length) {
    return NextResponse.json({ sent: 0, reason: prefsErr?.message ?? "no subscribers" });
  }

  const userIds = prefs.map((p: { clerk_user_id: string }) => p.clerk_user_id);

  // 2. Fetch market data for all tickers in one batch
  const [portfolioRes, alertsRes] = await Promise.all([
    supabaseAdmin.from("portfolio_holdings").select("clerk_user_id, ticker").in("clerk_user_id", userIds),
    supabaseAdmin.from("price_alerts").select("clerk_user_id, ticker, target_price, direction")
      .in("clerk_user_id", userIds).is("triggered", null),
  ]);

  // Collect unique tickers across all users
  const allTickers = new Set<string>();
  for (const h of portfolioRes.data ?? []) allTickers.add(h.ticker);
  for (const a of alertsRes.data ?? []) allTickers.add(a.ticker);

  // Fetch live market data for all tickers
  const marketData = new Map<string, { price: number; dailyMove: number }>();
  if (allTickers.size > 0) {
    try {
      const mdRes = await fetch(
        `${appUrl}/api/market-data?tickers=${Array.from(allTickers).join(",")}`,
        { headers: { "x-pipeline-secret": process.env.PIPELINE_SECRET ?? "" } }
      );
      if (mdRes.ok) {
        const md = await mdRes.json() as Record<string, { price: number; dailyMove: number }>;
        for (const [ticker, data] of Object.entries(md)) {
          marketData.set(ticker, data);
        }
      }
    } catch { /* non-fatal — send digest without market data */ }
  }

  // 3. Fetch Clerk users for email addresses
  const client = await clerkClient();
  const clerkUsers = await client.users.getUserList({ userId: userIds, limit: 500 });
  const emailMap = new Map<string, { email: string; name: string }>();
  for (const u of clerkUsers.data) {
    const email = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress;
    if (email) emailMap.set(u.id, { email, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() });
  }

  // 4. Build and send one email per user
  let sent = 0;
  for (const userId of userIds) {
    const userInfo = emailMap.get(userId);
    if (!userInfo) continue;

    const holdings = (portfolioRes.data ?? [])
      .filter((h: { clerk_user_id: string }) => h.clerk_user_id === userId)
      .map((h: { ticker: string }) => {
        const md = marketData.get(h.ticker);
        return { ticker: h.ticker, price: md?.price ?? 0, move: md?.dailyMove ?? 0 };
      })
      .filter((h) => h.price > 0)
      .sort((a, b) => Math.abs(b.move) - Math.abs(a.move));

    const alerts = (alertsRes.data ?? [])
      .filter((a: { clerk_user_id: string }) => a.clerk_user_id === userId)
      .map((a: { ticker: string; direction: string; target_price: number }) => {
        const current = marketData.get(a.ticker)?.price ?? 0;
        const pct = current > 0 ? ((current - a.target_price) / a.target_price) * 100 : 0;
        return { ticker: a.ticker, direction: a.direction, target: a.target_price, current, pct };
      })
      .filter((a) => a.current > 0);

    try {
      await resend.emails.send({
        from:    "Vauric <digest@vauric.io>",
        to:      userInfo.email,
        subject: `Your market close digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
        html:    digestEmail(userInfo.name, holdings, alerts, appUrl),
      });
      sent++;
    } catch (err) {
      console.error(`[digest] failed to send to ${userInfo.email}:`, err);
    }
  }

  console.log(`[digest/scheduled] sent=${sent} total_subscribers=${userIds.length}`);
  return NextResponse.json({ sent, total: userIds.length });
}
