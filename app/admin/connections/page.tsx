"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect, useMemo } from "react";

const CARD:  React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN:   React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH:   React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left", whiteSpace: "nowrap" };
const TD:   React.CSSProperties = { padding: "10px 16px 10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0", verticalAlign: "middle" };

// Mirrors GraphCanvas SECTOR_MAP — sector text field → ETF ticker node ID
const SECTOR_ETF: Record<string, string> = {
  Technology:              "XLK",
  Energy:                  "XLE",
  Healthcare:              "XLV",
  Finance:                 "XLF",
  "Financial Services":    "XLF",
  "Consumer Staples":      "XLP",
  "Consumer Discretionary":"XLY",
  Industrials:             "XLI",
  "Communication Services":"XLC",
  Materials:               "XLB",
  "Real Estate":           "XLRE",
  Utilities:               "XLU",
};

const ALL_SECTORS = [
  "Technology", "Energy", "Healthcare", "Finance", "Financial Services",
  "Consumer Staples", "Consumer Discretionary", "Industrials", "Communication Services",
  "Materials", "Real Estate", "Utilities",
];

interface ExplicitConn { kind: "explicit"; id: string; ticker_a: string; ticker_b: string; tier: number; }
interface AutoConn     { kind: "auto"; ticker: string; sector: string; sectorEtf: string; }
type AnyConn = ExplicitConn | AutoConn;

