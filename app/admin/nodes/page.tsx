"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGACY_SECTORS = ["Technology", "Energy", "Healthcare", "Finance", "Consumer",
  "Financial Services", "Industrials", "Consumer Discretionary", "Communication Services",
  "Materials", "Real Estate", "Utilities"];

const SCHEDULES = [
  { value: "on_visit", label: "On visit" },
  { value: "daily",    label: "Daily"    },
  { value: "weekly",   label: "Weekly"   },
];

const NODE_TYPE_LABELS: Record<string, string> = {
  stock: "Stock", sector: "Sector", subsector: "Sub-sector", subsubsector: "Sub-sub-sector",
};
const NODE_TYPE_COLORS: Record<string, string> = {
  stock: "#3b82f6", sector: "#10b981", subsector: "#f59e0b", subsubsector: "#a855f7",
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD:  React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN:   React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH:    React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 12px 10px 0", textAlign: "left", whiteSpace: "nowrap" };
const TD:    React.CSSProperties = { padding: "10px 12px 10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0", verticalAlign: "middle" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface Node {
  id: string;
  node_type: "stock" | "sector" | "subsector" | "subsubsector";
  // stock fields
  ticker: string | null;
  company_name: string | null;
  sector: string | null;
  investor_relations_url: string | null;
  visit_count: number | null;
  last_visited_at: string | null;
  analysis_schedule: string | null;
  scenario_schedule: string | null;
  // hierarchy fields
  display_name: string | null;
  etf_ticker: string | null;
  colour: string | null;
  parent_node_id: string | null;
  // common
  x_position: number;
  y_position: number;
}

type FormState = {
  node_type: "stock" | "sector" | "subsector" | "subsubsector";
  ticker: string;
  company_name: string;
  sector: string;
  investor_relations_url: string;
  display_name: string;
  etf_ticker: string;
  colour: string;
  parent_node_id: string;
  x_position: number;
  y_position: number;
};

const BLANK_FORM: FormState = {
  node_type: "stock",
  ticker: "", company_name: "", sector: "Technology", investor_relations_url: "",
  display_name: "", etf_ticker: "", colour: "#3b82f6", parent_node_id: "",
  x_position: 0.5, y_position: 0.5,
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TypePill({ type }: { type: string }) {
  const col = NODE_TYPE_COLORS[type] ?? "#64748b";
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
      background: `${col}18`, border: `1px solid ${col}40`, color: col, whiteSpace: "nowrap" }}>
      {NODE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NodesPage() {
  const [nodes, setNodes]           = useState<Node[]>([]);
  const [form, setForm]             = useState<FormState>(BLANK_FORM);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [err, setErr]               = useState<string | null>(null);
  const [regenMsg, setRegenMsg]     = useState<Record<string, string>>({});
  const [regenScMsg, setRegenScMsg] = useState<Record<string, string>>({});
  const [irDiscovering, setIrDiscovering] = useState<Record<string, boolean>>({});
  const [irMsg, setIrMsg]           = useState<Record<string, string>>({});
  const [verifying, setVerifying]   = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ checked: number; updated: number; failed: number } | null>(null);

  async function load() {
    const r = await adminFetch("/api/admin/stocks");
    if (r.ok) setNodes(await r.json());
  }
  useEffect(() => { load(); }, []);

  const displayed = typeFilter === "all" ? nodes : nodes.filter((n) => n.node_type === typeFilter);

  // Parent dropdowns — derived from loaded nodes
  const sectorNodes    = nodes.filter((n) => n.node_type === "sector");
  const subsectorNodes = nodes.filter((n) => n.node_type === "subsector");

  async function add() {
    setErr(null);
    const { node_type } = form;
    let body: Record<string, unknown>;
    if (node_type === "stock") {
      body = {
        node_type: "stock",
        ticker: form.ticker.toUpperCase(),
        company_name: form.company_name,
        sector: form.sector,
        x_position: form.x_position,
        y_position: form.y_position,
        investor_relations_url: form.investor_relations_url || undefined,
      };
    } else {
      body = {
        node_type,
        company_name: form.company_name,
        display_name: form.display_name || form.company_name,
        etf_ticker: form.etf_ticker || undefined,
        colour: form.colour || undefined,
        parent_node_id: form.parent_node_id || undefined,
        x_position: form.x_position,
        y_position: form.y_position,
      };
    }
    const r = await adminFetch("/api/admin/stocks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) { setErr((await r.json()).error); return; }
    setForm(BLANK_FORM);
    load();
  }

  async function del(id: string) {
    if (!confirm("Remove this node?")) return;
    await adminFetch(`/api/admin/stocks/${id}`, { method: "DELETE" });
    load();
  }

  async function patchSchedule(ticker: string, key: "analysis_schedule" | "scenario_schedule", value: string) {
    await adminFetch(`/api/admin/stocks/${ticker}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }),
    });
    setNodes((prev) => prev.map((n) => n.ticker === ticker ? { ...n, [key]: value } : n));
  }

  async function discoverIr(ticker: string, company_name: string) {
    setIrDiscovering((m) => ({ ...m, [ticker]: true }));
    setIrMsg((m) => ({ ...m, [ticker]: "Searching…" }));
    try {
      const r = await adminFetch("/api/admin/stocks/discover-ir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, companyName: company_name }),
      });
      const data = await r.json();
      if (r.ok && data.url) {
        setIrMsg((m) => ({ ...m, [ticker]: "Found" }));
        setNodes((prev) => prev.map((n) => n.ticker === ticker ? { ...n, investor_relations_url: data.url } : n));
      } else {
        setIrMsg((m) => ({ ...m, [ticker]: data.error ?? "Not found" }));
      }
    } catch { setIrMsg((m) => ({ ...m, [ticker]: "Error" })); }
    finally {
      setIrDiscovering((m) => ({ ...m, [ticker]: false }));
      setTimeout(() => setIrMsg((m) => { const n = { ...m }; delete n[ticker]; return n; }), 4000);
    }
  }

  async function verifyIrUrls() {
    setVerifying(true); setVerifyResult(null);
    try { const r = await adminFetch("/api/admin/stocks/verify-ir"); if (r.ok) { setVerifyResult(await r.json()); load(); } }
    catch { /* ignore */ } finally { setVerifying(false); }
  }

  async function regenAnalysis(ticker: string) {
    setRegenMsg((m) => ({ ...m, [ticker]: "Clearing…" }));
    try {
      const delR = await adminFetch(`/api/analysis?ticker=${ticker}`, { method: "DELETE" });
      if (!delR.ok) { setRegenMsg((m) => ({ ...m, [ticker]: `Error ${delR.status}` })); return; }
      setRegenMsg((m) => ({ ...m, [ticker]: "Generating…" }));
      const genR = await adminFetch(`/api/analysis?ticker=${ticker}`);
      setRegenMsg((m) => ({ ...m, [ticker]: genR.ok ? "Done ✓" : `Error ${genR.status}` }));
    } catch { setRegenMsg((m) => ({ ...m, [ticker]: "Error" })); }
    setTimeout(() => setRegenMsg((m) => { const n = { ...m }; delete n[ticker]; return n; }), 3000);
  }

  async function regenScenarios(ticker: string) {
    setRegenScMsg((m) => ({ ...m, [ticker]: "Clearing…" }));
    try {
      const delR = await adminFetch(`/api/scenarios?ticker=${ticker}`, { method: "DELETE" });
      if (!delR.ok) { setRegenScMsg((m) => ({ ...m, [ticker]: `Error ${delR.status}` })); return; }
      setRegenScMsg((m) => ({ ...m, [ticker]: "Generating…" }));
      const genR = await adminFetch(`/api/scenarios?ticker=${ticker}`);
      setRegenScMsg((m) => ({ ...m, [ticker]: genR.ok ? "Done ✓" : `Error ${genR.status}` }));
    } catch { setRegenScMsg((m) => ({ ...m, [ticker]: "Error" })); }
    setTimeout(() => setRegenScMsg((m) => { const n = { ...m }; delete n[ticker]; return n; }), 3000);
  }

  const parentOptions = form.node_type === "subsector"
    ? sectorNodes.map((n) => ({ value: n.id, label: n.display_name ?? n.company_name ?? n.etf_ticker ?? n.id }))
    : form.node_type === "subsubsector"
      ? subsectorNodes.map((n) => ({ value: n.id, label: n.company_name ?? n.id }))
      : [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Graph Nodes</h1>

        {/* Type filter */}
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {["all", "stock", "sector", "subsector", "subsubsector"].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              ...BTN, padding: "4px 10px",
              background: typeFilter === t ? (t === "all" ? "#3b82f6" : NODE_TYPE_COLORS[t]) : "rgba(255,255,255,0.05)",
              border: "none",
            }}>
              {t === "all" ? "All" : NODE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <button
          style={{ ...BTN, background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", marginLeft: "auto" }}
          onClick={verifyIrUrls} disabled={verifying}
        >
          {verifying ? "Verifying…" : "Verify IR URLs"}
        </button>
        {verifyResult && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Checked {verifyResult.checked} · Updated {verifyResult.updated} · Failed {verifyResult.failed}
          </span>
        )}
      </div>

      {/* Create form */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>
          Add node
        </div>

        {/* Type selector */}
        <div style={{ marginBottom: 12 }}>
          <select style={{ ...INPUT, width: "auto" }} value={form.node_type}
            onChange={(e) => setForm({ ...BLANK_FORM, node_type: e.target.value as FormState["node_type"] })}>
            <option value="stock">Stock</option>
            <option value="sector">Sector</option>
            <option value="subsector">Sub-sector</option>
            <option value="subsubsector">Sub-sub-sector</option>
          </select>
        </div>

        {form.node_type === "stock" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 80px 80px", gap: 10, marginBottom: 10 }}>
              <input style={INPUT} placeholder="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} />
              <input style={INPUT} placeholder="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              <select style={INPUT} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {LEGACY_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input style={INPUT} placeholder="X" type="number" step="0.01" value={form.x_position} onChange={(e) => setForm({ ...form, x_position: +e.target.value })} />
              <input style={INPUT} placeholder="Y" type="number" step="0.01" value={form.y_position} onChange={(e) => setForm({ ...form, y_position: +e.target.value })} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <input style={INPUT} placeholder="IR URL (optional)" value={form.investor_relations_url} onChange={(e) => setForm({ ...form, investor_relations_url: e.target.value })} />
            </div>
          </>
        )}

        {(form.node_type === "sector") && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 80px", gap: 10, marginBottom: 10 }}>
              <input style={INPUT} placeholder="Display name (e.g. Technology)" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              <input style={INPUT} placeholder="ETF ticker (e.g. XLK)" value={form.etf_ticker} onChange={(e) => setForm({ ...form, etf_ticker: e.target.value.toUpperCase() })} />
              <input style={INPUT} placeholder="Colour (#hex)" value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
              <input style={INPUT} placeholder="X" type="number" step="0.01" value={form.x_position} onChange={(e) => setForm({ ...form, x_position: +e.target.value })} />
              <input style={INPUT} placeholder="Y" type="number" step="0.01" value={form.y_position} onChange={(e) => setForm({ ...form, y_position: +e.target.value })} />
            </div>
          </>
        )}

        {(form.node_type === "subsector" || form.node_type === "subsubsector") && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 80px 80px", gap: 10, marginBottom: 10 }}>
              <input style={INPUT} placeholder="Name (e.g. Semiconductors)" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              <select style={INPUT} value={form.parent_node_id} onChange={(e) => setForm({ ...form, parent_node_id: e.target.value })}>
                <option value="">— Select parent —</option>
                {parentOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input style={INPUT} placeholder="ETF (optional)" value={form.etf_ticker} onChange={(e) => setForm({ ...form, etf_ticker: e.target.value.toUpperCase() })} />
              <input style={INPUT} placeholder="X" type="number" step="0.01" value={form.x_position} onChange={(e) => setForm({ ...form, x_position: +e.target.value })} />
              <input style={INPUT} placeholder="Y" type="number" step="0.01" value={form.y_position} onChange={(e) => setForm({ ...form, y_position: +e.target.value })} />
            </div>
          </>
        )}

        <button style={BTN} onClick={add}>Add node</button>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Table */}
      <div style={CARD}>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 12 }}>
          Showing {displayed.length} of {nodes.length} nodes
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                {["Type", "Name / Ticker", "Parent / Sector", "ETF", "Last Visit", "Schedule", ""].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={8} style={{ ...TD, color: "#334155" }}>No nodes found.</td></tr>
              )}
              {displayed.map((n) => {
                const isStock = n.node_type === "stock";
                const parentNode = nodes.find((p) => p.id === n.parent_node_id);
                const parentLabel = n.node_type === "stock"
                  ? (n.sector ?? "—")
                  : parentNode
                    ? (parentNode.display_name ?? parentNode.company_name ?? parentNode.etf_ticker ?? "—")
                    : "—";
                const label = isStock ? (n.ticker ?? "—") : (n.display_name ?? n.company_name ?? n.etf_ticker ?? "—");
                const tk = n.ticker ?? n.id;

                return (
                  <tr key={n.id}>
                    <td style={TD}><TypePill type={n.node_type} /></td>
                    <td style={TD}>
                      <div style={{ fontWeight: 600, letterSpacing: isStock ? "0.04em" : 0 }}>{label}</div>
                      {isStock && n.company_name && (
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{n.company_name}</div>
                      )}
                    </td>
                    <td style={{ ...TD, fontSize: 12, color: "#64748b" }}>{parentLabel}</td>
                    <td style={{ ...TD, fontSize: 12, color: "#64748b" }}>{n.etf_ticker ?? "—"}</td>
                    <td style={{ ...TD, fontSize: 12, color: "#64748b" }}>
                      {isStock ? fmtDate(n.last_visited_at) : "—"}
                    </td>
                    <td style={TD}>
                      {isStock && n.ticker ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <select style={{ ...INPUT, width: 100, fontSize: 11, padding: "3px 6px" }}
                            value={n.analysis_schedule ?? "weekly"}
                            onChange={(ev) => patchSchedule(n.ticker!, "analysis_schedule", ev.target.value)}>
                            {SCHEDULES.map(({ value, label: l }) => <option key={value} value={value}>{l}</option>)}
                          </select>
                          <select style={{ ...INPUT, width: 100, fontSize: 11, padding: "3px 6px" }}
                            value={n.scenario_schedule ?? "weekly"}
                            onChange={(ev) => patchSchedule(n.ticker!, "scenario_schedule", ev.target.value)}>
                            {SCHEDULES.map(({ value, label: l }) => <option key={value} value={value}>{l}</option>)}
                          </select>
                        </div>
                      ) : <span style={{ color: "#334155" }}>—</span>}
                    </td>
                    <td style={TD}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {isStock && n.ticker && (<>
                          <button
                            style={{ ...BTN, background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                            onClick={() => regenAnalysis(n.ticker!)} title="Regen analysis">
                            {regenMsg[n.ticker] ?? "Regen"}
                          </button>
                          <button
                            style={{ ...BTN, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                            onClick={() => regenScenarios(n.ticker!)} title="Regen scenarios">
                            {regenScMsg[n.ticker] ?? "Regen SC"}
                          </button>
                          <button
                            style={{ ...BTN, background: "rgba(168,85,247,0.08)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}
                            onClick={() => discoverIr(n.ticker!, n.company_name ?? "")}
                            disabled={irDiscovering[n.ticker]}>
                            {irDiscovering[n.ticker] ? "…" : irMsg[n.ticker] ?? "Find IR"}
                          </button>
                        </>)}
                        <button style={BTN_D} onClick={() => del(n.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
