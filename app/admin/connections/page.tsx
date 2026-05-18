"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect, useMemo, useRef } from "react";

const CARD:  React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN:   React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH:   React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left", whiteSpace: "nowrap" };
const TD:   React.CSSProperties = { padding: "10px 16px 10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0", verticalAlign: "middle" };

// Mirrors GraphCanvas SECTOR_MAP — sector text field → ETF ticker node ID
const SECTOR_ETF: Record<string, string> = {
  "Information Technology": "XLK",
  Technology:              "XLK",
  Energy:                  "XLE",
  Healthcare:              "XLV",
  Financials:              "XLF",
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
  "Information Technology", "Energy", "Healthcare", "Financials",
  "Consumer Staples", "Consumer Discretionary", "Industrials", "Communication Services",
  "Materials", "Real Estate", "Utilities",
];

interface ExplicitConn { kind: "explicit"; id: string; ticker_a: string; ticker_b: string; tier: number; }
interface AutoConn     { kind: "auto"; ticker: string; sector: string; sectorEtf: string | null; }
type AnyConn = ExplicitConn | AutoConn;

interface Suggestion { id: string; reason: string; nodeType: string; }
interface MissingSuggestion { ticker: string; name: string; reason: string; tier: 1|2|3; }
interface SuggestResult { t1: Suggestion[]; t2: Suggestion[]; t3: Suggestion[]; missing: MissingSuggestion[]; }

interface NodeRow {
  id: string; node_type: string;
  ticker: string | null; company_name: string | null; etf_ticker: string | null;
  sector: string | null;
}

const TIER_COLORS: Record<number, string> = { 1: "#6366f1", 2: "#64748b", 3: "#f59e0b" };
const TIER_NAMES:  Record<number, string> = { 1: "Exposure", 2: "Peer", 3: "Impact" };
const TIER_LABELS: Record<number, string> = {
  1: "Exposure — stock belongs to this industry / sub-sector",
  2: "Peer — direct competitor or close peer stock",
  3: "Impact — indirect supply chain, macro theme or cross-sector",
};
const NODE_TYPE_ORDER = ["stock", "sector", "subsector", "subsubsector"];