interface NodeRow {
  id: string; node_type: string;
  ticker: string | null; company_name: string | null; etf_ticker: string | null;
  sector: string | null;
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
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${col}20`, border: `1px solid ${col}40`, color: col, letterSpacing: "0.05em" }}>
      T{tier}
    </span>
  );
}

function AutoBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#a855f7", letterSpacing: "0.05em" }}>
      Auto
    </span>
  );
}

function nodeId(n: NodeRow): string {
  if (n.node_type === "stock")  return n.ticker ?? "";
  if (n.node_type === "sector") return n.etf_ticker ?? n.company_name ?? "";
  return n.company_name ?? "";
}

function nodeLabel(n: NodeRow): string {
  const id   = nodeId(n);
  const name = n.company_name ?? n.etf_ticker ?? "";
  return id === name ? id : `${id} — ${name}`;
}

function inferTier(idA: string, idB: string, nodes: NodeRow[]): number {
  const findType = (id: string) => nodes.find((n) => nodeId(n) === id)?.node_type ?? null;
  const types = [findType(idA), findType(idB)];
  if (types.includes("subsubsector")) return 1;
  if (types.includes("subsector"))    return 2;
  if (types.includes("sector"))       return 3;
  return 2;
}

export default function ConnectionsPage() {
  const [explicit, setExplicit]       = useState<{ id: string; ticker_a: string; ticker_b: string; tier: number }[]>([]);
  const [nodes, setNodes]             = useState<NodeRow[]>([]);
  const [nodeA, setNodeA]             = useState("");
  const [nodeB, setNodeB]             = useState("");
  const [tierFilter, setTierFilter]   = useState<string>("all"); // "all" | "auto" | "1" | "2" | "3"
  const [search, setSearch]           = useState("");
  const [err, setErr]                 = useState<string | null>(null);
  const [changingSector, setChangingSector] = useState<Record<string, boolean>>({});

  const autoTier = useMemo(
    () => (nodeA && nodeB ? inferTier(nodeA, nodeB, nodes) : 2),
    [nodeA, nodeB, nodes],
  );
  const [tierOverride, setTierOverride] = useState<number | null>(null);
  const selectedTier = tierOverride ?? autoTier;
  useEffect(() => { setTierOverride(null); }, [autoTier]);

  async function load() {
    const [cRes, nRes] = await Promise.all([
      adminFetch("/api/admin/connections"),
      adminFetch("/api/admin/stocks"),
    ]);
    if (cRes.ok) setExplicit(await cRes.json());
    if (nRes.ok) setNodes(await nRes.json());
  }
  useEffect(() => { load(); }, []);

  // Derive automatic sector connections from stock nodes' sector field
  const autoConnections: AutoConn[] = useMemo(() =>
    nodes
      .filter((n) => n.node_type === "stock" && n.ticker && n.sector && SECTOR_ETF[n.sector])
      .map((n) => ({
        kind:      "auto" as const,
        ticker:    n.ticker!,
        sector:    n.sector!,
        sectorEtf: SECTOR_ETF[n.sector!],
      }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker)),
  [nodes]);

  const explicitConns: ExplicitConn[] = explicit.map((c) => ({ kind: "explicit", ...c }));

  // Merge + filter
  const allConns: AnyConn[] = [...explicitConns, ...autoConnections];

  const displayed = useMemo(() => {
    const q = search.trim().toUpperCase();
    return allConns.filter((c) => {
      if (c.kind === "auto") {
        if (tierFilter !== "all" && tierFilter !== "auto") return false;
        if (q && !c.ticker.includes(q) && !c.sectorEtf.includes(q) && !c.sector.toUpperCase().includes(q)) return false;
      } else {
        if (tierFilter === "auto") return false;
        if (tierFilter !== "all" && c.tier !== Number(tierFilter)) return false;
        if (q && !c.ticker_a.toUpperCase().includes(q) && !c.ticker_b.toUpperCase().includes(q)) return false;
      }
      return true;
    });
  }, [allConns, tierFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => ({
    all:  allConns.length,
    auto: autoConnections.length,
    1:    explicitConns.filter((c) => c.tier === 1).length,
    2:    explicitConns.filter((c) => c.tier === 2).length,
    3:    explicitConns.filter((c) => c.tier === 3).length,
  }), [allConns, autoConnections, explicitConns]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    setErr(null);
    if (!nodeA || !nodeB) { setErr("Both nodes are required."); return; }
    if (nodeA === nodeB)  { setErr("Cannot connect a node to itself."); return; }
    const r = await adminFetch("/api/admin/connections", {
      method: "POST", headers: { "Content-Type": "application/json" },
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

  async function changeSector(ticker: string, newSector: string) {
    setChangingSector((m) => ({ ...m, [ticker]: true }));
    await adminFetch(`/api/admin/stocks/${ticker}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector: newSector }),
    });
    setChangingSector((m) => ({ ...m, [ticker]: false }));
    load();
  }

  const grouped = useMemo(() => {
    const g: Record<string, NodeRow[]> = { stock: [], sector: [], subsector: [], subsubsector: [] };
    for (const n of nodes) if (g[n.node_type]) g[n.node_type].push(n);
    return g;
  }, [nodes]);

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

  const FILTER_TABS = [
    { key: "all",  label: "All" },
    { key: "auto", label: "Auto (sector)" },
    { key: "1",    label: "T1" },
    { key: "2",    label: "T2" },
    { key: "3",    label: "T3" },
  ] as const;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Connections</h1>

      {/* Add form */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add explicit connection</div>
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
              Tier{nodeA && nodeB && <span style={{ color: "#334155", marginLeft: 6 }}>(auto: T{autoTier})</span>}
            </div>
            <select value={selectedTier} onChange={(e) => setTierOverride(Number(e.target.value))} style={INPUT}>
              {[1, 2, 3].map((t) => (<option key={t} value={t}>T{t} — {TIER_LABELS[t]}</option>))}
            </select>
          </div>
          <button style={{ ...BTN, alignSelf: "flex-end" }} onClick={add}>Add</button>
        </div>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Table */}
      <div style={CARD}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...INPUT, width: 180, fontSize: 12, padding: "5px 10px" }}
            placeholder="Search ticker…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {FILTER_TABS.map(({ key, label }) => {
            const count = key === "all" ? counts.all : key === "auto" ? counts.auto : counts[Number(key) as 1|2|3];
            const active = tierFilter === key;
            return (
              <button key={key} onClick={() => setTierFilter(key)} style={{
                background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                border: active ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 6, color: active ? "#3b82f6" : "#64748b",
                fontSize: 12, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
              }}>
                {label} ({count})
              </button>
            );
          })}
          {(search || tierFilter !== "all") && (
            <span style={{ fontSize: 11, color: "#334155" }}>Showing {displayed.length} of {allConns.length}</span>
          )}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Type", "Node A", "Node B / Sector", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr><td colSpan={4} style={{ ...TD, color: "#334155" }}>No connections match.</td></tr>
            )}
            {displayed.map((c) => {
              if (c.kind === "auto") {
                return (
                  <tr key={`auto-${c.ticker}`}>
                    <td style={{ ...TD, width: 56 }}><AutoBadge /></td>
                    <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.ticker}</code></td>
                    <td style={TD}>
                      <select
                        value={c.sector}
                        onChange={(e) => changeSector(c.ticker, e.target.value)}
                        disabled={changingSector[c.ticker]}
                        style={{ ...INPUT, width: 220, fontSize: 12, padding: "4px 8px", color: c.sectorEtf ? "#94a3b8" : "#ef4444" }}
                      >
                        {ALL_SECTORS.map((s) => (
                          <option key={s} value={s}>{s} ({SECTOR_ETF[s] ?? "?"})</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...TD, color: "#334155", fontSize: 11 }}>
                      {changingSector[c.ticker] ? "Saving…" : "Change sector to move this stock"}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={c.id}>
                  <td style={{ ...TD, width: 56 }}><TierBadge tier={c.tier} /></td>
                  <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.ticker_a}</code></td>
                  <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.ticker_b}</code></td>
                  <td style={TD}><button style={BTN_D} onClick={() => del(c.id)}>Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: 16, fontSize: 11, color: "#334155", lineHeight: 1.6 }}>
          <strong style={{ color: "#475569" }}>Auto</strong> — derived from each stock&apos;s sector field. Change the dropdown to reassign a stock to a different sector ring on the graph.
          <br />
          <strong style={{ color: "#475569" }}>T1/T2/T3</strong> — explicit connections stored in admin_connections (sub-sector memberships, peer relationships, etc.).
        </div>
      </div>
    </div>
  );
}
