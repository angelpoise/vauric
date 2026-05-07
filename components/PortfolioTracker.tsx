"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import UpgradeButton from "@/components/UpgradeButton";
import { moveColor, moveFill } from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";

const DM = 'var(--font-dm-sans), "DM Sans", sans-serif';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  ticker: string;
  shares: number;
  purchase_price: number;
  purchase_date: string | null;
  created_at: string;
}

interface MarketEntry { price: number; dailyMove: number; dailyMoveDollar: number; }

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$   = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const sign$  = (n: number) => `${n >= 0 ? "+" : "−"}${fmt$(n)}`;

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      flex: "1 1 140px",
      background: "#0d1117",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10,
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 11, color: "#334155", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? "#f1f5f9" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: color ?? "#64748b", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PortfolioTracker() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const isPro = isLoaded ? user?.publicMetadata?.isPro === true : false;

  const [holdings, setHoldings]     = useState<Holding[]>([]);
  const [marketData, setMarketData] = useState<Record<string, MarketEntry>>({});
  const [knownTickers, setKnownTickers] = useState<string[]>([]);
  const [loading, setLoading]       = useState(true);

  const [form, setForm] = useState({ ticker: "", shares: "", purchasePrice: "", purchaseDate: "" });
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function authFetch(url: string, init?: RequestInit): Promise<Response> {
    const token = await getToken();
    return fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }

  const loadHoldings = useCallback(async () => {
    if (!user) return;
    try {
      const r = await authFetch(`/api/portfolio?userId=${encodeURIComponent(user.id)}`);
      if (r.ok) setHoldings(await r.json());
    } catch { /* ignore */ }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoaded) return;
    if (!user || !isPro) { setLoading(false); return; }

    const md = getCachedMarketData();

    Promise.allSettled([
      loadHoldings(),
      md ? Promise.resolve(md) : fetch("/api/market-data").then(r => r.ok ? r.json() : null),
      fetch("/api/graph").then(r => r.ok ? r.json() : null),
    ]).then(([, mdRes, graphRes]) => {
      if (mdRes.status === "fulfilled" && mdRes.value) {
        if (!md) setCachedMarketData(mdRes.value);
        setMarketData(mdRes.value);
      }
      if (graphRes.status === "fulfilled" && graphRes.value?.stocks) {
        setKnownTickers((graphRes.value.stocks as Array<{ ticker: string }>).map(s => s.ticker));
      }
      setLoading(false);
    });
  }, [isLoaded, user, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived metrics ────────────────────────────────────────────────────────

  const rows = holdings.map(h => {
    const md = marketData[h.ticker];
    const currentPrice = md?.price ?? null;
    const value        = currentPrice != null ? h.shares * currentPrice : null;
    const gainLoss$    = currentPrice != null ? (currentPrice - h.purchase_price) * h.shares : null;
    const gainLossPct  = gainLoss$ != null ? (gainLoss$ / (h.purchase_price * h.shares)) * 100 : null;
    const dailyMove$   = md ? h.shares * md.dailyMoveDollar : null;
    return { ...h, currentPrice, value, gainLoss$, gainLossPct, dailyMove$, dailyMovePct: md?.dailyMove ?? null };
  });

  const totalValue    = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const totalCost     = holdings.reduce((s, h) => s + h.shares * h.purchase_price, 0);
  const dailyGain$    = rows.reduce((s, r) => s + (r.dailyMove$ ?? 0), 0);
  const dailyGainPct  = totalValue - dailyGain$ > 0 ? (dailyGain$ / (totalValue - dailyGain$)) * 100 : 0;
  const totalGain$    = totalValue - totalCost;
  const totalGainPct  = totalCost > 0 ? (totalGain$ / totalCost) * 100 : 0;

  // ── Form handlers ──────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!user) return;
    setFormError(null);
    const t = form.ticker.trim().toUpperCase();
    const s = parseFloat(form.shares);
    const p = parseFloat(form.purchasePrice);
    if (!t) { setFormError("Ticker is required"); return; }
    if (knownTickers.length > 0 && !knownTickers.includes(t)) {
      setFormError(`${t} is not a tracked stock. Only stocks on the Vauric graph can be added.`);
      return;
    }
    if (isNaN(s) || s <= 0) { setFormError("Enter a valid share count"); return; }
    if (isNaN(p) || p <= 0) { setFormError("Enter a valid purchase price"); return; }

    setSaving(true);
    try {
      const r = await authFetch("/api/portfolio", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId: user.id, ticker: t, shares: s,
          purchasePrice: p,
          ...(form.purchaseDate ? { purchaseDate: form.purchaseDate } : {}),
        }),
      });
      if (r.status === 403) { setFormError("Pro subscription required"); return; }
      if (!r.ok) { const d = await r.json(); setFormError(d.error ?? "Failed to add"); return; }
      setForm({ ticker: "", shares: "", purchasePrice: "", purchaseDate: "" });
      await loadHoldings();
    } catch { setFormError("Request failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await authFetch(`/api/portfolio?id=${id}`, { method: "DELETE" });
      setHoldings(prev => prev.filter(h => h.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", fontFamily: DM, color: "#f1f5f9" }}>
      {/* Back */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 32px 0" }}>
        <button
          onClick={() => router.push("/graph")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 13, padding: 0, fontFamily: "inherit" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Graph
        </button>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 32px 80px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f1f5f9", margin: "0 0 6px" }}>Portfolio</h1>
        <p style={{ fontSize: 14, color: "#475569", margin: "0 0 32px", fontWeight: 300 }}>Track your stock holdings and performance</p>

        {/* Pro gate */}
        {isLoaded && !isPro && (
          <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "40px 24px", textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#475569", margin: "0 0 20px" }}>Portfolio tracking is a Pro feature.</p>
            <UpgradeButton label="Upgrade to Pro" />
          </div>
        )}

        {isLoaded && isPro && (
          <>
            {loading ? (
              <div style={{ color: "#334155", fontSize: 13, padding: "40px 0" }}>Loading…</div>
            ) : (
              <>
                {/* ── Summary cards ──────────────────────────────────────────── */}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
                  <SummaryCard label="Total value" value={totalValue > 0 ? `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"} />
                  <SummaryCard
                    label="Daily gain/loss"
                    value={dailyGain$ !== 0 ? sign$(dailyGain$) : "—"}
                    sub={dailyGain$ !== 0 ? fmtPct(dailyGainPct) : undefined}
                    color={dailyGain$ >= 0 ? "#22c55e" : "#ef4444"}
                  />
                  <SummaryCard
                    label="Total gain/loss"
                    value={totalCost > 0 ? sign$(totalGain$) : "—"}
                    sub={totalCost > 0 ? fmtPct(totalGainPct) : undefined}
                    color={totalGain$ >= 0 ? "#22c55e" : "#ef4444"}
                  />
                  <SummaryCard label="Holdings" value={String(holdings.length)} />
                </div>

                {/* ── Holdings table ──────────────────────────────────────────── */}
                <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, marginBottom: 32, overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.07em", textTransform: "uppercase" }}>Holdings</span>
                  </div>
                  {rows.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#334155", padding: "24px 20px", margin: 0 }}>No holdings yet. Add one below.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: DM }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            {["Ticker", "Shares", "Buy Price", "Current", "Daily %", "Value", "Gain/Loss $", "Gain/Loss %", "Weight %", ""].map(h => (
                              <th key={h} style={{ padding: "10px 14px", fontSize: 10, color: "#334155", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", textAlign: h === "Ticker" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...rows].sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).map(row => {
                            const weight = totalValue > 0 && row.value != null ? (row.value / totalValue) * 100 : null;
                            const moveCol = row.dailyMovePct != null ? (row.dailyMovePct >= 0 ? "#22c55e" : "#ef4444") : "#475569";
                            const glCol   = row.gainLoss$ != null ? (row.gainLoss$ >= 0 ? "#22c55e" : "#ef4444") : "#475569";
                            return (
                              <tr
                                key={row.id}
                                onClick={() => router.push(`/stock/${row.ticker}`)}
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                              >
                                <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>{row.ticker}</td>
                                <td style={{ padding: "11px 14px", fontSize: 13, color: "#94a3b8", textAlign: "right" }}>{row.shares.toLocaleString()}</td>
                                <td style={{ padding: "11px 14px", fontSize: 13, color: "#64748b", textAlign: "right" }}>{fmt$(row.purchase_price)}</td>
                                <td style={{ padding: "11px 14px", fontSize: 13, color: "#94a3b8", textAlign: "right" }}>{row.currentPrice != null ? fmt$(row.currentPrice) : "—"}</td>
                                <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: moveCol, textAlign: "right" }}>{row.dailyMovePct != null ? fmtPct(row.dailyMovePct) : "—"}</td>
                                <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "#f1f5f9", textAlign: "right" }}>{row.value != null ? fmt$(row.value) : "—"}</td>
                                <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 500, color: glCol, textAlign: "right" }}>{row.gainLoss$ != null ? sign$(row.gainLoss$) : "—"}</td>
                                <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 500, color: glCol, textAlign: "right" }}>{row.gainLossPct != null ? fmtPct(row.gainLossPct) : "—"}</td>
                                <td style={{ padding: "11px 14px", fontSize: 12, color: "#64748b", textAlign: "right" }}>{weight != null ? `${weight.toFixed(1)}%` : "—"}</td>
                                <td style={{ padding: "11px 14px", textAlign: "right" }} onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleDelete(row.id)}
                                    disabled={deleting === row.id}
                                    style={{ background: "none", border: "none", color: "#334155", fontSize: 17, cursor: "pointer", padding: "2px 4px", fontFamily: DM, lineHeight: 1 }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#334155"; }}
                                  >
                                    {deleting === row.id ? "…" : "×"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── Add holding form ────────────────────────────────────────── */}
                <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 20px 18px", marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add holding</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    {[
                      { placeholder: "Ticker (e.g. NVDA)", value: form.ticker, onChange: (v: string) => setForm(f => ({ ...f, ticker: v.toUpperCase() })), width: 130, maxLength: 10 },
                      { placeholder: "Shares", value: form.shares, onChange: (v: string) => setForm(f => ({ ...f, shares: v })), width: 100, type: "number" },
                      { placeholder: "Buy price ($)", value: form.purchasePrice, onChange: (v: string) => setForm(f => ({ ...f, purchasePrice: v })), width: 120, type: "number" },
                      { placeholder: "Date (optional)", value: form.purchaseDate, onChange: (v: string) => setForm(f => ({ ...f, purchaseDate: v })), width: 150, type: "date" },
                    ].map(({ placeholder, value, onChange, width, type, maxLength }) => (
                      <input
                        key={placeholder}
                        type={type ?? "text"}
                        placeholder={placeholder}
                        value={value}
                        maxLength={maxLength}
                        onChange={e => onChange(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAdd()}
                        style={{
                          width, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 7, padding: "8px 10px", fontSize: 13, color: "#f1f5f9", fontFamily: DM, outline: "none",
                        }}
                      />
                    ))}
                    <button
                      onClick={handleAdd}
                      disabled={saving}
                      style={{
                        background: "#3b82f6", border: "none", borderRadius: 7, color: "#fff",
                        fontSize: 13, fontWeight: 500, padding: "8px 18px", cursor: saving ? "not-allowed" : "pointer",
                        fontFamily: DM, opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? "Adding…" : "Add"}
                    </button>
                  </div>
                  {formError && <p style={{ fontSize: 12, color: "#ef4444", margin: 0 }}>{formError}</p>}
                </div>

                {/* ── Allocation chart ────────────────────────────────────────── */}
                {rows.length > 0 && totalValue > 0 && (
                  <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 20px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Allocation</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[...rows]
                        .filter(r => r.value != null)
                        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
                        .map(row => {
                          const weight = ((row.value ?? 0) / totalValue) * 100;
                          const move   = row.dailyMovePct ?? 0;
                          return (
                            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => router.push(`/stock/${row.ticker}`)}>
                              <span style={{ width: 44, fontSize: 12, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", flexShrink: 0 }}>{row.ticker}</span>
                              <div style={{ flex: 1, height: 22, background: "rgba(255,255,255,0.04)", borderRadius: 4, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%",
                                  width: `${weight}%`,
                                  background: moveFill(move, 0.6),
                                  borderRight: `2px solid ${moveColor(move)}`,
                                  borderRadius: 4,
                                  transition: "width 0.4s ease",
                                  display: "flex",
                                  alignItems: "center",
                                  paddingLeft: 8,
                                  minWidth: 40,
                                }} />
                              </div>
                              <span style={{ width: 44, fontSize: 12, color: "#64748b", textAlign: "right", flexShrink: 0 }}>{weight.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
