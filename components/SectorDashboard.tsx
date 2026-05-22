"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { moveColor, moveFill } from "@/lib/graphTypes";

const DM = 'var(--font-dm-sans), "DM Sans", sans-serif';

// ─── Sector definitions ───────────────────────────────────────────────────────

const SECTORS = [
  { id: "sec-tech",        name: "Information Technology",   etf: "XLK",  color: "#3b82f6" },
  { id: "sec-comm",        name: "Communication Services",   etf: "XLC",  color: "#8b5cf6" },
  { id: "sec-consumer",    name: "Consumer Discretionary",   etf: "XLY",  color: "#14b8a6" },
  { id: "sec-staples",     name: "Consumer Staples",         etf: "XLP",  color: "#06b6d4" },
  { id: "sec-health",      name: "Healthcare",               etf: "XLV",  color: "#22c55e" },
  { id: "sec-finance",     name: "Financials",               etf: "XLF",  color: "#a855f7" },
  { id: "sec-realestate",  name: "Real Estate",              etf: "XLRE", color: "#ec4899" },
  { id: "sec-utilities",   name: "Utilities",                etf: "XLU",  color: "#6366f1" },
  { id: "sec-energy",      name: "Energy",                   etf: "XLE",  color: "#f59e0b" },
  { id: "sec-materials",   name: "Materials",                etf: "XLB",  color: "#84cc16" },
  { id: "sec-industrials", name: "Industrials",              etf: "XLI",  color: "#f97316" },
];

// Built from SECTORS so there's a single source of truth for the ETF mapping
const SECTOR_ETF_TICKER: Record<string, string> = Object.fromEntries(
  SECTORS.map((s) => [s.name, s.etf])
);

const SECTOR_ID: Record<string, string> = {
  "Information Technology":  "sec-tech",
  Technology:                "sec-tech",
  "Communication Services":  "sec-comm",
  Communication:             "sec-comm",
  "Consumer Discretionary":  "sec-consumer",
  Consumer:                  "sec-consumer",
  "Consumer Staples":        "sec-staples",
  Healthcare:                "sec-health",
  Financials:                "sec-finance",
  Finance:                   "sec-finance",
  "Financial Services":      "sec-finance",
  "Real Estate":             "sec-realestate",
  Utilities:                 "sec-utilities",
  Energy:                    "sec-energy",
  Materials:                 "sec-materials",
  Industrials:               "sec-industrials",
};

const SECTOR_COLOR: Record<string, string> = Object.fromEntries(SECTORS.map((s) => [s.id, s.color]));

// ─── Types ────────────────────────────────────────────────────────────────────

interface MarketEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
  streak: number;
  streakDirection: "up" | "down" | "flat";
}

interface GraphStock { ticker: string; company_name: string; sector: string; }

interface FundamentalsEntry {
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
}

interface StockRow {
  ticker: string;
  name: string;
  sector: string;
  sectorId: string;
  price: number | null;
  dailyMove: number | null;
  dailyMoveDollar: number | null;
  streak: number;
  streakDirection: "up" | "down" | "flat";
  marketCap: number | null;
  relVolume: number | null;
  vs1m:      number | null;
}

type SortKey = "ticker" | "dailyMove" | "dailyMoveDollar" | "price" | "streak" | "relVolume" | "vs1m";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtPct   = (n: number | null) => n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fmtDollar = (n: number | null) => n == null ? "—" : `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(2)}`;
const fmtPrice  = (n: number | null) => n == null ? "—" : `$${n.toFixed(2)}`;

// ─── Section 1: Sector cards ──────────────────────────────────────────────────

