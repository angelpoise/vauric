"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

// Fallback used only if DB sector fetch fails
const FALLBACK_SECTORS = ["Information Technology", "Energy", "Healthcare", "Financials",
  "Consumer Staples", "Consumer Discretionary",
  "Industrials", "Communication Services", "Materials", "Real Estate", "Utilities"];

const SCHEDULES = [
  { value: "on_visit", label: "On visit" },
  { value: "daily",    label: "Daily"    },
  { value: "weekly",   label: "Weekly"   },
];

const NODE_TYPE_LABELS: Record<string, string> = {
  stock: "Stock", sector: "Sector", subsector: "Sub-sector", subsubsector: "Industry",
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
  ticker: "", company_name: "", sector: "Information Technology", investor_relations_url: "",
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

// Canonical analysis/scenarios cache key for any node type
function nodeAnalysisKey(n: Node): string | null {
  if (n.node_type === "stock") return n.ticker;
  return n.etf_ticker ?? n.company_name;
}

type EditFormData = {
  company_name: string;
  display_name: string;
  etf_ticker:   string;
  colour:       string;
  parent_node_id: string;
  ticker:       string;
  sector:       string;
  investor_relations_url: string;
};

export default function NodesPage() {
  const [nodes, setNodes]           = useState<Node[]>([]);
  const [sectorNames, setSectorNames] = useState<string[]>(FALLBACK_SECTORS);
  const [form, setForm]             = useState<FormState>(BLANK_FORM);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [err, setErr]               = useState<string | null>(null);
  const [regenMsg, setRegenMsg]     = useState<Record<string, string>>({});
  const [regenScMsg, setRegenScMsg] = useState<Record<string, string>>({});
  const [irDiscovering, setIrDiscovering] = useState<Record<string, boolean>>({});
  const [irMsg, setIrMsg]           = useState<Record<string, string>>({});
  const [verifying, setVerifying]   = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ checked: number; updated: number; failed: number } | null>(null);
  const [editingNode, setEditingNode]   = useState<Node | null>(null);
  const [editForm, setEditForm]         = useState<EditFormData | null>(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [regenOverviewMsg, setRegenOverviewMsg] = useState<Record<string, string>>({});
  const [lookingUp, setLookingUp]       = useState(false);
  const [irFormLookingUp, setIrFormLookingUp] = useState(false);

  // Bulk import state
  const [bulkText, setBulkText]         = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult]     = useState<{ added: string[]; skipped: string[]; failed: string[] } | null>(null);

  // Missing IR state
  const [irCheckOpen, setIrCheckOpen]   = useState(false);
  const [irDiscoverAll, setIrDiscoverAll] = useState(false);
  const [irProgress, setIrProgress]     = useState<{ current: number; total: number; ticker: string } | null>(null);
  const [irResults, setIrResults]       = useState<Record<string, "found" | "not-found">>({});

  // Quality check state
  type QualityIssue = { ticker: string; currentName: string; currentSector: string; suggestedName: string | null; suggestedSector: string | null; };
  const [qcRunning, setQcRunning]       = useState(false);
  const [qcIssues, setQcIssues]         = useState<QualityIssue[] | null>(null);
  const [qcSelected, setQcSelected]     = useState<Set<string>>(new Set());
  const [qcApplying, setQcApplying]     = useState(false);

  async function load() {
    const r = await adminFetch("/api/admin/stocks");
    if (r.ok) {
      const all: Node[] = await r.json();
      setNodes(all);
      // Derive sector names from actual sector nodes in the DB
      const names = all
        .filter((n) => n.node_type === "sector")
        .map((n) => n.display_name ?? n.company_name ?? "")
        .filter(Boolean)
        .sort();
      if (names.length > 0) setSectorNames(names);
    }
  }
  useEffect(() => { load(); }, []);

  async function discoverIrForForm(ticker: string, companyName: string) {
    setIrFormLookingUp(true);
    try {
      const irR = await adminFetch("/api/admin/stocks/discover-ir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, companyName }),
      });
      if (irR.ok) {
        const { url } = await irR.json();
        if (url) setForm((prev) => ({ ...prev, investor_relations_url: url }));
      }
    } catch { /* ignore */ } finally {
      setIrFormLookingUp(false);
    }
  }

  async function lookupTicker(ticker: string) {
    if (!ticker || form.node_type !== "stock") return;
    setLookingUp(true);
    try {
      const r = await adminFetch(`/api/admin/ticker-lookup?ticker=${encodeURIComponent(ticker)}`);
      if (r.ok) {
        const { name, sector } = await r.json();
        setForm((prev) => ({
          ...prev,
          ...(name   ? { company_name: name }   : {}),
          ...(sector ? { sector }               : {}),
        }));
        if (name) discoverIrForForm(ticker, name);
      }
    } finally {
      setLookingUp(false);
    }
  }

  async function runBulkImport() {
    const tickers = bulkText
      .split(/[\n,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (tickers.length === 0) return;
    setBulkImporting(true);
    setBulkResult(null);
    try {
      const r = await adminFetch("/api/admin/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      if (r.ok) {
        setBulkResult(await r.json());
        setBulkText("");
        load();
      }
    } finally {
      setBulkImporting(false);
    }
  }

  async function discoverAllMissingIr(missing: Node[]) {
    setIrDiscoverAll(true);
    setIrResults({});
    const valid = missing.filter((n) => n.ticker && n.company_name);
    const CONCURRENCY = 3;
    let completed = 0;

    for (let i = 0; i < valid.length; i += CONCURRENCY) {
      const batch = valid.slice(i, i + CONCURRENCY);
      setIrProgress({ current: i + 1, total: valid.length, ticker: batch.map((n) => n.ticker).join(", ") });
      await Promise.all(batch.map(async (n) => {
        try {
          const r = await adminFetch("/api/admin/stocks/discover-ir", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker: n.ticker, companyName: n.company_name }),
          });
          setIrResults((prev) => ({ ...prev, [n.ticker!]: r.ok ? "found" : "not-found" }));
        } catch {
          setIrResults((prev) => ({ ...prev, [n.ticker!]: "not-found" }));
        }
        completed++;
        setIrProgress({ current: completed, total: valid.length, ticker: batch.map((b) => b.ticker).join(", ") });
      }));
    }
    setIrProgress(null);
    setIrDiscoverAll(false);
    load();
  }

  async function runQualityCheck() {
    setQcRunning(true);
    setQcIssues(null);
    setQcSelected(new Set());
    try {
      const r = await adminFetch("/api/admin/quality-check");
      if (r.ok) {
        const issues: QualityIssue[] = await r.json();
        setQcIssues(issues);
        setQcSelected(new Set(issues.map((i) => i.ticker)));
      }
    } finally {
      setQcRunning(false);
    }
  }

  async function applyQcFixes() {
    if (!qcIssues) return;
    setQcApplying(true);
    const fixes = qcIssues
      .filter((i) => qcSelected.has(i.ticker))
      .map((i) => ({
        ticker: i.ticker,
        ...(i.suggestedName   ? { company_name: i.suggestedName }   : {}),
        ...(i.suggestedSector ? { sector: i.suggestedSector } : {}),
      }));
    await adminFetch("/api/admin/quality-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fixes),
    });
    setQcApplying(false);
    setQcIssues(null);
    load();
  }

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

  const [clearingOverviews, setClearingOverviews] = useState(false);
  const [overviewsClearedMsg, setOverviewsClearedMsg] = useState<string | null>(null);
  const [cleaningJunk, setCleaningJunk]   = useState(false);
  const [junkResult, setJunkResult]       = useState<string | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [repositionResult, setRepositionResult] = useState<string | null>(null);

  async function clearAllOverviews() {
    if (!confirm("Clear cached overviews for all hierarchy nodes? They will regenerate on next page visit.")) return;
    setClearingOverviews(true);
    try {
      const r = await adminFetch("/api/admin/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-overviews" }),
      });
      setOverviewsClearedMsg(r.ok ? "Overviews cleared ✓" : `Error ${r.status}`);
    } catch { setOverviewsClearedMsg("Error"); }
    finally { setClearingOverviews(false); setTimeout(() => setOverviewsClearedMsg(null), 4000); }
  }

  async function regenAnalysis(key: string) {
    setRegenMsg((m) => ({ ...m, [key]: "Clearing…" }));
    try {
      const delR = await adminFetch(`/api/analysis?ticker=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!delR.ok) { setRegenMsg((m) => ({ ...m, [key]: `Error ${delR.status}` })); return; }
      setRegenMsg((m) => ({ ...m, [key]: "Generating…" }));
      const genR = await adminFetch(`/api/analysis?ticker=${encodeURIComponent(key)}`);
      setRegenMsg((m) => ({ ...m, [key]: genR.ok ? "Done ✓" : `Error ${genR.status}` }));
    } catch { setRegenMsg((m) => ({ ...m, [key]: "Error" })); }
    setTimeout(() => setRegenMsg((m) => { const n = { ...m }; delete n[key]; return n; }), 3000);
  }

  async function regenScenarios(key: string) {
    setRegenScMsg((m) => ({ ...m, [key]: "Clearing…" }));
    try {
      const delR = await adminFetch(`/api/scenarios?ticker=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!delR.ok) { setRegenScMsg((m) => ({ ...m, [key]: `Error ${delR.status}` })); return; }
      setRegenScMsg((m) => ({ ...m, [key]: "Generating…" }));
      const genR = await adminFetch(`/api/scenarios?ticker=${encodeURIComponent(key)}`);
      setRegenScMsg((m) => ({ ...m, [key]: genR.ok ? "Done ✓" : `Error ${genR.status}` }));
    } catch { setRegenScMsg((m) => ({ ...m, [key]: "Error" })); }
    setTimeout(() => setRegenScMsg((m) => { const n = { ...m }; delete n[key]; return n; }), 3000);
  }

  async function regenOverview(nodeId: string) {
    setRegenOverviewMsg((m) => ({ ...m, [nodeId]: "Clearing…" }));
    try {
      await adminFetch(`/api/hierarchy/overview?nodeId=${nodeId}`, { method: "DELETE" });
      setRegenOverviewMsg((m) => ({ ...m, [nodeId]: "Generating…" }));
      const r = await adminFetch("/api/hierarchy/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      setRegenOverviewMsg((m) => ({ ...m, [nodeId]: r.ok ? "Done ✓" : `Error ${r.status}` }));
    } catch { setRegenOverviewMsg((m) => ({ ...m, [nodeId]: "Error" })); }
    setTimeout(() => setRegenOverviewMsg((m) => { const n = { ...m }; delete n[nodeId]; return n; }), 3000);
  }

  function openEdit(n: Node) {
    setEditingNode(n);
    setEditForm({
      company_name:           n.company_name ?? "",
      display_name:           n.display_name ?? "",
      etf_ticker:             n.etf_ticker ?? "",
      colour:                 n.colour ?? "#64748b",
      parent_node_id:         n.parent_node_id ?? "",
      ticker:                 n.ticker ?? "",
      sector:                 n.sector ?? "",
      investor_relations_url: n.investor_relations_url ?? "",
    });
  }

  async function saveEdit() {
    if (!editingNode || !editForm) return;
    setEditSaving(true);
    const body: Record<string, unknown> = {};
    if (editingNode.node_type === "stock") {
      body.company_name           = editForm.company_name;
      body.sector                 = editForm.sector;
      body.investor_relations_url = editForm.investor_relations_url || null;
    } else if (editingNode.node_type === "sector") {
      body.company_name   = editForm.company_name;
      body.display_name   = editForm.display_name || editForm.company_name;
      body.etf_ticker     = editForm.etf_ticker || null;
      body.colour         = editForm.colour || null;
    } else {
      // subsector / subsubsector — single "Name" field drives both identifiers
      body.company_name   = editForm.company_name;
      body.display_name   = editForm.company_name;
      body.etf_ticker     = editForm.etf_ticker || null;
      if (editForm.parent_node_id) body.parent_node_id = editForm.parent_node_id;
    }
    await adminFetch(`/api/admin/stocks/${editingNode.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setEditSaving(false);
    setEditingNode(null);
    setEditForm(null);
    load();
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
          style={{ ...BTN, background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }}
          onClick={clearAllOverviews} disabled={clearingOverviews}
        >
          {clearingOverviews ? "Clearing…" : overviewsClearedMsg ?? "Clear All Overviews"}
        </button>
        <button
          style={{ ...BTN, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}
          onClick={async () => {
            setCleaningJunk(true); setJunkResult(null);
            // Dry run first
            const dry = await adminFetch("/api/admin/cleanup-junk-nodes");
            const d = await dry.json();
            const msg = `Dry run: ${d.summary}\nObvious junk (${d.obviousJunk?.length}): ${d.obviousJunk?.slice(0,10).join(", ")}...\nAPI would delete (${d.apiDeleted?.length}): ${d.apiDeleted?.slice(0,10).join(", ")}...\nAPI would fix (${d.apiFixed?.length}): ${d.apiFixed?.join(", ")}\n\nProceed with deletion?`;
            if (!confirm(msg)) { setCleaningJunk(false); return; }
            const r = await adminFetch("/api/admin/cleanup-junk-nodes", { method: "POST" });
            const result = await r.json();
            setJunkResult(result.summary);
            setCleaningJunk(false); load();
          }} disabled={cleaningJunk}
        >
          {cleaningJunk ? "Cleaning…" : "Clean junk nodes"}
        </button>
        {junkResult && <span style={{ fontSize: 12, color: "#64748b" }}>{junkResult}</span>}
        <button
          style={{ ...BTN, background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }}
          onClick={async () => {
            setRepositioning(true); setRepositionResult(null);
            const r = await adminFetch("/api/admin/reposition-stocks", { method: "POST" });
            const d = await r.json();
            setRepositionResult(r.ok ? `Repositioned ${d.repositioned} stocks (${d.withT1}/${d.total} had T1 connections)` : d.error);
            setRepositioning(false); load();
          }} disabled={repositioning}
        >
          {repositioning ? "Repositioning…" : "Reposition stocks"}
        </button>
        {repositionResult && <span style={{ fontSize: 12, color: "#64748b" }}>{repositionResult}</span>}
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
            <option value="subsubsector">Industry</option>
          </select>
        </div>

        {form.node_type === "stock" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 80px 80px", gap: 10, marginBottom: 10 }}>
              <div style={{ position: "relative" }}>
                <input
                  style={INPUT}
                  placeholder="Ticker"
                  value={form.ticker}
                  onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                  onBlur={(e) => lookupTicker(e.target.value)}
                />
                {lookingUp && (
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#475569" }}>
                    …
                  </span>
                )}
              </div>
              <input style={INPUT} placeholder="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              <select style={INPUT} value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                {sectorNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input style={INPUT} placeholder="X" type="number" step="0.01" value={form.x_position} onChange={(e) => setForm({ ...form, x_position: +e.target.value })} />
              <input style={INPUT} placeholder="Y" type="number" step="0.01" value={form.y_position} onChange={(e) => setForm({ ...form, y_position: +e.target.value })} />
            </div>
            <div style={{ marginBottom: 10, position: "relative" }}>
              <input
                style={INPUT}
                placeholder={irFormLookingUp ? "Finding IR URL…" : "IR URL (optional)"}
                value={form.investor_relations_url}
                onChange={(e) => setForm({ ...form, investor_relations_url: e.target.value })}
                disabled={irFormLookingUp}
              />
              {irFormLookingUp && (
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#475569" }}>
                  …
                </span>
              )}
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

      {/* Bulk import */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>Bulk import stocks</div>
        <div style={{ fontSize: 11, color: "#334155", marginBottom: 10 }}>
          Paste tickers separated by commas, spaces, or new lines. Name and sector are auto-filled from Polygon.
        </div>
        <textarea
          style={{ ...INPUT, height: 90, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
          placeholder={"AAPL, MSFT, NVDA\nGOOGL, META, AMZN"}
          value={bulkText}
          onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
          <button style={{ ...BTN, opacity: !bulkText.trim() || bulkImporting ? 0.55 : 1 }} onClick={runBulkImport} disabled={!bulkText.trim() || bulkImporting}>
            {bulkImporting ? "Importing…" : "Import"}
          </button>
          {bulkResult && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {bulkResult.added.length > 0 && <span style={{ color: "#22c55e" }}>✓ {bulkResult.added.length} added</span>}
              {bulkResult.skipped.length > 0 && <span style={{ color: "#475569" }}> · {bulkResult.skipped.length} skipped (already exist)</span>}
              {bulkResult.failed.length > 0 && <span style={{ color: "#ef4444" }}> · {bulkResult.failed.length} failed</span>}
            </span>
          )}
        </div>
      </div>

      {/* Missing IR links */}
      {(() => {
        const missing = nodes.filter((n) => n.node_type === "stock" && !n.investor_relations_url);
        return (
          <div style={{ ...CARD, marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                  Missing IR links
                </div>
                <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                  {missing.length === 0 ? "All stocks have IR links." : `${missing.length} stock${missing.length !== 1 ? "s" : ""} missing an IR link.`}
                </div>
              </div>
              {missing.length > 0 && (
                <>
                  <button style={{ ...BTN, background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}
                    onClick={() => setIrCheckOpen((o) => !o)}>
                    {irCheckOpen ? "Hide" : "Show"}
                  </button>
                  <button style={{ ...BTN, opacity: irDiscoverAll ? 0.6 : 1 }}
                    onClick={() => discoverAllMissingIr(missing)} disabled={irDiscoverAll}>
                    {irDiscoverAll ? `Discovering… (${irProgress?.current}/${irProgress?.total} — ${irProgress?.ticker})` : "Discover all"}
                  </button>
                </>
              )}
            </div>

            {irCheckOpen && missing.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {missing.map((n) => {
                    const res = irResults[n.ticker ?? ""];
                    return (
                      <div key={n.ticker} style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 20,
                        background: res === "found" ? "rgba(34,197,94,0.1)" : res === "not-found" ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${res === "found" ? "rgba(34,197,94,0.3)" : res === "not-found" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`,
                        color: res === "found" ? "#22c55e" : res === "not-found" ? "#ef4444" : "#64748b",
                        fontFamily: "monospace",
                      }}>
                        {n.ticker}
                        {res === "found" && " ✓"}
                        {res === "not-found" && " ✗"}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Quality check */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: qcIssues ? 16 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase" }}>Quality check</div>
            {!qcIssues && !qcRunning && <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>Scan all stocks against Polygon — flags wrong sectors and messy names.</div>}
          </div>
          <button style={BTN} onClick={runQualityCheck} disabled={qcRunning}>
            {qcRunning ? "Scanning…" : "Run check"}
          </button>
        </div>

        {qcIssues && qcIssues.length === 0 && (
          <div style={{ fontSize: 12, color: "#22c55e" }}>All stocks look good — no issues found.</div>
        )}

        {qcIssues && qcIssues.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
              {qcIssues.length} issue{qcIssues.length !== 1 ? "s" : ""} found · {qcSelected.size} selected
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["", "Ticker", "Current name", "Suggested name", "Current sector", "Suggested sector"].map((h) => (
                      <th key={h} style={{ ...TH, paddingBottom: 8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {qcIssues.map((issue) => {
                    const sel = qcSelected.has(issue.ticker);
                    return (
                      <tr key={issue.ticker} onClick={() => setQcSelected((prev) => { const n = new Set(prev); if (sel) { n.delete(issue.ticker); } else { n.add(issue.ticker); } return n; })} style={{ cursor: "pointer", background: sel ? "rgba(59,130,246,0.04)" : "transparent" }}>
                        <td style={{ ...TD, width: 24 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${sel ? "#3b82f6" : "rgba(255,255,255,0.2)"}`, background: sel ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {sel && <span style={{ color: "#fff", fontSize: 9 }}>✓</span>}
                          </div>
                        </td>
                        <td style={{ ...TD, fontWeight: 700, letterSpacing: "0.04em" }}>{issue.ticker}</td>
                        <td style={{ ...TD, color: issue.suggestedName ? "#ef4444" : "#64748b" }}>{issue.currentName || "—"}</td>
                        <td style={{ ...TD, color: "#22c55e" }}>{issue.suggestedName ? issue.suggestedName : <span style={{ color: "#334155" }}>✓</span>}</td>
                        <td style={{ ...TD, color: issue.suggestedSector ? "#ef4444" : "#64748b" }}>{issue.currentSector || "—"}</td>
                        <td style={{ ...TD, color: "#22c55e" }}>{issue.suggestedSector ? issue.suggestedSector : <span style={{ color: "#334155" }}>✓</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
              <button style={{ ...BTN, opacity: qcSelected.size === 0 || qcApplying ? 0.55 : 1 }} onClick={applyQcFixes} disabled={qcSelected.size === 0 || qcApplying}>
                {qcApplying ? "Applying…" : `Apply ${qcSelected.size} fix${qcSelected.size !== 1 ? "es" : ""}`}
              </button>
              <button onClick={() => setQcSelected(qcSelected.size === qcIssues.length ? new Set() : new Set(qcIssues.map((i) => i.ticker)))}
                style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: 0 }}>
                {qcSelected.size === qcIssues.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          </>
        )}
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
                        {/* Regen analysis — all node types with an analysis key */}
                        {nodeAnalysisKey(n) && (() => { const k = nodeAnalysisKey(n)!; return (
                          <>
                            <button
                              style={{ ...BTN, background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}
                              onClick={() => regenAnalysis(k)} title="Regen analysis">
                              {regenMsg[k] ?? "Regen"}
                            </button>
                            <button
                              style={{ ...BTN, background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}
                              onClick={() => regenScenarios(k)} title="Regen scenarios">
                              {regenScMsg[k] ?? "Regen SC"}
                            </button>
                          </>
                        ); })()}
                        {/* Find IR — stocks only */}
                        {isStock && n.ticker && (
                          <button
                            style={{ ...BTN, background: "rgba(168,85,247,0.08)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}
                            onClick={() => discoverIr(n.ticker!, n.company_name ?? "")}
                            disabled={!!irDiscovering[n.ticker]}>
                            {irDiscovering[n.ticker] ? "…" : irMsg[n.ticker] ?? "Find IR"}
                          </button>
                        )}
                        {/* Edit button — all node types */}
                        <button
                          style={{ ...BTN, background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)" }}
                          onClick={() => openEdit(n)}>
                          Edit
                        </button>
                        {/* Regen Overview — hierarchy nodes only */}
                        {!isStock && (
                          <button
                            style={{ ...BTN, background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}
                            onClick={() => regenOverview(n.id)} title="Clear and regenerate overview">
                            {regenOverviewMsg[n.id] ?? "Regen Overview"}
                          </button>
                        )}
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

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
    {editingNode && editForm && (
      <>
        <div onClick={() => { setEditingNode(null); setEditForm(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 50 }} />
        <div style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          zIndex: 51, background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12, padding: 28, width: 480,
          fontFamily: '"DM Sans", sans-serif',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", marginBottom: 20 }}>
            Edit {NODE_TYPE_LABELS[editingNode.node_type]} — {editingNode.display_name ?? editingNode.company_name ?? editingNode.etf_ticker}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {editingNode.node_type === "stock" && (<>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Company name</div>
                <input style={INPUT} value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Sector</div>
                <select style={INPUT} value={editForm.sector} onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}>
                  {sectorNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>IR URL</div>
                <input style={INPUT} placeholder="https://…" value={editForm.investor_relations_url} onChange={(e) => setEditForm({ ...editForm, investor_relations_url: e.target.value })} /></div>
            </>)}
            {editingNode.node_type === "sector" && (<>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Display name</div>
                <input style={INPUT} value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>ETF ticker</div>
                <input style={INPUT} value={editForm.etf_ticker} onChange={(e) => setEditForm({ ...editForm, etf_ticker: e.target.value.toUpperCase() })} /></div>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Colour</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="color" value={editForm.colour} onChange={(e) => setEditForm({ ...editForm, colour: e.target.value })}
                    style={{ width: 40, height: 36, borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "none", cursor: "pointer", padding: 2 }} />
                  <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{editForm.colour}</span>
                </div>
              </div>
            </>)}
            {(editingNode.node_type === "subsector" || editingNode.node_type === "subsubsector") && (<>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Name</div>
                <input style={INPUT} value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} /></div>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>
                Parent {editingNode.node_type === "subsector" ? "sector" : "sub-sector" /* parent of an industry is always a sub-sector */}
              </div>
                <select style={INPUT} value={editForm.parent_node_id}
                  onChange={(e) => setEditForm({ ...editForm, parent_node_id: e.target.value })}>
                  <option value="">— unchanged —</option>
                  {(editingNode.node_type === "subsector" ? sectorNodes : subsectorNodes)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name ?? p.company_name ?? p.etf_ticker ?? p.id}
                      </option>
                    ))}
                </select>
              </div>
              <div><div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>ETF ticker (optional)</div>
                <input style={INPUT} placeholder="e.g. SOXX" value={editForm.etf_ticker} onChange={(e) => setEditForm({ ...editForm, etf_ticker: e.target.value.toUpperCase() })} /></div>
            </>)}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setEditingNode(null); setEditForm(null); }}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#64748b", fontSize: 12, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button onClick={saveEdit} disabled={editSaving}
              style={{ ...BTN, opacity: editSaving ? 0.6 : 1 }}>
              {editSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </>
    )}
    </div>
  );
}
