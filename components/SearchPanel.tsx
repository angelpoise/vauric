"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { moveColor } from "@/lib/graphTypes";
import { getCachedMarketData } from "@/lib/marketDataCache";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockEntry {
  kind: "stock";
  ticker: string;
  name: string;
  sector: string;
}

interface SectorEntry {
  kind: "sector";
  etf: string;
  name: string;
}

interface HierarchyEntry {
  kind: "subsector" | "subsubsector";
  id: string;
  name: string;
  etf: string | null;
}

type Entry = StockEntry | SectorEntry | HierarchyEntry;

// ─── Ranking ──────────────────────────────────────────────────────────────────

function rankEntry(entry: Entry, q: string): number {
  const lq = q.toLowerCase();
  const primary   = entry.kind === "stock"  ? entry.ticker
                  : entry.kind === "sector" ? entry.etf
                  : (entry.etf ?? "");
  const secondary = entry.name;
  if (primary.toLowerCase() === lq)           return 5;
  if (primary.toLowerCase().startsWith(lq))   return 4;
  if (secondary.toLowerCase() === lq)         return 3;
  if (secondary.toLowerCase().startsWith(lq)) return 2;
  if (secondary.toLowerCase().includes(lq))   return 1;
  return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchPanel({ onClose, onZoomToNode }: {
  onClose: () => void;
  onZoomToNode?: (nodeId: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery]           = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [entries, setEntries]       = useState<Entry[]>([]);
  const [mode, setMode]             = useState<"navigate" | "graph">("navigate");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  const marketData = getCachedMarketData();

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Load all graph nodes from the DB on mount
  useEffect(() => {
    fetch("/api/graph", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: {
        stocks: Array<{ ticker: string; company_name: string; sector: string }>;
        hierarchy: Array<{ node_type: string; company_name: string; display_name: string | null; etf_ticker: string | null }>;
      } | null) => {
        if (!data) return;
        const stocks: StockEntry[] = (data.stocks ?? []).map((s) => ({
          kind:   "stock" as const,
          ticker: s.ticker,
          name:   s.company_name ?? s.ticker,
          sector: s.sector ?? "",
        }));
        const hierarchy: (SectorEntry | HierarchyEntry)[] = (data.hierarchy ?? []).map((h) => {
          const label = h.display_name ?? h.company_name;
          if (h.node_type === "sector") {
            return { kind: "sector" as const, etf: h.etf_ticker ?? h.company_name, name: label };
          }
          return {
            kind: h.node_type as "subsector" | "subsubsector",
            id:   h.company_name,
            name: label,
            etf:  h.etf_ticker ?? null,
          };
        });
        setEntries([...stocks, ...hierarchy]);
      })
      .catch(() => {});
  }, []);

  const results = useMemo((): Entry[] => {
    const q = query.trim();
    if (!q) return [];
    const ranked = (es: Entry[]) =>
      es
        .map((e) => ({ e, rank: rankEntry(e, q) }))
        .filter((x) => x.rank > 0)
        .sort((a, b) => b.rank - a.rank)
        .map((x) => x.e);
    const stocks       = entries.filter((e): e is StockEntry      => e.kind === "stock");
    const sectors      = entries.filter((e): e is SectorEntry     => e.kind === "sector");
    const subsectors   = entries.filter((e): e is HierarchyEntry  => e.kind === "subsector");
    const subsubsectors= entries.filter((e): e is HierarchyEntry  => e.kind === "subsubsector");
    return [...ranked(stocks), ...ranked(sectors), ...ranked(subsectors), ...ranked(subsubsectors)];
  }, [query, entries]);

  useEffect(() => { setHighlighted(0); }, [results]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function getNodeId(entry: Entry): string {
    if (entry.kind === "stock")  return entry.ticker;
    if (entry.kind === "sector") return entry.etf;
    return entry.id;
  }

  function navigate(entry: Entry) {
    if (mode === "graph" && onZoomToNode) {
      onZoomToNode(getNodeId(entry));
      return;
    }
    if (entry.kind === "stock")             router.push(`/stock/${entry.ticker}`);
    else if (entry.kind === "sector")       router.push(`/sector/${entry.etf}`);
    else if (entry.kind === "subsector")    router.push(`/subsector/${encodeURIComponent(entry.id)}`);
    else if (entry.kind === "subsubsector") router.push(`/subsubsector/${encodeURIComponent(entry.id)}`);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Escape":   onClose(); break;
      case "ArrowDown": e.preventDefault(); setHighlighted((h) => Math.min(h + 1, results.length - 1)); break;
      case "ArrowUp":   e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); break;
      case "Enter":     if (results.length > 0) navigate(results[highlighted] ?? results[0]); break;
    }
  }

  const stockResults       = results.filter((r): r is StockEntry     => r.kind === "stock");
  const sectorResults      = results.filter((r): r is SectorEntry    => r.kind === "sector");
  const subsectorResults   = results.filter((r): r is HierarchyEntry => r.kind === "subsector");
  const subsubResults      = results.filter((r): r is HierarchyEntry => r.kind === "subsubsector");
  const hasQuery           = query.trim().length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, margin: "0 24px",
          background: "#0d1117",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* Input */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "16px 18px",
          borderBottom: hasQuery ? "1px solid rgba(255,255,255,0.07)" : "none",
        }}>
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4" stroke="#475569" strokeWidth="1.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search stocks, sectors, themes…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 16, color: "#f1f5f9", fontFamily: "inherit", fontWeight: 300,
            }}
          />
          {onZoomToNode && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {(["navigate", "graph"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  title={m === "navigate" ? "Go to detail page" : "Pan to node on graph"}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 5,
                    cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
                    background: mode === m ? "rgba(59,130,246,0.18)" : "transparent",
                    border:     mode === m ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.07)",
                    color:      mode === m ? "#3b82f6" : "#334155",
                  }}
                >
                  {m === "navigate" ? "→ Page" : "◎ Graph"}
                </button>
              ))}
            </div>
          )}
          <span style={{ fontSize: 11, color: "#1e293b", whiteSpace: "nowrap", flexShrink: 0 }}>ESC</span>
        </div>

        {/* Results */}
        {hasQuery && (
          <div ref={listRef} style={{ maxHeight: "55vh", overflowY: "auto", padding: "8px 0" }}>
            {results.length === 0 ? (
              <div style={{ padding: "20px 18px", fontSize: 13, color: "#334155", fontWeight: 300 }}>
                No results for &ldquo;{query.trim()}&rdquo;
              </div>
            ) : (
              <>
                {stockResults.length > 0 && (
                  <>
                    <SectionLabel>Stocks</SectionLabel>
                    {stockResults.map((entry) => {
                      const idx  = results.indexOf(entry);
                      const live = marketData?.[entry.ticker];
                      const move = live?.dailyMove ?? null;
                      return (
                        <ResultRow key={entry.ticker} idx={idx} highlighted={highlighted === idx}
                          onHover={() => setHighlighted(idx)} onClick={() => navigate(entry)}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 48 }}>{entry.ticker}</span>
                          <span style={{ flex: 1, fontSize: 13, color: "#475569", fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</span>
                          <span style={{ fontSize: 11, color: "#1e293b", flexShrink: 0 }}>{entry.sector}</span>
                          {move != null && <MoveTag move={move} />}
                        </ResultRow>
                      );
                    })}
                  </>
                )}

                {sectorResults.length > 0 && (
                  <>
                    <SectionLabel topGap={stockResults.length > 0}>Sectors</SectionLabel>
                    {sectorResults.map((entry) => {
                      const idx  = results.indexOf(entry);
                      const live = marketData?.[entry.etf];
                      const move = live?.dailyMove ?? null;
                      return (
                        <ResultRow key={entry.etf} idx={idx} highlighted={highlighted === idx}
                          onHover={() => setHighlighted(idx)} onClick={() => navigate(entry)}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 48 }}>{entry.etf}</span>
                          <span style={{ flex: 1, fontSize: 13, color: "#475569", fontWeight: 300 }}>{entry.name}</span>
                          {move != null && <MoveTag move={move} />}
                        </ResultRow>
                      );
                    })}
                  </>
                )}

                {subsectorResults.length > 0 && (
                  <>
                    <SectionLabel topGap={stockResults.length > 0 || sectorResults.length > 0}>Sub-sectors</SectionLabel>
                    {subsectorResults.map((entry) => {
                      const idx  = results.indexOf(entry);
                      const live = entry.etf ? marketData?.[entry.etf] : null;
                      const move = live?.dailyMove ?? null;
                      return (
                        <ResultRow key={entry.id} idx={idx} highlighted={highlighted === idx}
                          onHover={() => setHighlighted(idx)} onClick={() => navigate(entry)}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 48 }}>{entry.etf ?? "—"}</span>
                          <span style={{ flex: 1, fontSize: 13, color: "#475569", fontWeight: 300 }}>{entry.name}</span>
                          {move != null && <MoveTag move={move} />}
                        </ResultRow>
                      );
                    })}
                  </>
                )}

                {subsubResults.length > 0 && (
                  <>
                    <SectionLabel topGap={stockResults.length > 0 || sectorResults.length > 0 || subsectorResults.length > 0}>Industries</SectionLabel>
                    {subsubResults.map((entry) => {
                      const idx  = results.indexOf(entry);
                      const live = entry.etf ? marketData?.[entry.etf] : null;
                      const move = live?.dailyMove ?? null;
                      return (
                        <ResultRow key={entry.id} idx={idx} highlighted={highlighted === idx}
                          onHover={() => setHighlighted(idx)} onClick={() => navigate(entry)}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 48 }}>{entry.etf ?? "—"}</span>
                          <span style={{ flex: 1, fontSize: 13, color: "#475569", fontWeight: 300 }}>{entry.name}</span>
                          {move != null && <MoveTag move={move} />}
                        </ResultRow>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children, topGap }: { children: React.ReactNode; topGap?: boolean }) {
  return (
    <div style={{
      padding: "6px 18px 4px", fontSize: 10, color: "#334155",
      fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
      marginTop: topGap ? 4 : 0,
    }}>
      {children}
    </div>
  );
}

interface ResultRowProps {
  idx: number; highlighted: boolean;
  onHover: () => void; onClick: () => void;
  children: React.ReactNode;
}

function ResultRow({ idx, highlighted, onHover, onClick, children }: ResultRowProps) {
  return (
    <button
      data-idx={idx}
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 12,
        padding: "9px 18px",
        background: highlighted ? "rgba(255,255,255,0.05)" : "transparent",
        border: "none", cursor: "pointer", textAlign: "left",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        transition: "background 0.1s",
      }}
    >
      {children}
    </button>
  );
}

function MoveTag({ move }: { move: number }) {
  const col  = moveColor(move);
  const sign = move >= 0 ? "+" : "";
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: col, flexShrink: 0, minWidth: 54, textAlign: "right" }}>
      {sign}{move.toFixed(2)}%
    </span>
  );
}