function SectorCard({
  sector,
  marketData,
  stockCount,
  maxAbsMove,
  onClick,
}: {
  sector: typeof SECTORS[number];
  marketData: Record<string, MarketEntry>;
  stockCount: number;
  maxAbsMove: number;
  onClick: () => void;
}) {
  const live = marketData[sector.etf];
  const move = live?.dailyMove ?? null;
  const dollar = live?.dailyMoveDollar ?? null;
  const isUp = (move ?? 0) >= 0;
  const barPct = maxAbsMove > 0 && move != null ? Math.abs(move) / maxAbsMove * 100 : 0;

  return (
    <div
      onClick={onClick}
      style={{
        flex: "1 1 160px",
        background: "#0d1117",
        border: `1px solid ${sector.color}28`,
        borderTop: `2px solid ${sector.color}`,
        borderRadius: 10,
        padding: "16px 18px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#0d1117"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{sector.name}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{sector.etf}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: move != null ? (isUp ? "#22c55e" : "#ef4444") : "#475569" }}>
            {fmtPct(move)}
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{fmtDollar(dollar)}</div>
        </div>
      </div>

      {/* Relative performance bar */}
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 3, marginBottom: 10, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${barPct}%`,
          background: move != null ? moveColor(move) : "#334155",
          borderRadius: 3,
          transition: "width 0.4s ease",
        }} />
      </div>

      <div style={{ fontSize: 11, color: "#334155" }}>
        {stockCount} stock{stockCount !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ─── Section 2: Stock table ───────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span style={{ marginLeft: 4, opacity: active ? 1 : 0.25, fontSize: 10 }}>
      {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );
}

function StockTable({ rows }: { rows: StockRow[] }) {
  const router = useRouter();
  const [sortBy, setSortBy]   = useState<SortKey>("dailyMove");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sector, setSector]   = useState<string>("all");
  const [search, setSearch]   = useState("");

  function handleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  }

  const filtered = rows
    .filter((r) => sector === "all" || r.sectorId === sector)
    .filter((r) => {
      const q = search.trim().toUpperCase();
      return !q || r.ticker.includes(q) || r.name.toUpperCase().includes(q);
    })
    .sort((a, b) => {
      const av = (sortBy === "ticker" ? a.ticker : (a[sortBy] ?? -Infinity)) as string | number;
      const bv = (sortBy === "ticker" ? b.ticker : (b[sortBy] ?? -Infinity)) as string | number;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === "desc" ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: "10px 12px",
    textAlign: key === "ticker" || key === "streak" ? "left" : "right" as const,
    fontSize: 11, fontWeight: 600, color: sortBy === key ? "#94a3b8" : "#334155",
    letterSpacing: "0.06em", textTransform: "uppercase" as const,
    cursor: "pointer", userSelect: "none" as const,
    whiteSpace: "nowrap" as const, background: "none", border: "none",
    fontFamily: DM,
  });

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticker or company…"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "8px 12px",
            fontSize: 13, color: "#94a3b8", fontFamily: DM, outline: "none",
            width: 220,
          }}
        />
        {/* Sector filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "all", name: "All", color: "#64748b" }, ...SECTORS].map((s) => {
            const active = sector === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSector(s.id)}
                style={{
                  padding: "5px 12px", borderRadius: 20,
                  background: active ? `${s.color}18` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? `${s.color}50` : "rgba(255,255,255,0.08)"}`,
                  color: active ? s.color : "#475569",
                  fontSize: 12, fontWeight: active ? 500 : 400,
                  cursor: "pointer", fontFamily: DM,
                }}
              >
                {s.name}
              </button>
            );
          })}
          {sector !== "all" && (
            <button
              onClick={() => router.push(`/sector/${sector.replace("sec-", "")}`)}
              style={{
                padding: "5px 10px", borderRadius: 20,
                background: "none", border: "1px solid rgba(255,255,255,0.08)",
                color: "#3b82f6", fontSize: 12, cursor: "pointer", fontFamily: DM,
              }}
            >
              View sector →
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: DM, tableLayout: "fixed" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {([
                  { key: "ticker" as SortKey,         label: "Ticker",         width: "8%"  },
                  { key: null,                          label: "Company",        width: "20%" },
                  { key: null,                          label: "Sector",         width: "12%" },
                  { key: "dailyMove" as SortKey,       label: "Daily %",        width: "12%" },
                  { key: "price" as SortKey,            label: "Price",          width: "10%" },
                  { key: "streak" as SortKey,           label: "Streak",         width: "10%" },
                  { key: "vs1m" as SortKey,             label: "vs Sector (1D)", width: "12%" },
                ] as Array<{ key: SortKey | null; label: string; width: string }>).map(({ key, label, width }) => (
                  <th
                    key={label}
                    onClick={key ? () => handleSort(key) : undefined}
                    style={{
                      ...thStyle(key ?? "ticker"),
                      width,
                      cursor: key ? "pointer" : "default",
                      textAlign: label === "Ticker" || label === "Company" || label === "Sector" ? "left" : label === "Streak" ? "center" : "right",
                    }}
                  >
                    {label}{key && <SortIcon active={sortBy === key} dir={sortDir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const sColor = SECTOR_COLOR[row.sectorId] ?? "#64748b";
                const moveCol = row.dailyMove != null
                  ? (row.dailyMove >= 0 ? "#22c55e" : "#ef4444")
                  : "#475569";
                const streak = row.streak > 0
                  ? `${row.streakDirection === "up" ? "↑" : row.streakDirection === "down" ? "↓" : "—"} ${row.streak}`
                  : "—";
                return (
                  <tr
                    key={row.ticker}
                    onClick={() => router.push(`/stock/${row.ticker}`)}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                  >
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>{row.ticker}</td>
                    <td style={{ padding: "11px 12px", fontSize: 12, color: "#64748b", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</td>
                    <td style={{ padding: "11px 12px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500,
                        color: sColor,
                        background: sColor + "18",
                        border: `1px solid ${sColor}35`,
                        borderRadius: 4, padding: "2px 7px",
                        whiteSpace: "nowrap",
                      }}>
                        {row.sector}
                      </span>
                    </td>
                    <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: moveCol, textAlign: "right" }}>{fmtPct(row.dailyMove)}</td>
                    <td style={{ padding: "11px 12px", fontSize: 13, color: "#94a3b8", textAlign: "right" }}>{fmtPrice(row.price)}</td>
                    <td style={{ padding: "11px 12px", fontSize: 12, color: row.streakDirection === "up" ? "#22c55e" : row.streakDirection === "down" ? "#ef4444" : "#334155", textAlign: "center" }}>{streak}</td>
                    <td style={{ padding: "11px 12px", fontSize: 12, fontWeight: 500, color: row.vs1m == null ? "#334155" : row.vs1m >= 0 ? "#22c55e" : "#ef4444", textAlign: "right" }}>
                      {row.vs1m != null ? `${row.vs1m >= 0 ? "+" : ""}${row.vs1m.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: "32px 12px", textAlign: "center", fontSize: 13, color: "#334155" }}>No stocks match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Section 3: Heatmap ───────────────────────────────────────────────────────

function Heatmap({ rows }: { rows: StockRow[] }) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<{ ticker: string; move: number | null; x: number; y: number } | null>(null);

  const maxCap = Math.max(...rows.map((r) => r.marketCap ?? 0));

  function cellSize(cap: number | null): number {
    if (!cap || maxCap === 0) return 48;
    return Math.round(44 + Math.sqrt(cap / maxCap) * 84);
  }

  const bySector = SECTORS.map((s) => ({
    sector: s,
    stocks: rows
      .filter((r) => r.sectorId === s.id)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
  })).filter((g) => g.stocks.length > 0);

  return (
    <div style={{ position: "relative" }}>
      {bySector.map(({ sector, stocks }) => (
        <div key={sector.id} style={{ marginBottom: 28 }}>
          {/* Sector label */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: sector.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {sector.name}
            </span>
            <div style={{ flex: 1, height: 1, background: `${sector.color}28` }} />
          </div>

          {/* Stock cells */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {stocks.map((row) => {
              const sz  = cellSize(row.marketCap);
              const bg  = moveFill(row.dailyMove ?? 0, 0.35);
              const bdr = moveColor(row.dailyMove ?? 0);
              return (
                <div
                  key={row.ticker}
                  onClick={() => router.push(`/stock/${row.ticker}`)}
                  onMouseEnter={(e) => setTooltip({ ticker: row.ticker, move: row.dailyMove, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                  onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                  style={{
                    width: sz, height: sz,
                    background: bg,
                    border: `1px solid ${bdr}55`,
                    borderRadius: 6,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                    transition: "transform 0.1s, border-color 0.1s",
                    flexShrink: 0,
                  }}
                  onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "scale(0.96)"; }}
                  onMouseUp={(e)   => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
                >
                  <span style={{ fontSize: Math.max(9, sz / 6), fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>
                    {row.ticker}
                  </span>
                  {sz >= 60 && (
                    <span style={{ fontSize: Math.max(9, sz / 7.5), color: moveColor(row.dailyMove ?? 0), fontWeight: 500 }}>
                      {fmtPct(row.dailyMove)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: tooltip.y - 12,
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 7,
            padding: "7px 12px",
            fontSize: 12,
            color: "#f1f5f9",
            pointerEvents: "none",
            zIndex: 100,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            fontFamily: DM,
          }}
        >
          <span style={{ fontWeight: 700, marginRight: 8 }}>{tooltip.ticker}</span>
          <span style={{ color: tooltip.move != null ? (tooltip.move >= 0 ? "#22c55e" : "#ef4444") : "#475569" }}>
            {fmtPct(tooltip.move)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SectorDashboard() {
  const router = useRouter();

  const [marketData, setMarketData]   = useState<Record<string, MarketEntry>>({});
  const [stocks, setStocks]           = useState<GraphStock[]>([]);
  const [fundamentals, setFundamentals] = useState<Record<string, FundamentalsEntry>>({});
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/market-data?includeStreak=true").then((r) => r.ok ? r.json() : null),
      fetch("/api/graph").then((r) => r.ok ? r.json() : null),
      fetch("/api/fundamentals").then((r) => r.ok ? r.json() : null),
    ]).then(([mdRes, graphRes, fundRes]) => {
      if (mdRes.status === "fulfilled" && mdRes.value) {
        setMarketData(mdRes.value);
      }
      if (graphRes.status === "fulfilled" && graphRes.value?.stocks) {
        setStocks(graphRes.value.stocks);
      }
      if (fundRes.status === "fulfilled" && fundRes.value) {
        setFundamentals(fundRes.value);
      }
      setLoading(false);
    });
  }, []);

  // Build stock rows
  const rows: StockRow[] = stocks.map((s) => {
    const live = marketData[s.ticker];
    const fund = fundamentals[s.ticker] as FundamentalsEntry | undefined;
    const sectorId = SECTOR_ID[s.sector] ?? "sec-tech";
    const relVol =
      fund?.volume && fund?.averageVolume && fund.averageVolume > 0
        ? fund.volume / fund.averageVolume
        : null;
    return {
      ticker:          s.ticker,
      name:            s.company_name,
      sector:          s.sector,
      sectorId,
      price:           live?.price ?? null,
      dailyMove:       live?.dailyMove ?? null,
      dailyMoveDollar: live?.dailyMoveDollar ?? null,
      streak:          live?.streak ?? 0,
      streakDirection: live?.streakDirection ?? "flat",
      marketCap:       fund?.marketCap ?? null,
      relVolume:       relVol,
      vs1m:            (() => {
        const etfTicker = SECTOR_ETF_TICKER[s.sector];
        const etfMove   = etfTicker ? (marketData[etfTicker]?.dailyMove ?? null) : null;
        return live?.dailyMove != null && etfMove != null
          ? live.dailyMove - etfMove
          : null;
      })(),
    };
  });

  // Sector card data
  const sectorMoves = SECTORS.map((s) => marketData[s.etf]?.dailyMove ?? 0);
  const maxAbsMove  = Math.max(...sectorMoves.map(Math.abs), 0.01);

  const sectorsSorted = [...SECTORS].sort((a, b) => {
    const am = marketData[a.etf]?.dailyMove ?? 0;
    const bm = marketData[b.etf]?.dailyMove ?? 0;
    return bm - am;
  });

  const stockCountBySector: Record<string, number> = {};
  for (const s of stocks) {
    const sid = SECTOR_ID[s.sector] ?? "sec-tech";
    stockCountBySector[sid] = (stockCountBySector[sid] ?? 0) + 1;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", fontFamily: DM, color: "#f1f5f9" }}>
      {/* Back button */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px 0" }}>
        <button
          onClick={() => router.push("/graph")}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            color: "#475569", fontSize: 13, padding: 0, fontFamily: "inherit",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Graph
        </button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f1f5f9", margin: "0 0 6px" }}>
            Sector Performance
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: 0, fontWeight: 300 }}>
            Live performance across all tracked sectors
          </p>
        </div>

        {loading ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "#334155", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            {/* ── Section 1: Sector cards ─────────────────────────────────── */}
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                Sector overview
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {sectorsSorted.map((s) => (
                  <SectorCard
                    key={s.id}
                    sector={s}
                    marketData={marketData}
                    stockCount={stockCountBySector[s.id] ?? 0}
                    maxAbsMove={maxAbsMove}
                    onClick={() => router.push(`/sector/${s.id.replace("sec-", "")}`)}
                  />
                ))}
              </div>
            </div>

            {/* ── Section 2: Stock table ──────────────────────────────────── */}
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                All stocks
              </div>
              <StockTable rows={rows} />
            </div>

            {/* ── Section 3: Heatmap ──────────────────────────────────────── */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
                Sector heatmap
              </div>
              <div style={{
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "20px 20px 12px",
              }}>
                <Heatmap rows={rows} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
