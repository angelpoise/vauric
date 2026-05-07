"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import UpgradeButton from "@/components/UpgradeButton";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";

const DM = 'var(--font-dm-sans), "DM Sans", sans-serif';
const TAB_W = 28;
const PANEL_W = 280;

interface Alert {
  id: string;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  created_at: string;
}

interface LiveEntry { price: number; dailyMove: number; }

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  price,
  onDelete,
  onClick,
}: {
  alert: Alert;
  price: number | null;
  onDelete: (id: string) => void;
  onClick: () => void;
}) {
  const isAbove = alert.direction === "above";
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        onClick={onClick}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>
            {alert.ticker}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 500, borderRadius: 4, padding: "1px 6px",
            background: isAbove ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${isAbove ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            color: isAbove ? "#22c55e" : "#ef4444",
          }}>
            {isAbove ? "▲" : "▼"} ${alert.target_price.toFixed(2)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#334155" }}>
          {price != null ? <>Current: <span style={{ color: "#64748b" }}>${price.toFixed(2)}</span></> : "—"}
        </div>
      </div>
      <button
        onClick={() => onDelete(alert.id)}
        title="Delete alert"
        style={{
          background: "none", border: "none", color: "#1e293b",
          fontSize: 18, lineHeight: 1, padding: "2px 4px",
          borderRadius: 4, cursor: "pointer", flexShrink: 0,
          fontFamily: DM, transition: "color 0.12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1e293b"; }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onOpenChange?: (open: boolean) => void;
}

export default function AlertsPanel({ onOpenChange }: Props) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const isPro = isLoaded ? user?.publicMetadata?.isPro === true : false;

  const [open, setOpen]           = useState(false);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    onOpenChange?.(next);
  }
  const [alerts, setAlerts]       = useState<Alert[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [marketData, setMarketData] = useState<Record<string, LiveEntry> | null>(null);

  // Inline create form
  const [createOpen, setCreateOpen] = useState(false);
  const [newTicker, setNewTicker]   = useState("");
  const [newDirection, setNewDirection] = useState<"above" | "below">("above");
  const [newPrice, setNewPrice]     = useState("");
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function authFetch(url: string, init?: RequestInit): Promise<Response> {
    const token = await getToken();
    return fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }

  const loadAlerts = useCallback(async () => {
    if (!user || !isPro) return;
    try {
      const r = await authFetch(`/api/alerts?userId=${encodeURIComponent(user.id)}`);
      if (r.ok) setAlerts((await r.json()) ?? []);
    } catch { /* ignore */ }
  }, [user, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    setLoading(true);
    loadAlerts().finally(() => setLoading(false));
    intervalRef.current = setInterval(loadAlerts, 30_000);

    // Market data for current prices
    const cached = getCachedMarketData();
    if (cached) { setMarketData(cached); }
    else {
      fetch("/api/market-data")
        .then((r) => r.ok ? r.json() : null)
        .then((json) => { if (json) { setCachedMarketData(json); setMarketData(json); } })
        .catch(() => {});
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [open, loadAlerts]);

  async function handleDelete(id: string) {
    await authFetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleCreate() {
    if (!user || !newTicker.trim() || !newPrice) return;
    const parsed = parseFloat(newPrice);
    if (isNaN(parsed) || parsed <= 0) { setCreateError("Enter a valid price"); return; }
    setCreating(true);
    setCreateError(null);
    try {
      const r = await authFetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ticker: newTicker.trim().toUpperCase(),
          targetPrice: parsed,
          direction: newDirection,
        }),
      });
      if (r.status === 403) { setCreateError("Pro subscription required"); return; }
      if (!r.ok) { const d = await r.json(); setCreateError(d.error ?? "Failed to create"); return; }
      setNewTicker(""); setNewPrice(""); setNewDirection("above"); setCreateOpen(false);
      await loadAlerts();
    } catch { setCreateError("Request failed"); }
    finally { setCreating(false); }
  }

  const filtered = search.trim()
    ? alerts.filter((a) => a.ticker.includes(search.trim().toUpperCase()))
    : alerts;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: TAB_W + PANEL_W,
        zIndex: open ? 51 : 49,
        transform: open ? "translateX(0)" : `translateX(${PANEL_W}px)`,
        transition: "transform 0.25s ease",
        pointerEvents: "none",
        fontFamily: DM,
      }}
    >
      {/* ── Tab ──────────────────────────────────────────────────────────────── */}
      <button
        onClick={toggleOpen}
        style={{
          position: "absolute", left: 0, bottom: "calc(50% + 60px)",
          width: TAB_W, height: 100,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRight: "none",
          borderRadius: "6px 0 0 6px",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "auto", padding: 0,
        }}
      >
        <span style={{
          fontSize: 10, fontWeight: 500, color: "#475569",
          letterSpacing: "0.08em", textTransform: "uppercase",
          whiteSpace: "nowrap", transform: "rotate(-90deg)", fontFamily: "inherit",
        }}>
          Alerts
        </span>
      </button>

      {/* ── Panel body ────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute", left: TAB_W, top: 0,
          width: PANEL_W, height: "100%",
          background: "#0d1117",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          pointerEvents: "auto", overflowY: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 500, color: "#f1f5f9", marginBottom: 12 }}>
            Price Alerts
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ticker…"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 7, padding: "7px 10px",
              fontSize: 12, color: "#94a3b8", fontFamily: "inherit", outline: "none",
            }}
          />
        </div>

        {/* Alert list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {!isLoaded ? null : !user ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#334155", margin: 0 }}>Sign in to manage price alerts.</p>
            </div>
          ) : !isPro ? (
            <div style={{ padding: "32px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#475569", marginBottom: 16, lineHeight: 1.6 }}>
                Price alerts are a Pro feature.
              </p>
              <UpgradeButton label="Upgrade to Pro" />
            </div>
          ) : loading ? (
            <div style={{ padding: "20px", fontSize: 12, color: "#334155", textAlign: "center" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                {search.trim()
                  ? `No alerts matching "${search.trim().toUpperCase()}".`
                  : "No active price alerts."}
              </p>
            </div>
          ) : (
            filtered.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                price={marketData?.[alert.ticker]?.price ?? null}
                onDelete={handleDelete}
                onClick={() => router.push(`/stock/${alert.ticker}`)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {isPro && user && (
          <div style={{ flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {createOpen ? (
              <div style={{ padding: "14px 14px 16px" }}>
                {/* Ticker input */}
                <input
                  type="text"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                  placeholder="Ticker (e.g. AAPL)"
                  maxLength={10}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7, padding: "7px 10px", marginBottom: 8,
                    fontSize: 13, color: "#f1f5f9", fontFamily: DM, outline: "none",
                    letterSpacing: "0.04em",
                  }}
                />
                {/* Direction toggle */}
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {(["above", "below"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setNewDirection(d)}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                        fontFamily: DM, fontSize: 12,
                        fontWeight: newDirection === d ? 500 : 400,
                        background: newDirection === d
                          ? (d === "above" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)")
                          : "rgba(255,255,255,0.04)",
                        border: `1px solid ${newDirection === d
                          ? (d === "above" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)")
                          : "rgba(255,255,255,0.08)"}`,
                        color: newDirection === d
                          ? (d === "above" ? "#22c55e" : "#ef4444")
                          : "#64748b",
                      }}
                    >
                      {d === "above" ? "▲ Above" : "▼ Below"}
                    </button>
                  ))}
                </div>
                {/* Price input + submit */}
                <div style={{ display: "flex", gap: 6 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: 12 }}>$</span>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      placeholder="0.00"
                      step="0.01" min="0"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 7, padding: "7px 8px 7px 20px",
                        fontSize: 13, color: "#f1f5f9", fontFamily: DM, outline: "none",
                      }}
                    />
                  </div>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newTicker.trim() || !newPrice}
                    style={{
                      background: "#3b82f6", border: "none", borderRadius: 7,
                      color: "#fff", fontSize: 12, fontWeight: 500,
                      padding: "7px 12px",
                      cursor: creating || !newTicker.trim() || !newPrice ? "not-allowed" : "pointer",
                      fontFamily: DM, flexShrink: 0,
                      opacity: creating || !newTicker.trim() || !newPrice ? 0.5 : 1,
                    }}
                  >
                    {creating ? "…" : "Set"}
                  </button>
                </div>
                {createError && <p style={{ fontSize: 11, color: "#ef4444", margin: "6px 0 0" }}>{createError}</p>}
                <button
                  onClick={() => { setCreateOpen(false); setCreateError(null); }}
                  style={{
                    marginTop: 10, width: "100%", padding: "5px 0",
                    background: "none", border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 6, color: "#475569", fontSize: 11,
                    cursor: "pointer", fontFamily: DM,
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ padding: "10px 14px" }}>
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    width: "100%", padding: "8px 0",
                    background: "rgba(59,130,246,0.08)",
                    border: "1px solid rgba(59,130,246,0.2)",
                    borderRadius: 7, color: "#3b82f6",
                    fontSize: 12, fontWeight: 500,
                    cursor: "pointer", fontFamily: DM,
                  }}
                >
                  + Add alert
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