function TierBadge({ tier }: { tier: number }) {
  const col = TIER_COLORS[tier] ?? "#475569";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${col}20`, border: `1px solid ${col}40`, color: col, letterSpacing: "0.05em" }}>
      {TIER_NAMES[tier] ?? `T${tier}`}
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

function SuggestionRow({ s, selected, onToggle, effectiveTier, onTierChange }: {
  s: Suggestion;
  selected: boolean;
  onToggle: () => void;
  effectiveTier: 1|2|3;
  onTierChange: (t: 1|2|3) => void;
}) {
  const typeColor = TYPE_COLOR[s.nodeType] ?? "#64748b";
  const typeLabel = TYPE_LABEL[s.nodeType] ?? s.nodeType;
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
        background: selected ? "rgba(59,130,246,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)"}`,
        borderRadius: 6, cursor: "pointer", marginBottom: 4,
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        background: selected ? "#3b82f6" : "transparent",
        border: `1.5px solid ${selected ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: typeColor, minWidth: 70, flexShrink: 0 }}>
        {typeLabel}
      </span>
      <code style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", flexShrink: 0 }}>{s.id}</code>
      <span style={{ fontSize: 12, color: "#475569", flex: 1 }}>{s.reason}</span>
      {/* Inline tier override — click stops row toggle */}
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {([1, 2, 3] as const).map((t) => {
          const active = effectiveTier === t;
          const col = TIER_COLORS[t];
          return (
            <button
              key={t}
              onClick={() => onTierChange(t)}
              title={`Set to T${t}`}
              style={{
                fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3,
                cursor: "pointer", fontFamily: "inherit",
                background: active ? `${col}25` : "transparent",
                border:     active ? `1px solid ${col}60` : "1px solid rgba(255,255,255,0.06)",
                color:      active ? col : "#334155",
              }}
            >T{t}</button>
          );
        })}
      </div>
    </div>
  );
}

function nodeId(n: NodeRow): string {
  if (n.node_type === "stock")  return n.ticker ?? "";
  if (n.node_type === "sector") return n.etf_ticker ?? n.company_name ?? "";
  return n.company_name ?? "";
}


function inferTier(idA: string, idB: string, nodes: NodeRow[]): number {
  const findType = (id: string) => nodes.find((n) => nodeId(n) === id)?.node_type ?? null;
  const types = [findType(idA), findType(idB)];
  if (types.includes("subsubsector")) return 1;
  if (types.includes("subsector"))    return 2;
  if (types.includes("sector"))       return 3;
  return 2;
}

const TYPE_LABEL: Record<string, string> = {
  stock: "Stocks", sector: "Sectors",
  subsector: "Sub-sectors", subsubsector: "Industries",
};
const TYPE_COLOR: Record<string, string> = {
  stock: "#94a3b8", sector: "#3b82f6", subsector: "#8b5cf6", subsubsector: "#6366f1",
};

function NodeCombobox({ value, onChange, nodes, grouped }: {
  value: string;
  onChange: (v: string) => void;
  nodes: NodeRow[];
  grouped: Record<string, NodeRow[]>;
}) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState("");
  const rootRef           = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const selected = nodes.find((n) => nodeId(n) === value) ?? null;
  const q        = query.toLowerCase();
  const matches  = (n: NodeRow) =>
    !q ||
    nodeId(n).toLowerCase().includes(q) ||
    (n.company_name?.toLowerCase() ?? "").includes(q) ||
    (n.etf_ticker?.toLowerCase()   ?? "").includes(q);
  const anyMatch = NODE_TYPE_ORDER.some((t) => (grouped[t] ?? []).some(matches));

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          ...INPUT, display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none",
          borderColor: open ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.1)",
        }}
      >
        {selected ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <code style={{ color: TYPE_COLOR[selected.node_type] ?? "#94a3b8", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {nodeId(selected)}
            </code>
            {selected.company_name && nodeId(selected) !== selected.company_name && (
              <span style={{ color: "#475569", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.company_name}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: "#334155", fontSize: 12 }}>— select node —</span>
        )}
        <span style={{ color: "#334155", fontSize: 9, flexShrink: 0, marginLeft: 6 }}>{open ? "▴" : "▾"}</span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
          background: "#0d1117", border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8, boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          display: "flex", flexDirection: "column", maxHeight: 340,
        }}>
          <div style={{ padding: "8px 8px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
              placeholder="Search by ticker or name…"
              style={{ ...INPUT, fontSize: 12, padding: "5px 9px" }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "4px 0" }}>
            {value && (
              <div
                onClick={() => { onChange(""); setOpen(false); setQuery(""); }}
                style={{ padding: "6px 12px", color: "#475569", fontSize: 11, cursor: "pointer", fontStyle: "italic" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
              >Clear selection</div>
            )}
            {!anyMatch && (
              <div style={{ padding: "14px 12px", color: "#334155", fontSize: 12, textAlign: "center" }}>
                No nodes match &ldquo;{query}&rdquo;
              </div>
            )}
            {NODE_TYPE_ORDER.map((type) => {
              const rows = (grouped[type] ?? []).filter(matches);
              if (!rows.length) return null;
              return (
                <div key={type}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#334155", padding: "10px 12px 4px" }}>
                    {TYPE_LABEL[type] ?? type}
                  </div>
                  {rows.map((n) => {
                    const id     = nodeId(n);
                    const name   = n.company_name ?? n.etf_ticker ?? "";
                    const active = id === value;
                    return (
                      <div
                        key={n.id}
                        onClick={() => { onChange(id); setOpen(false); setQuery(""); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer", background: active ? "rgba(59,130,246,0.1)" : "transparent" }}
                        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
                      >
                        <code style={{ fontSize: 12, fontWeight: 600, flexShrink: 0, minWidth: 44, color: active ? "#3b82f6" : (TYPE_COLOR[type] ?? "#94a3b8") }}>
                          {id}
                        </code>
                        {id !== name && name && (
                          <span style={{ fontSize: 12, color: active ? "#94a3b8" : "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {name}
                          </span>
                        )}
                        {active && <span style={{ marginLeft: "auto", color: "#3b82f6", fontSize: 11 }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  const [explicit, setExplicit]       = useState<{ id: string; ticker_a: string; ticker_b: string; tier: number }[]>([]);
  const [nodes, setNodes]             = useState<NodeRow[]>([]);
  const [nodeA, setNodeA]             = useState("");
  const [nodeB, setNodeB]             = useState("");
  const [tierFilter, setTierFilter]   = useState<string>("all"); // "all" | "auto" | "1" | "2" | "3"
  const [search, setSearch]           = useState("");
  const [err, setErr]                 = useState<string | null>(null);
  const [changingSector, setChangingSector]   = useState<Record<string, boolean>>({});
  const [suggestTicker, setSuggestTicker]     = useState("");
  const [suggesting, setSuggesting]           = useState(false);
  const [suggestResult, setSuggestResult]     = useState<SuggestResult | null>(null);
  const [suggestSelected, setSuggestSelected] = useState<Set<string>>(new Set());
  const [tierOverrides, setTierOverrides]     = useState<Record<string, 1|2|3>>({});
  const [applying, setApplying]               = useState(false);
  const [suggestErr, setSuggestErr]           = useState<string | null>(null);

  // Bulk AI connections state
  const [bulkConnText, setBulkConnText]       = useState("");
  const [bulkConnRunning, setBulkConnRunning] = useState(false);
  const [bulkConnProgress, setBulkConnProgress] = useState<{ current: number; total: number; ticker: string; added: number } | null>(null);
  const [bulkConnDone, setBulkConnDone]       = useState<{ ticker: string; added: number }[]>([]);
  const [bulkUseHaiku, setBulkUseHaiku]       = useState(false);

  // Connection review state
  const [reviewTicker, setReviewTicker]   = useState("");
  const [reviewConns, setReviewConns]     = useState<{ id: string; tier: number; other: string; otherType: string; reason: string | null }[] | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Review queue state (feeds tickers into the suggestion panel one by one)
  const [reviewQueue, setReviewQueue]         = useState<string[]>([]);
  const [reviewQueueIdx, setReviewQueueIdx]   = useState(0);

  const autoTier = useMemo(
    () => (nodeA && nodeB ? inferTier(nodeA, nodeB, nodes) : 2),
    [nodeA, nodeB, nodes],
  );
  const [tierOverride, setTierOverride] = useState<number | null>(null);
  const [tierLocked, setTierLocked]     = useState(false);
  const selectedTier = tierOverride ?? autoTier;
  // Only auto-reset the tier when nodes change if no lock is active
  useEffect(() => { if (!tierLocked) setTierOverride(null); }, [autoTier, tierLocked]);

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
      .filter((n) => n.node_type === "stock" && n.ticker && n.sector)
      .map((n) => ({
        kind:      "auto" as const,
        ticker:    n.ticker!,
        sector:    n.sector!,
        sectorEtf: SECTOR_ETF[n.sector!] ?? null, // null = unrecognised sector
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
        if (q && !c.ticker.includes(q) && !(c.sectorEtf?.includes(q)) && !c.sector.toUpperCase().includes(q)) return false;
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
    // Keep tier lock active so the next connection can be added at the same tier quickly
    setNodeA(""); setNodeB("");
    if (!tierLocked) setTierOverride(null);
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

  function toggleSuggestion(id: string) {
    setSuggestSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function getSuggestions() {
    if (!suggestTicker) return;
    setSuggesting(true);
    setSuggestResult(null);
    setSuggestErr(null);
    try {
      const r = await adminFetch("/api/admin/suggest-connections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: suggestTicker }),
      });
      const data = await r.json();
      if (!r.ok) { setSuggestErr(data.error ?? "Failed to get suggestions"); return; }
      setSuggestResult(data as SuggestResult);
      setTierOverrides({});
      const all = [...(data.t1 ?? []), ...(data.t2 ?? []), ...(data.t3 ?? [])];
      setSuggestSelected(new Set(all.map((s: Suggestion) => s.id)));
    } catch { setSuggestErr("Network error"); }
    finally { setSuggesting(false); }
  }

  async function applySelected() {
    if (!suggestResult || !suggestTicker) return;
    setApplying(true);
    const items = [
      ...suggestResult.t1.filter((s) => suggestSelected.has(s.id)).map((s) => ({ id: s.id, tier: (tierOverrides[s.id] ?? 1) as 1|2|3, reason: s.reason })),
      ...suggestResult.t2.filter((s) => suggestSelected.has(s.id)).map((s) => ({ id: s.id, tier: (tierOverrides[s.id] ?? 2) as 1|2|3, reason: s.reason })),
      ...suggestResult.t3.filter((s) => suggestSelected.has(s.id)).map((s) => ({ id: s.id, tier: (tierOverrides[s.id] ?? 3) as 1|2|3, reason: s.reason })),
    ];
    await Promise.all(items.map((item) =>
      adminFetch("/api/admin/connections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker_a: suggestTicker, ticker_b: item.id, tier: item.tier, reason: item.reason }),
      })
    ));
    setSuggestResult(null);
    setSuggestSelected(new Set());
    setTierOverrides({});
    setApplying(false);
    load();

    // Advance review queue if active
    if (reviewQueue.length > 0) {
      const nextIdx = reviewQueueIdx + 1;
      if (nextIdx < reviewQueue.length) {
        setReviewQueueIdx(nextIdx);
        loadSuggestionsForTicker(reviewQueue[nextIdx]);
      } else {
        setReviewQueue([]);
        setReviewQueueIdx(0);
      }
    }
  }

  async function loadSuggestionsForTicker(ticker: string) {
    setSuggestTicker(ticker);
    setSuggesting(true);
    setSuggestResult(null);
    setSuggestErr(null);
    try {
      const r = await adminFetch("/api/admin/suggest-connections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await r.json();
      if (!r.ok) { setSuggestErr(data.error ?? "Failed"); return; }
      setSuggestResult(data as SuggestResult);
      setTierOverrides({});
      const all = [...(data.t1 ?? []), ...(data.t2 ?? []), ...(data.t3 ?? [])];
      setSuggestSelected(new Set(all.map((s: Suggestion) => s.id)));
    } catch { setSuggestErr("Network error"); }
    finally { setSuggesting(false); }
  }

  function startReviewQueue() {
    const tickers = bulkConnText
      .split(/[\n,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (!tickers.length) return;
    setReviewQueue(tickers);
    setReviewQueueIdx(0);
    setBulkConnText("");
    loadSuggestionsForTicker(tickers[0]);
    // Scroll suggestion panel into view
    document.getElementById("suggestion-panel")?.scrollIntoView({ behavior: "smooth" });
  }

  // Add missing nodes via Polygon lookup then connect them at their suggested tier
  async function addMissingAndConnect(
    sourceTicker: string,
    missing: MissingSuggestion[],
  ): Promise<number> {
    if (!missing.length) return 0;
    const importR = await adminFetch("/api/admin/bulk-import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: missing.map((m) => m.ticker) }),
    });
    if (!importR.ok) return 0;
    // Connect each newly added stock at its suggested tier
    const connResults = await Promise.all(
      missing.map((m) =>
        adminFetch("/api/admin/connections", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker_a: sourceTicker, ticker_b: m.ticker, tier: m.tier }),
        })
      )
    );
    return connResults.filter((r) => r.ok).length;
  }

  async function runBulkConnections() {
    const tickers = bulkConnText
      .split(/[\n,\s]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (!tickers.length) return;
    setBulkConnRunning(true);
    setBulkConnDone([]);
    setBulkConnProgress(null);

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      setBulkConnProgress({ current: i + 1, total: tickers.length, ticker, added: 0 });
      try {
        const r = await adminFetch("/api/admin/suggest-connections", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker, useHaiku: bulkUseHaiku }),
        });
        if (!r.ok) { setBulkConnDone((p) => [...p, { ticker, added: 0 }]); continue; }
        const data = await r.json() as SuggestResult;
        const items = [
          ...(data.t1 ?? []).map((s) => ({ id: s.id, tier: 1, reason: s.reason })),
          ...(data.t2 ?? []).map((s) => ({ id: s.id, tier: 2, reason: s.reason })),
          ...(data.t3 ?? []).map((s) => ({ id: s.id, tier: 3, reason: s.reason })),
        ];
        await Promise.all(items.map((item) =>
          adminFetch("/api/admin/connections", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ticker_a: ticker, ticker_b: item.id, tier: item.tier, reason: item.reason }),
          })
        ));
        const missingAdded = await addMissingAndConnect(ticker, data.missing ?? []);
        setBulkConnDone((p) => [...p, { ticker, added: items.length + missingAdded }]);
      } catch {
        setBulkConnDone((p) => [...p, { ticker, added: 0 }]);
      }
    }
    setBulkConnProgress(null);
    setBulkConnRunning(false);
    setBulkConnText("");
    load();
  }

  const grouped = useMemo(() => {
    const g: Record<string, NodeRow[]> = { stock: [], sector: [], subsector: [], subsubsector: [] };
    for (const n of nodes) if (g[n.node_type]) g[n.node_type].push(n);
    return g;
  }, [nodes]);


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
            <NodeCombobox value={nodeA} onChange={setNodeA} nodes={nodes} grouped={grouped} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Node B</div>
            <NodeCombobox value={nodeB} onChange={setNodeB} nodes={nodes} grouped={grouped} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Tier{nodeA && nodeB && !tierLocked && <span style={{ color: "#334155", marginLeft: 5 }}>(auto: T{autoTier})</span>}</span>
              <div style={{ display: "flex", gap: 3 }}>
                {[1, 2, 3].map((t) => {
                  const active = tierLocked && tierOverride === t;
                  return (
                    <button
                      key={t}
                      title={active ? `Unlock T${t}` : `Lock tier to T${t}`}
                      onClick={() => {
                        if (active) { setTierLocked(false); setTierOverride(null); }
                        else        { setTierLocked(true);  setTierOverride(t); }
                      }}
                      style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                        cursor: "pointer", fontFamily: "inherit",
                        background: active ? "rgba(245,158,11,0.15)" : "transparent",
                        border:     active ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        color:      active ? "#f59e0b" : "#475569",
                      }}
                    >
                      T{t}
                    </button>
                  );
                })}
              </div>
            </div>
            <select
              value={selectedTier}
              onChange={(e) => { setTierLocked(false); setTierOverride(Number(e.target.value)); }}
              style={{ ...INPUT, borderColor: tierLocked ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.1)" }}
            >
              {[1, 2, 3].map((t) => (<option key={t} value={t}>T{t} — {TIER_LABELS[t]}</option>))}
            </select>
          </div>
          <button style={{ ...BTN, alignSelf: "flex-end" }} onClick={add}>Add</button>
        </div>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Bulk AI connections */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          Bulk AI connections
          <span style={{ fontSize: 10, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", padding: "2px 7px", borderRadius: 10, letterSpacing: 0, textTransform: "none" }}>Claude</span>
        </div>
        <div style={{ fontSize: 11, color: "#334155", marginBottom: 10 }}>
          Paste tickers — Claude processes each one and auto-applies all T1/T2/T3 suggestions.
        </div>
        <textarea
          style={{ ...INPUT, height: 80, resize: "vertical", fontFamily: "monospace", fontSize: 12, marginBottom: 10 }}
          placeholder={"AAPL, MSFT, NVDA\nGOOGL, META"}
          value={bulkConnText}
          onChange={(e) => { setBulkConnText(e.target.value); setBulkConnDone([]); }}
          disabled={bulkConnRunning}
        />
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Model toggle */}
          <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 2 }}>
            {([false, true] as const).map((isHaiku) => (
              <button key={String(isHaiku)} onClick={() => setBulkUseHaiku(isHaiku)}
                style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "inherit", border: "none",
                  background: bulkUseHaiku === isHaiku ? (isHaiku ? "rgba(34,197,94,0.2)" : "rgba(168,85,247,0.2)") : "transparent",
                  color: bulkUseHaiku === isHaiku ? (isHaiku ? "#22c55e" : "#a855f7") : "#475569",
                }}>
                {isHaiku ? "Haiku (~$0.006)" : "Sonnet (~$0.022)"}
              </button>
            ))}
          </div>
          <button
            style={{ ...BTN, opacity: !bulkConnText.trim() || bulkConnRunning ? 0.55 : 1 }}
            onClick={runBulkConnections}
            disabled={!bulkConnText.trim() || bulkConnRunning}
          >
            {bulkConnRunning ? "Processing…" : "Auto-apply all"}
          </button>
          <button
            style={{ ...BTN, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.35)", color: "#a855f7", opacity: !bulkConnText.trim() || bulkConnRunning ? 0.55 : 1 }}
            onClick={startReviewQueue}
            disabled={!bulkConnText.trim() || bulkConnRunning}
          >
            Review one by one
          </button>
          {bulkConnProgress && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              <span style={{ color: "#a855f7", fontWeight: 600 }}>{bulkConnProgress.ticker}</span>
              {" "}({bulkConnProgress.current}/{bulkConnProgress.total})
            </span>
          )}
          {!bulkConnRunning && bulkConnDone.length > 0 && (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Done — {bulkConnDone.reduce((s, r) => s + r.added, 0)} connections added across {bulkConnDone.length} stocks
            </span>
          )}
        </div>
        {bulkConnDone.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {bulkConnDone.map((r) => (
              <div key={r.ticker} style={{
                fontSize: 11, padding: "2px 9px", borderRadius: 20, fontFamily: "monospace",
                background: r.added > 0 ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${r.added > 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
                color: r.added > 0 ? "#22c55e" : "#ef4444",
              }}>
                {r.ticker} {r.added > 0 ? `+${r.added}` : "✗"}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Connection Suggestions */}
      <div id="suggestion-panel" style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          AI Connection Suggestions
          <span style={{ fontSize: 10, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7", padding: "2px 7px", borderRadius: 10, letterSpacing: 0, textTransform: "none" }}>
            Claude
          </span>
          {reviewQueue.length > 0 && (
            <span style={{ fontSize: 10, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", padding: "2px 8px", borderRadius: 10, letterSpacing: 0, textTransform: "none" }}>
              Queue: {reviewQueueIdx + 1} / {reviewQueue.length}
            </span>
          )}
          {reviewQueue.length > 0 && (
            <button
              onClick={() => { setReviewQueue([]); setReviewQueueIdx(0); setSuggestResult(null); }}
              style={{ fontSize: 10, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#475569", padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", marginLeft: "auto", textTransform: "none", letterSpacing: 0 }}
            >
              Exit queue
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginBottom: suggestResult || suggestErr || suggesting ? 18 : 0 }}>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Stock to analyse</div>
            <NodeCombobox
              value={suggestTicker}
              onChange={(v) => { setSuggestTicker(v); setSuggestResult(null); setSuggestErr(null); }}
              nodes={grouped.stock ?? []}
              grouped={{ stock: grouped.stock ?? [], sector: [], subsector: [], subsubsector: [] }}
            />
          </div>
          <button
            style={{ ...BTN, background: "rgba(168,85,247,0.75)", opacity: !suggestTicker || suggesting ? 0.55 : 1 }}
            onClick={getSuggestions}
            disabled={!suggestTicker || suggesting}
          >
            {suggesting ? "Analysing…" : "Get Suggestions"}
          </button>
        </div>

        {suggestErr && (
          <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 12 }}>{suggestErr}</div>
        )}

        {suggesting && (
          <div style={{ fontSize: 12, color: "#475569" }}>Claude is analysing connections…</div>
        )}

        {suggestResult && (() => {
          const total = suggestResult.t1.length + suggestResult.t2.length + suggestResult.t3.length;
          if (total === 0) return (
            <div style={{ fontSize: 12, color: "#334155" }}>No new connection suggestions — this stock may already be well connected.</div>
          );
          return (
            <>
              {suggestResult.t1.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: TIER_COLORS[1], marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                    <TierBadge tier={1} />
                    <span>Exposure — industry &amp; sub-sector membership</span>
                  </div>
                  {suggestResult.t1.map((s) => (
                    <SuggestionRow key={s.id} s={s} selected={suggestSelected.has(s.id)} onToggle={() => toggleSuggestion(s.id)}
                      effectiveTier={(tierOverrides[s.id] ?? 1) as 1|2|3}
                      onTierChange={(t) => setTierOverrides((prev) => ({ ...prev, [s.id]: t }))} />
                  ))}
                </div>
              )}

              {suggestResult.t2.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: TIER_COLORS[2], marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                    <TierBadge tier={2} />
                    <span>Peer — direct competitors &amp; close peers</span>
                  </div>
                  {suggestResult.t2.map((s) => (
                    <SuggestionRow key={s.id} s={s} selected={suggestSelected.has(s.id)} onToggle={() => toggleSuggestion(s.id)}
                      effectiveTier={(tierOverrides[s.id] ?? 2) as 1|2|3}
                      onTierChange={(t) => setTierOverrides((prev) => ({ ...prev, [s.id]: t }))} />
                  ))}
                </div>
              )}

              {suggestResult.t3.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: TIER_COLORS[3], marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
                    <TierBadge tier={3} />
                    <span>Impact — supply chain &amp; cross-sector</span>
                  </div>
                  {suggestResult.t3.map((s) => (
                    <SuggestionRow key={s.id} s={s} selected={suggestSelected.has(s.id)} onToggle={() => toggleSuggestion(s.id)}
                      effectiveTier={(tierOverrides[s.id] ?? 3) as 1|2|3}
                      onTierChange={(t) => setTierOverrides((prev) => ({ ...prev, [s.id]: t }))} />
                  ))}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
                <button
                  style={{ ...BTN, opacity: suggestSelected.size === 0 || applying ? 0.55 : 1 }}
                  onClick={applySelected}
                  disabled={suggestSelected.size === 0 || applying}
                >
                  {applying ? "Applying…" : `Apply Selected (${suggestSelected.size})`}
                </button>
                <span style={{ fontSize: 11, color: "#334155" }}>{suggestSelected.size} of {total} selected</span>
                <button
                  onClick={() => {
                    if (suggestSelected.size === total) setSuggestSelected(new Set());
                    else setSuggestSelected(new Set([...suggestResult.t1, ...suggestResult.t2, ...suggestResult.t3].map((s) => s.id)));
                  }}
                  style={{ background: "none", border: "none", color: "#475569", fontSize: 11, cursor: "pointer", padding: 0 }}
                >
                  {suggestSelected.size === total ? "Deselect all" : "Select all"}
                </button>
              </div>

              {suggestResult.missing.length > 0 && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>⚠</span>
                    <span style={{ flex: 1 }}>Consider adding to graph</span>
                    <button
                      onClick={async () => {
                        if (!suggestResult) return;
                        await addMissingAndConnect(suggestTicker, suggestResult.missing);
                        load();
                        setSuggestResult({ ...suggestResult, missing: [] });
                      }}
                      style={{ fontSize: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 5, color: "#f59e0b", padding: "3px 10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                    >
                      Auto-add all + connect
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>
                    These companies aren&apos;t on the graph yet but would be important connections for {suggestTicker}.
                  </div>
                  {suggestResult.missing.map((m) => (
                    <div key={m.ticker} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                      background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.12)",
                      borderRadius: 6, marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: TIER_COLORS[m.tier] ?? "#64748b", minWidth: 20 }}>
                        T{m.tier}
                      </span>
                      <code style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", flexShrink: 0 }}>{m.ticker}</code>
                      <span style={{ fontSize: 12, color: "#94a3b8", flexShrink: 0 }}>{m.name}</span>
                      <span style={{ fontSize: 12, color: "#475569", flex: 1 }}>{m.reason}</span>
                      <button
                        onClick={async () => {
                          if (!suggestResult) return;
                          await addMissingAndConnect(suggestTicker, [m]);
                          load();
                          setSuggestResult({ ...suggestResult, missing: suggestResult.missing.filter((x) => x.ticker !== m.ticker) });
                        }}
                        style={{ fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {!suggestResult && !suggesting && !suggestErr && (
          <div style={{ fontSize: 12, color: "#334155" }}>
            Select a stock above then click &ldquo;Get Suggestions&rdquo; — Claude will suggest T1/T2/T3 connections based on nodes already in the graph.
            The auto sector connection (stock → GICS sector ring) is always applied separately via the stock&apos;s sector field.
          </div>
        )}
      </div>

      {/* Connection Review */}
      {(() => {
        const TIER_COL: Record<number, string> = { 1: "#6366f1", 2: "#64748b", 3: "#f59e0b" };
        const TIER_NM:  Record<number, string> = { 1: "Exposure", 2: "Peer", 3: "Impact" };
        const NODE_COL: Record<string, string> = { stock: "#94a3b8", sector: "#3b82f6", subsector: "#8b5cf6", subsubsector: "#6366f1" };
        const NODE_NM:  Record<string, string> = { stock: "Stock", sector: "Sector", subsector: "Sub-sector", subsubsector: "Industry" };

        async function loadReview(ticker: string) {
          if (!ticker) return;
          setReviewLoading(true);
          const [cRes, nRes] = await Promise.all([adminFetch("/api/admin/connections"), adminFetch("/api/admin/stocks")]);
          if (!cRes.ok || !nRes.ok) { setReviewLoading(false); return; }
          const allConns: { id: string; ticker_a: string; ticker_b: string; tier: number; reason?: string }[] = await cRes.json();
          const allNodes: { ticker?: string; company_name?: string; node_type: string }[] = await nRes.json();
          const upper = ticker.toUpperCase();
          const nodeTypeOf = (id: string) => allNodes.find((n) => n.ticker === id || n.company_name === id)?.node_type ?? "stock";
          setReviewConns(
            allConns
              .filter((c) => c.ticker_a === upper || c.ticker_b === upper)
              .map((c) => ({ id: c.id, tier: c.tier, other: c.ticker_a === upper ? c.ticker_b : c.ticker_a, otherType: nodeTypeOf(c.ticker_a === upper ? c.ticker_b : c.ticker_a), reason: c.reason ?? null }))
              .sort((a, b) => a.tier - b.tier || a.other.localeCompare(b.other))
          );
          setReviewLoading(false);
        }

        async function deleteReviewConn(id: string, other: string) {
          await adminFetch("/api/admin/connections", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker_a: reviewTicker, ticker_b: other }) });
          setReviewConns((prev) => prev?.filter((c) => c.id !== id) ?? null);
          load();
        }

        return (
          <div style={{ ...CARD, marginBottom: 28 }}>
            <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>Connection Review</div>
            <div style={{ display: "flex", gap: 10, marginBottom: reviewConns ? 16 : 0 }}>
              <input style={{ ...INPUT, width: 140, fontFamily: "monospace" }} placeholder="Ticker…"
                value={reviewTicker}
                onChange={(e) => { setReviewTicker(e.target.value.toUpperCase()); setReviewConns(null); }}
                onKeyDown={(e) => e.key === "Enter" && loadReview(reviewTicker)} />
              <button style={{ ...BTN, opacity: !reviewTicker || reviewLoading ? 0.55 : 1 }}
                onClick={() => loadReview(reviewTicker)} disabled={!reviewTicker || reviewLoading}>
                {reviewLoading ? "Loading…" : "Review"}
              </button>
              {reviewConns && (
                <span style={{ fontSize: 11, color: "#475569", alignSelf: "center" }}>
                  {reviewConns.length} total — {reviewConns.filter((c) => c.tier === 1).length} Exposure · {reviewConns.filter((c) => c.tier === 2).length} Peer · {reviewConns.filter((c) => c.tier === 3).length} Impact
                </span>
              )}
            </div>
            {reviewConns?.length === 0 && <div style={{ fontSize: 12, color: "#334155" }}>No connections for {reviewTicker}.</div>}
            {reviewConns && reviewConns.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
                {reviewConns.map((c) => {
                  const tc = TIER_COL[c.tier] ?? "#64748b";
                  const nc = NODE_COL[c.otherType] ?? "#64748b";
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: `${tc}20`, border: `1px solid ${tc}40`, color: tc, flexShrink: 0, marginTop: 1 }}>{TIER_NM[c.tier] ?? `T${c.tier}`}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <code style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{c.other}</code>
                          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: nc, background: `${nc}15`, border: `1px solid ${nc}30`, borderRadius: 10, padding: "1px 7px" }}>{NODE_NM[c.otherType] ?? c.otherType}</span>
                        </div>
                        {c.reason && <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>{c.reason}</div>}
                      </div>
                      <button onClick={() => deleteReviewConn(c.id, c.other)}
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 5, color: "#ef4444", fontSize: 11, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
                    <td style={{ ...TD, fontSize: 11, color: c.sectorEtf ? "#334155" : "#f59e0b" }}>
                      {changingSector[c.ticker]
                        ? "Saving…"
                        : c.sectorEtf
                          ? "Change sector to move this stock"
                          : `⚠ "${c.sector}" is not a recognised sector — reassign`}
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
