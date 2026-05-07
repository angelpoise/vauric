"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import UpgradeButton from "@/components/UpgradeButton";
import { getWatchlist } from "@/lib/watchlist";

const DM = 'var(--font-dm-sans), "DM Sans", sans-serif';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningsEntry {
  ticker: string;
  company_name: string | null;
  report_date: string;
  report_time: "pre-market" | "after-hours" | "during-market" | null;
  eps_estimate: number | null;
}

type ReminderState = "idle" | "loading" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateHeader(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const dMid     = new Date(isoDate + "T12:00:00"); dMid.setHours(0, 0, 0, 0);

  if (dMid.getTime() === today.getTime())    return `Today · ${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
  if (dMid.getTime() === tomorrow.getTime()) return `Tomorrow · ${d.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`;
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(entries: EarningsEntry[]): { date: string; items: EarningsEntry[] }[] {
  const map = new Map<string, EarningsEntry[]>();
  for (const e of entries) {
    const arr = map.get(e.report_date) ?? [];
    arr.push(e);
    map.set(e.report_date, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

// ─── Report time chip ─────────────────────────────────────────────────────────

const REPORT_TIME_CONFIG: Record<string, { label: string; color: string }> = {
  "pre-market":    { label: "Pre-market",    color: "#22c55e" },
  "after-hours":   { label: "After hours",   color: "#3b82f6" },
  "during-market": { label: "During market", color: "#f59e0b" },
};

function ReportTimeChip({ time }: { time: string | null }) {
  const cfg = time ? (REPORT_TIME_CONFIG[time] ?? null) : null;
  if (!cfg) return <span style={{ fontSize: 11, color: "#334155" }}>TBD</span>;
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 500,
        color: cfg.color,
        background: cfg.color + "18",
        border: `1px solid ${cfg.color}35`,
        borderRadius: 4,
        padding: "2px 8px",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Reminder bell button ─────────────────────────────────────────────────────

function ReminderButton({
  state,
  onClick,
}: {
  state: ReminderState;
  onClick: () => void;
}) {
  const done  = state === "done";
  const loading = state === "loading";
  const err   = state === "error";

  return (
    <button
      onClick={onClick}
      disabled={loading || done}
      title={done ? "Reminder set" : "Set earnings reminder"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 10px",
        background: done
          ? "rgba(34,197,94,0.08)"
          : err
          ? "rgba(239,68,68,0.08)"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${
          done ? "rgba(34,197,94,0.25)"
          : err  ? "rgba(239,68,68,0.25)"
          : "rgba(255,255,255,0.08)"
        }`,
        borderRadius: 6,
        color: done ? "#22c55e" : err ? "#ef4444" : "#64748b",
        fontSize: 11, fontWeight: 500,
        cursor: done || loading ? "default" : "pointer",
        fontFamily: DM,
        flexShrink: 0,
        transition: "all 0.15s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        "…"
      ) : done ? (
        <>✓ Reminder set</>
      ) : err ? (
        "Failed"
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <path d="M8 2a4.5 4.5 0 00-4.5 4.5V10L2 12h12l-1.5-2V6.5A4.5 4.5 0 008 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Remind me
        </>
      )}
    </button>
  );
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  isPro,
  reminderState,
  onRemind,
  onClick,
}: {
  entry: EarningsEntry;
  isPro: boolean;
  reminderState: ReminderState;
  onRemind: () => void;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onClick={onClick}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      {/* Ticker + company */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", marginBottom: 2 }}>
          {entry.ticker}
        </div>
        {entry.company_name && (
          <div style={{ fontSize: 12, color: "#334155", fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {entry.company_name}
          </div>
        )}
      </div>

      {/* Report time */}
      <ReportTimeChip time={entry.report_time} />

      {/* EPS estimate */}
      <div style={{ fontSize: 12, color: "#475569", minWidth: 90, textAlign: "right", flexShrink: 0 }}>
        {entry.eps_estimate != null
          ? <>EPS est. <span style={{ color: "#64748b", fontWeight: 500 }}>${entry.eps_estimate.toFixed(2)}</span></>
          : <span style={{ color: "#1e293b" }}>EPS n/a</span>
        }
      </div>

      {/* Reminder bell (Pro only) */}
      {isPro ? (
        <div onClick={(e) => e.stopPropagation()}>
          <ReminderButton state={reminderState} onClick={onRemind} />
        </div>
      ) : (
        <div style={{ minWidth: 92, flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EarningsCalendar() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const isPro = isLoaded ? user?.publicMetadata?.isPro === true : false;

  const [view, setView]           = useState<"all" | "watchlist">("all");
  const [entries, setEntries]     = useState<EarningsEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [reminders, setReminders] = useState<Record<string, ReminderState>>({});

  const watchlist = getWatchlist();

  useEffect(() => {
    setLoading(true);
    setError(false);

    const params = new URLSearchParams({ days: "30" });
    if (view === "watchlist" && isPro && watchlist.length > 0) {
      params.set("tickers", watchlist.join(","));
    }

    fetch(`/api/earnings-calendar?${params}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: EarningsEntry[]) => { setEntries(Array.isArray(data) ? data : []); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [view, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRemind(entry: EarningsEntry) {
    if (!user || !isPro) return;
    const key = `${entry.ticker}|${entry.report_date}`;
    setReminders((prev) => ({ ...prev, [key]: "loading" }));
    try {
      const token = await getToken();
      const res = await fetch("/api/earnings-calendar/remind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          ticker: entry.ticker,
          reportDate: entry.report_date,
        }),
      });
      if (res.ok || res.status === 201) {
        setReminders((prev) => ({ ...prev, [key]: "done" }));
      } else {
        setReminders((prev) => ({ ...prev, [key]: "error" }));
        setTimeout(() => setReminders((prev) => ({ ...prev, [key]: "idle" })), 2000);
      }
    } catch {
      setReminders((prev) => ({ ...prev, [key]: "error" }));
      setTimeout(() => setReminders((prev) => ({ ...prev, [key]: "idle" })), 2000);
    }
  }

  const grouped = groupByDate(entries);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07090f",
        fontFamily: DM,
        color: "#f1f5f9",
      }}
    >
      {/* Back button */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 32px 0" }}>
        <button
          onClick={() => router.push("/graph")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            color: "#475569", fontSize: 13, fontWeight: 400,
            padding: 0, fontFamily: "inherit",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Graph
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f1f5f9", margin: "0 0 6px" }}>
            Earnings Calendar
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: 0, fontWeight: 300 }}>
            Upcoming earnings for tracked stocks
          </p>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {(["all", "watchlist"] as const).map((v) => {
            const active = view === v;
            const label  = v === "all" ? "All stocks" : "Watchlist only";
            return (
              <button
                key={v}
                onClick={() => {
                  if (v === "watchlist" && !isPro) return; // gate handled inline
                  setView(v);
                }}
                style={{
                  padding: "8px 16px",
                  background: active ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? "rgba(59,130,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 8,
                  color: active ? "#3b82f6" : "#64748b",
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  cursor: "pointer", fontFamily: DM,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                {label}
                {v === "watchlist" && !isPro && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                    color: "#3b82f6", background: "rgba(59,130,246,0.12)",
                    border: "1px solid rgba(59,130,246,0.25)",
                    borderRadius: 3, padding: "1px 5px",
                  }}>PRO</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Pro gate for watchlist view */}
        {view === "watchlist" && !isPro && isLoaded && (
          <div style={{
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 10, padding: "28px 24px",
            textAlign: "center", marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 16px" }}>
              Watchlist filter is a Pro feature.
            </p>
            <UpgradeButton label="Upgrade to Pro" />
          </div>
        )}

        {/* Pro reminder callout (non-blocking) */}
        {!isPro && isLoaded && view === "all" && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(59,130,246,0.05)",
            border: "1px solid rgba(59,130,246,0.15)",
            borderRadius: 8, padding: "12px 16px", marginBottom: 24, gap: 16,
          }}>
            <span style={{ fontSize: 12, color: "#475569" }}>
              Upgrade to Pro to set earnings reminders and filter by watchlist.
            </span>
            <UpgradeButton label="Upgrade" />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#334155", fontSize: 13 }}>
            Loading…
          </div>
        ) : error ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#475569", fontSize: 13 }}>
            Failed to load earnings data. Please try again.
          </div>
        ) : grouped.length === 0 ? (
          <div style={{
            padding: "60px 0", textAlign: "center",
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
          }}>
            <p style={{ fontSize: 14, color: "#334155", margin: 0 }}>
              No upcoming earnings in the next 30 days for tracked stocks.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {grouped.map(({ date, items }) => (
              <div key={date}>
                {/* Date header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {formatDateHeader(date)}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.05)" }} />
                </div>

                {/* Entries */}
                <div style={{
                  background: "#0d1117",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}>
                  {items.map((entry) => {
                    const rKey = `${entry.ticker}|${entry.report_date}`;
                    return (
                      <EntryRow
                        key={rKey}
                        entry={entry}
                        isPro={isPro}
                        reminderState={reminders[rKey] ?? "idle"}
                        onRemind={() => handleRemind(entry)}
                        onClick={() => router.push(`/stock/${entry.ticker}`)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
