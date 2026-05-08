"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { moveColor } from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HierarchyNode {
  id:           string;
  node_type:    "sector" | "subsector" | "subsubsector";
  company_name: string | null;
  display_name: string | null;
  etf_ticker:   string | null;
  colour:       string | null;
  x_position:   number;
  y_position:   number;
}

export interface ConstituentStock {
  ticker:       string;
  company_name: string | null;
}

interface AnalysisData {
  segments:          string;
  margins:           string;
  guidance:          string;
  relationships:     string;
  last_generated_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NODE_TYPE_LABELS: Record<string, string> = {
  sector: "Sector", subsector: "Sub-sector", subsubsector: "Sub-sub-sector",
};

const ANALYSIS_FIELD_LABELS: Record<string, Record<string, string>> = {
  sector:       { segments: "Key themes", margins: "Sector flows", guidance: "Near-term catalysts", relationships: "Key relationships" },
  subsector:    { segments: "Unique drivers", margins: "Performance", guidance: "Catalysts & risks", relationships: "Constituent stocks" },
  subsubsector: { segments: "The thesis", margins: "Performance", guidance: "Key catalysts", relationships: "Beneficiaries & risks" },
};

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const SECTION: React.CSSProperties = {
  background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 12, padding: "24px 28px", marginBottom: 20,
};
const LABEL_SM: React.CSSProperties = {
  fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em",
  textTransform: "uppercase", marginBottom: 6,
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  node:        HierarchyNode;
  stocks:      ConstituentStock[];
  analysisKey: string; // what to pass as ?ticker= to /api/analysis
}

export default function HierarchyDetail({ node, stocks, analysisKey }: Props) {
  const router = useRouter();
  const name   = node.display_name ?? node.company_name ?? node.etf_ticker ?? "Node";
  const fields = ANALYSIS_FIELD_LABELS[node.node_type] ?? ANALYSIS_FIELD_LABELS.sector;

  // Live market data for this node's ETF
  const [livePrice, setLivePrice]   = useState<number | null>(null);
  const [livePct, setLivePct]       = useState<number | null>(null);

  useEffect(() => {
    if (!node.etf_ticker) return;
    const etf = node.etf_ticker;
    const cached = getCachedMarketData();
    if (cached?.[etf]) {
      setLivePrice(cached[etf].price);
      setLivePct(cached[etf].dailyMove);
      return;
    }
    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Record<string, { price: number; dailyMove: number; dailyMoveDollar: number }> | null) => {
        if (!data) return;
        setCachedMarketData(data);
        if (data[etf]) { setLivePrice(data[etf].price); setLivePct(data[etf].dailyMove); }
      })
      .catch(() => {});
  }, [node.etf_ticker]);

  // Visit tracking
  useEffect(() => {
    fetch("/api/node/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: node.id }),
    }).catch(() => {});
  }, [node.id]);

  // Analysis
  const [analysis, setAnalysis]           = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisDone, setAnalysisDone]   = useState(false);

  async function loadAnalysis() {
    if (analysisLoading || analysisDone) return;
    setAnalysisLoading(true);
    try {
      const [data] = await Promise.all([
        fetch(`/api/analysis?ticker=${encodeURIComponent(analysisKey)}`)
          .then((r) => r.ok ? r.json() : null)
          .catch(() => null),
        new Promise<void>((res) => setTimeout(res, 2000)),
      ]);
      if (data && !data.cached && data.segments) {
        setAnalysis(data as AnalysisData);
        setAnalysisDone(true);
      }
    } finally {
      setAnalysisLoading(false);
    }
  }

  const col       = livePct != null ? moveColor(livePct) : (node.colour ?? "#64748b");
  const pctSign   = (livePct ?? 0) >= 0 ? "+" : "";
  const typeLabel = NODE_TYPE_LABELS[node.node_type] ?? "Node";

  return (
    <div style={{ fontFamily: '"DM Sans", sans-serif', minHeight: "100vh", background: "#07090f" }}>
      <AppHeader />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "100px 24px 60px" }}>

        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", marginBottom: 24, padding: 0, fontFamily: "inherit" }}
        >
          ← Back
        </button>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
              background: `${col}18`, border: `1px solid ${col}40`, color: col,
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              {typeLabel}
            </span>
            {node.etf_ticker && (
              <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>{node.etf_ticker}</span>
            )}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: "#f1f5f9", margin: 0, lineHeight: 1.2 }}>{name}</h1>
        </div>

        {/* Live data strip (only if ETF available) */}
        {node.etf_ticker && (
          <div style={{ ...SECTION, display: "flex", gap: 40, alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={LABEL_SM}>Price ({node.etf_ticker})</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#f1f5f9" }}>{fmtPrice(livePrice)}</div>
            </div>
            {livePct != null && (
              <div>
                <div style={LABEL_SM}>Daily change</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: col }}>
                  {pctSign}{fmt(livePct)}%
                </div>
              </div>
            )}
            {!livePrice && !livePct && (
              <div style={{ fontSize: 13, color: "#334155" }}>Loading live data…</div>
            )}
          </div>
        )}

        {/* No ETF notice */}
        {!node.etf_ticker && (
          <div style={{ ...SECTION, color: "#64748b", fontSize: 13, marginBottom: 20 }}>
            No ETF ticker assigned to this node — live price data unavailable.
          </div>
        )}

        {/* Deeper dive */}
        <div style={SECTION}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Deeper dive</div>
            {!analysisDone && (
              <button
                onClick={loadAnalysis}
                disabled={analysisLoading}
                style={{
                  background: analysisLoading ? "rgba(255,255,255,0.04)" : `${col}18`,
                  border: `1px solid ${col}30`,
                  borderRadius: 8, color: analysisLoading ? "#475569" : col,
                  fontSize: 12, fontWeight: 500, padding: "6px 16px",
                  cursor: analysisLoading ? "wait" : "pointer", fontFamily: "inherit",
                }}
              >
                {analysisLoading ? "Generating…" : "Generate deeper dive"}
              </button>
            )}
          </div>
          {analysis ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {(["segments", "margins", "guidance", "relationships"] as const).map((key) => (
                <div key={key}>
                  <div style={LABEL_SM}>{fields[key]}</div>
                  <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>{analysis[key]}</div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#334155", marginTop: 4 }}>
                AI-generated · {new Date(analysis.last_generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Not financial advice.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#334155" }}>
              {analysisDone ? "Analysis unavailable." : "Click Generate to load AI analysis for this node."}
            </div>
          )}
        </div>

        {/* Constituent stocks */}
        {stocks.length > 0 && (
          <div style={SECTION}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#f1f5f9", marginBottom: 16 }}>
              Constituent stocks ({stocks.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {stocks.map((s) => (
                <button
                  key={s.ticker}
                  onClick={() => router.push(`/stock/${s.ticker}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    background: "none", border: "none", borderRadius: 6,
                    padding: "8px 4px", cursor: "pointer", textAlign: "left",
                    transition: "background 0.1s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", minWidth: 52 }}>
                    {s.ticker}
                  </span>
                  <span style={{ fontSize: 13, color: "#475569" }}>{s.company_name ?? ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stocks.length === 0 && (
          <div style={{ ...SECTION, color: "#334155", fontSize: 13 }}>
            No stocks connected to this node yet. Use the admin connections panel to add them.
          </div>
        )}
      </div>
    </div>
  );
}
