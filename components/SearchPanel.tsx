"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { moveColor } from "@/lib/graphTypes";
import { getCachedMarketData } from "@/lib/marketDataCache";

// ─── Static search data ───────────────────────────────────────────────────────

interface StockEntry {
  kind: "stock";
  ticker: string;
  name: string;
  sectorId: string;
  sectorName: string;
}

interface SectorEntry {
  kind: "sector";
  id: string;
  name: string;
  etf: string;
}

type Entry = StockEntry | SectorEntry;

const STOCKS: StockEntry[] = [
  { kind: "stock", ticker: "NVDA", name: "NVIDIA",               sectorId: "tech",    sectorName: "Technology" },
  { kind: "stock", ticker: "MSFT", name: "Microsoft",            sectorId: "tech",    sectorName: "Technology" },
  { kind: "stock", ticker: "PLTR", name: "Palantir",             sectorId: "tech",    sectorName: "Technology" },
  { kind: "stock", ticker: "AMD",  name: "AMD",                  sectorId: "tech",    sectorName: "Technology" },
  { kind: "stock", ticker: "ARM",  name: "Arm Holdings",         sectorId: "tech",    sectorName: "Technology" },
  { kind: "stock", ticker: "SMCI", name: "Super Micro Computer", sectorId: "tech",    sectorName: "Technology" },
  { kind: "stock", ticker: "XOM",  name: "ExxonMobil",           sectorId: "energy",  sectorName: "Energy" },
  { kind: "stock", ticker: "CVX",  name: "Chevron",              sectorId: "energy",  sectorName: "Energy" },
  { kind: "stock", ticker: "FANG", name: "Diamondback Energy",   sectorId: "energy",  sectorName: "Energy" },
  { kind: "stock", ticker: "SLB",  name: "SLB",                  sectorId: "energy",  sectorName: "Energy" },
  { kind: "stock", ticker: "LLY",  name: "Eli Lilly",            sectorId: "health",  sectorName: "Healthcare" },
  { kind: "stock", ticker: "HIMS", name: "Hims & Hers",          sectorId: "health",  sectorName: "Healthcare" },
  { kind: "stock", ticker: "RXRX", name: "Recursion Pharma",     sectorId: "health",  sectorName: "Healthcare" },
  { kind: "stock", ticker: "MRNA", name: "Moderna",              sectorId: "health",  sectorName: "Healthcare" },
  { kind: "stock", ticker: "PYPL", name: "PayPal",               sectorId: "finance", sectorName: "Finance" },
  { kind: "stock", ticker: "COIN", name: "Coinbase",             sectorId: "finance", sectorName: "Finance" },
  { kind: "stock", ticker: "HOOD", name: "Robinhood",            sectorId: "finance", sectorName: "Finance" },
  { kind: "stock", ticker: "AFRM", name: "Affirm",               sectorId: "finance", sectorName: "Finance" },
  { kind: "stock", ticker: "SOFI", name: "SoFi Technologies",    sectorId: "finance", sectorName: "Finance" },
];

const SECTORS: SectorEntry[] = [
  { kind: "sector", id: "tech",     name: "Technology",             etf: "XLK" },
  { kind: "sector", id: "energy",   name: "Energy",                 etf: "XLE" },
  { kind: "sector", id: "health",   name: "Healthcare",             etf: "XLV" },
  { kind: "sector", id: "finance",  name: "Finance",                etf: "XLF" },
  { kind: "sector", id: "consumer", name: "Consumer Discretionary", etf: "XLY" },
];

function rankEntry(entry: Entry, q: string): number {
  const lq = q.toLowerCase();
  const primary   = entry.kind === "stock" ? entry.ticker : entry.etf;
  const secondary = entry.kind === "stock" ? entry.name   : entry.name;
  if (primary.toLowerCase() === lq)              return 4;
  if (primary.toLowerCase().startsWith(lq))      return 3;
  if (secondary.toLowerCase().startsWith(lq))    return 2;
  if (secondary.toLowerCase().includes(lq))      return 1;
  return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const marketData = getCachedMarketData();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo((): Entry[] => {
    const q = query.trim();
    if (!q) return [];
    const ranked = (entries: Entry[]) =>
      entries
        .map((e) => ({ e, rank: rankEntry(e, q) }))
        .filter((x) => x.rank > 0)
        .sort((a, b) => b.rank - a.rank)
        .map((x) => x.e);
    return [...ranked(STOCKS), ...ranked(SECTORS)];
  }, [query]);

  useEffect(() => { setHighlighted(0); }, [results]);

  // Keep highlighted row scrolled into view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  function navigate(entry: Entry) {
    if (entry.kind === "stock")  router.push(`/stock/${entry.ticker}`);
    if (entry.kind === "sector") router.push(`/sector/${entry.id}`);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
        break;
      case "Enter":
        if (results.length > 0) navigate(results[highlighted] ?? results[0]);
        break;
    }
  }

  const stockResults  = results.filter((r): r is StockEntry  => r.kind === "stock");
  const sectorResults = results.filter((r): r is SectorEntry => r.kind === "sector");
  const hasQuery      = query.trim().length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          margin: "0 24px",
          background: "#0d1117",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── Input row ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 18px",
            borderBottom: hasQuery ? "1px solid rgba(255,255,255,0.07)" : "none",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4" stroke="#475569" strokeWidth="1.5" />
            <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
          </svg>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search stocks and sectors..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: 16,
              color: "#f1f5f9",
              fontFamily: "inherit",
              fontWeight: 300,
            }}
          />

          <span style={{ fontSize: 11, color: "#1e293b", whiteSpace: "nowrap", flexShrink: 0 }}>
            ESC to close
          </span>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
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
                        <ResultRow
                          key={entry.ticker}
                          idx={idx}
                          highlighted={highlighted === idx}
                          onHover={() => setHighlighted(idx)}
                          onClick={() => navigate(entry)}
                        >
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 48 }}>
                            {entry.ticker}
                          </span>
                          <span style={{ flex: 1, fontSize: 13, color: "#475569", fontWeight: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.name}
                          </span>
                          <span style={{ fontSize: 11, color: "#1e293b", flexShrink: 0 }}>
                            {entry.sectorName}
                          </span>
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
                        <ResultRow
                          key={entry.id}
                          idx={idx}
                          highlighted={highlighted === idx}
                          onHover={() => setHighlighted(idx)}
                          onClick={() => navigate(entry)}
                        >
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 48 }}>
                            {entry.etf}
                          </span>
                          <span style={{ flex: 1, fontSize: 13, color: "#475569", fontWeight: 300 }}>
                            {entry.name}
                          </span>
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

// ─── Small sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children, topGap }: { children: React.ReactNode; topGap?: boolean }) {
  return (
    <div
      style={{
        padding: "6px 18px 4px",
        fontSize: 10,
        color: "#334155",
        fontWeight: 500,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginTop: topGap ? 4 : 0,
      }}
    >
      {children}
    </div>
  );
}

interface ResultRowProps {
  idx: number;
  highlighted: boolean;
  onHover: () => void;
  onClick: () => void;
  children: React.ReactNode;
}

function ResultRow({ idx, highlighted, onHover, onClick, children }: ResultRowProps) {
  return (
    <button
      data-idx={idx}
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 18px",
        background: highlighted ? "rgba(255,255,255,0.05)" : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
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
