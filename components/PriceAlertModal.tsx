"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import UpgradeButton from "@/components/UpgradeButton";

const DM = 'var(--font-dm-sans), "DM Sans", sans-serif';

interface Alert {
  id: string;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  created_at: string;
}

interface Props {
  ticker: string;
  currentPrice: number | null;
  onClose: () => void;
}

export default function PriceAlertModal({ ticker, currentPrice, onClose }: Props) {
  const { user } = useUser();
  const { getToken } = useAuth();
  const isPro = user?.publicMetadata?.isPro === true;

  const [targetPrice, setTargetPrice] = useState<string>(currentPrice ? currentPrice.toFixed(2) : "");
  const [direction, setDirection]     = useState<"above" | "below">("above");
  const [alerts, setAlerts]           = useState<Alert[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function authFetch(url: string, init?: RequestInit): Promise<Response> {
    const token = await getToken();
    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  async function loadAlerts() {
    if (!user) return;
    try {
      const r = await authFetch(`/api/alerts?userId=${encodeURIComponent(user.id)}`);
      if (r.ok) {
        const data: Alert[] = await r.json();
        setAlerts(data.filter((a) => a.ticker === ticker));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAlerts(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!user || !targetPrice) return;
    const parsed = parseFloat(targetPrice);
    if (isNaN(parsed) || parsed <= 0) { setError("Enter a valid price"); return; }
    setSaving(true);
    setError(null);
    try {
      const r = await authFetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ticker, targetPrice: parsed, direction }),
      });
      if (r.status === 403) { setError("Pro subscription required"); return; }
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "Failed to create alert"); return; }
      await loadAlerts();
      setTargetPrice(currentPrice ? currentPrice.toFixed(2) : "");
    } catch {
      setError("Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`/api/alerts?id=${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60 }} />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 61, width: 360, maxHeight: "90vh", overflowY: "auto",
        background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12, padding: 24,
        fontFamily: DM,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9" }}>Price alert — {ticker}</div>
            {currentPrice != null && (
              <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>
                Current price: <span style={{ color: "#94a3b8" }}>${currentPrice.toFixed(2)}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", fontSize: 20, cursor: "pointer", padding: "0 2px", fontFamily: DM }}>×</button>
        </div>

        {!isPro ? (
          <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
            <p style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>Price alerts are a Pro feature.</p>
            <UpgradeButton label="Upgrade to Pro" />
          </div>
        ) : (
          <>
            {/* Create alert form */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: "#475569", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                Alert me when {ticker} goes
              </label>

              {/* Direction toggle */}
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {(["above", "below"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 7, cursor: "pointer",
                      fontFamily: DM, fontSize: 13, fontWeight: direction === d ? 500 : 400,
                      background: direction === d ? (d === "above" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)") : "rgba(255,255,255,0.04)",
                      border: `1px solid ${direction === d ? (d === "above" ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)") : "rgba(255,255,255,0.08)"}`,
                      color: direction === d ? (d === "above" ? "#22c55e" : "#ef4444") : "#64748b",
                    }}
                  >
                    {d === "above" ? "▲ Above" : "▼ Below"}
                  </button>
                ))}
              </div>

              {/* Target price input */}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: 13 }}>$</span>
                  <input
                    type="number"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 7, padding: "8px 10px 8px 24px",
                      color: "#f1f5f9", fontSize: 14, fontFamily: DM, outline: "none",
                    }}
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={saving || !targetPrice}
                  style={{
                    background: "#3b82f6", border: "none", borderRadius: 7,
                    color: "#fff", fontSize: 13, fontWeight: 500,
                    padding: "8px 18px", cursor: saving || !targetPrice ? "not-allowed" : "pointer",
                    fontFamily: DM, opacity: saving || !targetPrice ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {saving ? "…" : "Set alert"}
                </button>
              </div>
              {error && <p style={{ fontSize: 12, color: "#ef4444", margin: "8px 0 0" }}>{error}</p>}
            </div>

            {/* Existing alerts */}
            <div>
              <div style={{ fontSize: 11, color: "#334155", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                Active alerts for {ticker}
              </div>
              {loading ? (
                <div style={{ fontSize: 12, color: "#334155" }}>Loading…</div>
              ) : alerts.length === 0 ? (
                <div style={{ fontSize: 12, color: "#334155" }}>No alerts set for {ticker}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {alerts.map((a) => (
                    <div key={a.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 7, padding: "8px 12px",
                    }}>
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>
                        <span style={{ color: a.direction === "above" ? "#22c55e" : "#ef4444", fontWeight: 500 }}>
                          {a.direction === "above" ? "▲ Above" : "▼ Below"}
                        </span>
                        {" "}${a.target_price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDelete(a.id)}
                        style={{ background: "none", border: "none", color: "#334155", fontSize: 16, cursor: "pointer", padding: "0 2px", fontFamily: DM }}
                        title="Delete alert"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
