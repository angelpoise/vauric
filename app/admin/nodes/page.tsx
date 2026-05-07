"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect } from "react";

const SECTORS   = ["Technology", "Energy", "Healthcare", "Finance", "Consumer"];
const SCHEDULES = [
  { value: "on_visit", label: "On visit"  },
  { value: "daily",    label: "Daily"     },
  { value: "weekly",   label: "Weekly"    },
];

const CARD:  React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN:   React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH:    React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left" };
const TD:    React.CSSProperties = { padding: "11px 16px 11px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0" };

interface Stock {
  id: string;
  ticker: string;
  company_name: string;
  sector: string;
  x_position: number;
  y_position: number;
  investor_relations_url: string | null;
  visit_count: number | null;
  last_visited_at: string | null;
  analysis_schedule: string | null;
  scenario_schedule: string | null;
}

type EditMap = Record<string, Partial<Stock>>;

const blank = { ticker: "", company_name: "", sector: "Technology", x_position: 0.5, y_position: 0.5, investor_relations_url: "" };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NodesPage() {
  const [stocks, setStocks]       = useState<Stock[]>([]);
  const [form, setForm]           = useState(blank);
  const [edits, setEdits]         = useState<EditMap>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);
  const [regenMsg, setRegenMsg]   = useState<Record<string, string>>({});
  const [irDiscovering, setIrDiscovering] = useState<Record<string, boolean>>({});
  const [irMsg, setIrMsg]         = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ checked: number; updated: number; failed: number } | null>(null);

  async function load() {
    const r = await adminFetch("/api/admin/stocks");
    if (r.ok) setStocks(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setErr(null);
    const r = await adminFetch("/api/admin/stocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!r.ok) { setErr((await r.json()).error); return; }
    setForm(blank);
    load();
  }

  async function save(id: string) {
    const r = await adminFetch(`/api/admin/stocks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits[id]),
    });
    if (r.ok) { setEditingId(null); setEdits({}); load(); }
  }

  async function del(id: string) {
    if (!confirm("Remove this stock?")) return;
    await adminFetch(`/api/admin/stocks/${id}`, { method: "DELETE" });
    load();
  }

  async function patchSchedule(ticker: string, value: string) {
    await adminFetch(`/api/admin/stocks/${ticker}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis_schedule: value }),
    });
    setStocks((prev) => prev.map((s) => s.ticker === ticker ? { ...s, analysis_schedule: value } : s));
  }

  async function patchScenarioSchedule(ticker: string, value: string) {
    await adminFetch(`/api/admin/stocks/${ticker}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario_schedule: value }),
    });
    setStocks((prev) => prev.map((s) => s.ticker === ticker ? { ...s, scenario_schedule: value } : s));
  }

  async function discoverIr(ticker: string, companyName: string) {
    setIrDiscovering((m) => ({ ...m, [ticker]: true }));
    setIrMsg((m) => ({ ...m, [ticker]: "Searching…" }));
    try {
      const r = await adminFetch("/api/admin/stocks/discover-ir", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ticker, companyName }),
      });
      const data = await r.json();
      if (r.ok && data.url) {
        setIrMsg((m) => ({ ...m, [ticker]: "Found" }));
        setStocks((prev) => prev.map((s) => s.ticker === ticker ? { ...s, investor_relations_url: data.url } : s));
      } else {
        setIrMsg((m) => ({ ...m, [ticker]: data.error ?? "Not found" }));
      }
    } catch {
      setIrMsg((m) => ({ ...m, [ticker]: "Error" }));
    } finally {
      setIrDiscovering((m) => ({ ...m, [ticker]: false }));
      setTimeout(() => setIrMsg((m) => { const n = { ...m }; delete n[ticker]; return n; }), 4000);
    }
  }

  async function verifyIrUrls() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await adminFetch("/api/admin/stocks/verify-ir");
      if (r.ok) { setVerifyResult(await r.json()); load(); }
    } catch { /* ignore */ }
    finally { setVerifying(false); }
  }

  async function regenAnalysis(ticker: string) {
    setRegenMsg((m) => ({ ...m, [ticker]: "Clearing…" }));
    try {
      console.log(`[regenAnalysis] DELETE /api/analysis?ticker=${ticker}`);
      const r = await adminFetch(`/api/analysis?ticker=${ticker}`, { method: "DELETE" });
      console.log(`[regenAnalysis] response status: ${r.status}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        console.error(`[regenAnalysis] error body:`, body);
      }
      setRegenMsg((m) => ({ ...m, [ticker]: r.ok ? "Cleared — regenerates on next visit" : `Error ${r.status}` }));
    } catch (err) {
      console.error(`[regenAnalysis] fetch threw:`, err);
      setRegenMsg((m) => ({ ...m, [ticker]: "Error" }));
    }
    setTimeout(() => setRegenMsg((m) => { const n = { ...m }; delete n[ticker]; return n; }), 3000);
  }

  const HEADERS = ["Ticker", "Company", "Sector", "X", "Y", "IR URL", "Visits", "Last Visit", "Schedule", "Scenario Sched", ""];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Graph Nodes</h1>
        <button
          style={{ ...BTN, background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", marginLeft: "auto" }}
          onClick={verifyIrUrls}
          disabled={verifying}
        >
          {verifying ? "Verifying…" : "Verify IR URLs"}
        </button>
        {verifyResult && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Checked {verifyResult.checked} · Updated {verifyResult.updated} · Failed {verifyResult.failed}
          </span>
        )}
      </div>

      {/* Add form */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add stock node</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 80px 80px", gap: 10, marginBottom: 10 }}>
          <input style={INPUT} placeholder="Ticker" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })} />
          <input style={INPUT} placeholder="Company name" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
          <select style={INPUT} value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })}>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input style={INPUT} placeholder="X" type="number" step="0.01" value={form.x_position} onChange={e => setForm({ ...form, x_position: +e.target.value })} />
          <input style={INPUT} placeholder="Y" type="number" step="0.01" value={form.y_position} onChange={e => setForm({ ...form, y_position: +e.target.value })} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input style={INPUT} placeholder="Investor relations URL (optional)" value={form.investor_relations_url ?? ""} onChange={e => setForm({ ...form, investor_relations_url: e.target.value })} />
        </div>
        <button style={BTN} onClick={add}>Add node</button>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Table */}
      <div style={CARD}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{HEADERS.map(h => <th key={h} style={TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {stocks.length === 0 && (
              <tr><td colSpan={HEADERS.length} style={{ ...TD, color: "#334155" }}>No stocks in admin_stocks table yet.</td></tr>
            )}
            {stocks.map(s => {
              const editing = editingId === s.id;
              const e = edits[s.id] ?? s;
              return (
                <tr key={s.id}>
                  <td style={TD}><span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{s.ticker}</span></td>
                  <td style={TD}>
                    {editing
                      ? <input style={{ ...INPUT, width: 180 }} value={e.company_name ?? s.company_name} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, company_name: ev.target.value } })} />
                      : s.company_name}
                  </td>
                  <td style={TD}>
                    {editing
                      ? <select style={{ ...INPUT, width: 130 }} value={e.sector ?? s.sector} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, sector: ev.target.value } })}>
                          {SECTORS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                        </select>
                      : s.sector}
                  </td>
                  <td style={TD}>
                    {editing
                      ? <input style={{ ...INPUT, width: 70 }} type="number" step="0.01" value={e.x_position ?? s.x_position} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, x_position: +ev.target.value } })} />
                      : s.x_position}
                  </td>
                  <td style={TD}>
                    {editing
                      ? <input style={{ ...INPUT, width: 70 }} type="number" step="0.01" value={e.y_position ?? s.y_position} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, y_position: +ev.target.value } })} />
                      : s.y_position}
                  </td>
                  <td style={TD}>
                    {editing
                      ? <input style={{ ...INPUT, width: 200 }} placeholder="https://…" value={e.investor_relations_url ?? s.investor_relations_url ?? ""} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, investor_relations_url: ev.target.value } })} />
                      : s.investor_relations_url
                        ? <a href={s.investor_relations_url} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", fontSize: 12 }}>Link</a>
                        : <span style={{ color: "#334155" }}>—</span>}
                  </td>
                  {/* Visit count — read-only */}
                  <td style={{ ...TD, color: "#64748b" }}>{s.visit_count ?? 0}</td>
                  {/* Last visited — read-only */}
                  <td style={{ ...TD, color: "#64748b", fontSize: 12 }}>{fmtDate(s.last_visited_at)}</td>
                  {/* Analysis schedule — always-editable inline dropdown */}
                  <td style={TD}>
                    <select
                      style={{ ...INPUT, width: 110, fontSize: 12, padding: "4px 8px" }}
                      value={s.analysis_schedule ?? "on_visit"}
                      onChange={ev => patchSchedule(s.ticker, ev.target.value)}
                    >
                      {SCHEDULES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  {/* Scenario schedule */}
                  <td style={TD}>
                    <select
                      style={{ ...INPUT, width: 110, fontSize: 12, padding: "4px 8px" }}
                      value={s.scenario_schedule ?? "on_visit"}
                      onChange={ev => patchScenarioSchedule(s.ticker, ev.target.value)}
                    >
                      {SCHEDULES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </td>
                  {/* Actions */}
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {editing
                        ? <>
                            <button style={BTN} onClick={() => save(s.id)}>Save</button>
                            <button style={{ ...BTN_D, background: "none", border: "none", color: "#475569" }} onClick={() => { setEditingId(null); setEdits({}); }}>Cancel</button>
                          </>
                        : <>
                            <button style={{ ...BTN, background: "rgba(255,255,255,0.05)", color: "#94a3b8" }} onClick={() => setEditingId(s.id)}>Edit</button>
                            <button
                              style={{ ...BTN, background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                              onClick={() => regenAnalysis(s.ticker)}
                              title="Clear cached analysis — regenerates on next visit"
                            >
                              {regenMsg[s.ticker] ?? "Regen"}
                            </button>
                            <button
                              style={{ ...BTN, background: "rgba(168,85,247,0.08)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}
                              onClick={() => discoverIr(s.ticker, s.company_name)}
                              disabled={irDiscovering[s.ticker]}
                              title="Use Claude web search to find the IR URL"
                            >
                              {irDiscovering[s.ticker] ? "…" : irMsg[s.ticker] ?? "Find IR"}
                            </button>
                            <button style={BTN_D} onClick={() => del(s.id)}>Remove</button>
                          </>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
