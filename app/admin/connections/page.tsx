"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect, useMemo } from "react";

const CARD:  React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN:   React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH:   React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left", whiteSpace: "nowrap" };
const TD:   React.CSSProperties = { padding: "10px 16px 10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0", verticalAlign: "middle" };

interface Connection { id: string; ticker_a: string; ticker_b: string; tier: number; }
interface NodeRow {
  id: string;
  node_type: "stock" | "sector" | "subsector" | "subsubsector";
  ticker: string | null;
  company_name: string | null;
  etf_ticker: string | null;
}

const TIER_COLORS: Record<number, string> = { 1: "#3b82f6", 2: "#64748b", 3: "#475569" };
const TIER_LABELS: Record<number, string> = {
  1: "Most specific (sub-sub-sector / hierarchy)",
  2: "Sub-sector / peer stock",
  3: "Sector (broadest)",
};
const NODE_TYPE_ORDER = ["stock", "sector", "subsector", "subsubsector"];

function TierBadge({ tier }: { tier: number }) {
  const col = TIER_COLORS[tier] ?? "#475569";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      background: `${col}20`, border: `1px solid ${col}40`, color: col,
      letterSpacing: "0.05em",
    }}>
      T{tier}
    </span>
  );
}

// Canonical identifier for each node (what goes in ticker_a / ticker_b)
function nodeId(n: NodeRow): string {
  if (n.node_type === "stock")   return n.ticker ?? "";
  if (n.node_type === "sector")  return n.etf_ticker ?? n.company_name ?? "";
  return n.company_name ?? "";
}

function nodeLabel(n: NodeRow): string {
  const id = nodeId(n);
  const name = n.company_name ?? n.etf_ticker ?? "";
  return id === name ? id : `${id} — ${name}`;
}

// Auto-compute tier from node types
function inferTier(idA: string, idB: string, nodes: NodeRow[]): number {
  const findType = (id: string) =>
    nodes.find((n) => nodeId(n) === id)?.node_type ?? null;
  const types = [findType(idA), findType(idB)];
  if (types.includes("subsubsector")) return 1;
  if (types.includes("subsector"))    return 2;
  if (types.includes("sector"))       return 3;
  return 2;
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [nodes, setNodes]             = useState<NodeRow[]>([]);
  const [nodeA, setNodeA]             = useState("");
  const [nodeB, setNodeB]             = useState("");
  const [tierFilter, setTierFilter]   = useState<number | null>(null);
  const [search, setSearch]           = useState("");
  const [err, setErr]                 = useState<string | null>(null);

  const autoTier = useMemo(
    () => (nodeA && nodeB ? inferTier(nodeA, nodeB, nodes) : 2),
    [nodeA, nodeB, nodes],
  );
  const [tierOverride, setTierOverride] = useState<number | null>(null);
  const selectedTier = tierOverride ?? autoTier;

  // Reset override whenever auto-tier changes (new pair selected)
  useEffect(() => { setTierOverride(null); }, [autoTier]);

  async function load() {
    const [cRes, nRes] = await Promise.all([
      adminFetch("/api/admin/connections"),
      adminFetch("/api/admin/stocks"),
    ]);
    if (cRes.ok) setConnections(await cRes.json());
    if (nRes.ok) setNodes(await nRes.json());
  }
  useEffect(() => { load(); }, []);

  // Group nodes for the dropdown <optgroup>s
  const grouped = useMemo(() => {
    const g: Record<string, NodeRow[]> = { stock: [], sector: [], subsector: [], subsubsector: [] };
    for (const n of nodes) if (g[n.node_type]) g[n.node_type].push(n);
    return g;
  }, [nodes]);

  const displayed = useMemo(() => {
    const q = search.trim().toUpperCase();
    return connections.filter((c) => {
      if (tierFilter !== null && c.tier !== tierFilter) return false;
      if (q && !c.ticker_a.toUpperCase().includes(q) && !c.ticker_b.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [connections, tierFilter, search]);

  const tierCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const conn of connections) { if (c[conn.tier] !== undefined) c[conn.tier]++; }
    return c;
  }, [connections]);

  async function add() {
    setErr(null);
    if (!nodeA || !nodeB) { setErr("Both nodes are required."); return; }
    if (nodeA === nodeB)  { setErr("Cannot connect a node to itself."); return; }
    const r = await adminFetch("/api/admin/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker_a: nodeA, ticker_b: nodeB, tier: selectedTier }),
    });
    if (!r.ok) { setErr((await r.json()).error); return; }
    setNodeA(""); setNodeB(""); setTierOverride(null);
    load();
  }

  async function del(id: string) {
    if (!confirm("Remove this connection?")) return;
    await adminFetch(`/api/admin/connections/${id}`, { method: "DELETE" });
    load();
  }

  const NodeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={INPUT}>
      <option value="">— select node —</option>
      {NODE_TYPE_ORDER.map((type) =>
        grouped[type]?.length ? (
          <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + "s"}>
            {grouped[type].map((n) => (
              <option key={n.id} value={nodeId(n)}>{nodeLabel(n)}</option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  );

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Connections</h1>

      {/* Add form */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>
          Add connection
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Node A</div>
            <NodeSelect value={nodeA} onChange={setNodeA} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Node B</div>
            <NodeSelect value={nodeB} onChange={setNodeB} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>
              Tier
              {nodeA && nodeB && (
                <span style={{ color: "#334155", marginLeft: 6 }}>(auto: T{autoTier})</span>
              )}
            </div>
            <select
              value={selectedTier}
              onChange={(e) => setTierOverride(Number(e.target.value))}
              style={INPUT}
            >
              {[1, 2, 3].map((t) => (
                <option key={t} value={t}>T{t} — {TIER_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <button style={{ ...BTN, alignSelf: "flex-end" }} onClick={add}>Add</button>
        </div>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Filter bar + table */}
      <div style={CARD}>
        {/* Search + tier filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...INPUT, width: 180, fontSize: 12, padding: "5px 10px" }}
            placeholder="Search ticker…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {([null, 1, 2, 3] as const).map((t) => {
            const count = t === null ? connections.length : tierCounts[t];
            const active = tierFilter === t;
            return (
              <button
                key={String(t)}
                onClick={() => setTierFilter(t)}
                style={{
                  background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                  border: active ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 6, color: active ? "#3b82f6" : "#64748b",
                  fontSize: 12, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t === null ? "All" : `T${t}`} ({count})
              </button>
            );
          })}
          {(search || tierFilter !== null) && (
            <span style={{ fontSize: 11, color: "#334155" }}>
              Showing {displayed.length} of {connections.length}
            </span>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Tier", "Node A", "Node B", ""].map((h) => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr><td colSpan={4} style={{ ...TD, color: "#334155" }}>No connections.</td></tr>
            )}
            {displayed.map((c) => (
              <tr key={c.id}>
                <td style={{ ...TD, width: 56 }}><TierBadge tier={c.tier} /></td>
                <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.ticker_a}</code></td>
                <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.ticker_b}</code></td>
                <td style={TD}><button style={BTN_D} onClick={() => del(c.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
