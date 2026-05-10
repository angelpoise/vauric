"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { moveColor } from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";
import UpgradeButton from "@/components/UpgradeButton";
import { FREE_TIER_CAP, WATCHLIST_EVENT, getWatchlist, addToWatchlist } from "@/lib/watchlist";
import { aggregateSentiment } from "@/lib/stockSentiment";
import type { FundamentalsEntry } from "@/lib/fundamentalsUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HierarchyNode {
  id:              string;
  node_type:       "sector" | "subsector" | "subsubsector";
  company_name:    string | null;
  display_name:    string | null;
  etf_ticker:      string | null;
  colour:          string | null;
  parent_node_id:  string | null;
  cached_overview: string | null;
  x_position:      number;
  y_position:      number;
}

export interface ConstituentStock { ticker: string; company_name: string | null; }

interface Props {
  node:                HierarchyNode;
  stocks:              ConstituentStock[];
  analysisKey:         string;
  initialFundamentals?: FundamentalsEntry | null;
  initialOverview?:    string | null;
  parentName?:         string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ANALYSIS_MSGS = ["Analysing sector themes…","Reviewing recent performance…","Processing market data…","Compiling insights…"];
const SCENARIO_MSGS = ["Stress-testing bull case…","Assessing base case…","Modelling bear case…","Calculating price targets…"];

function daysAgo(d: string | null | undefined) {
  if (!d) return "unknown";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

function fmtMktCap(v: number) {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(1)}K`;
}
function fmtVol(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toLocaleString("en-US");
}

type MetricRow = { label: string; value: string };

function buildEtfMetrics(f: FundamentalsEntry | null): MetricRow[] {
  const p  = (v: number | null | undefined, fn: (n: number) => string) => v != null ? fn(v) : "—";
  const px = (v: number | null | undefined) => p(v, (n) => `$${n.toFixed(2)}`);
  const pct = (v: number | null | undefined) => p(v, (n) => `${(n * 100).toFixed(2)}%`);
  return [
    { label: "AUM",           value: p(f?.totalAssets ?? f?.marketCap, fmtMktCap) },
    { label: "Yield",         value: pct(f?.fundYield) },
    { label: "Beta (vs SPY)", value: p(f?.beta, (n) => n.toFixed(2)) },
    { label: "Avg Volume",    value: p(f?.averageVolume, fmtVol) },
    { label: "52W High",      value: px(f?.fiftyTwoWeekHigh) },
    { label: "52W Low",       value: px(f?.fiftyTwoWeekLow) },
    { label: "50D Average",   value: px(f?.fiftyDayAverage) },
    { label: "200D Average",  value: px(f?.twoHundredDayAverage) },
  ];
}

const RS_TREND_COLOR = { outperforming: "#22c55e", inline: "#64748b", underperforming: "#ef4444" };

function RSBarRow({ label, value }: { label: string; value: number | null }) {
  const MAX = 15;
  const isPos = (value ?? 0) >= 0;
  const col   = value != null ? (isPos ? "#22c55e" : "#ef4444") : "#334155";
  const pct   = value != null ? Math.min(Math.abs(value) / MAX, 1) * 50 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
      <div style={{ width: 28, fontSize: 11, color: "#475569", fontWeight: 500 }}>{label}</div>
      <div style={{ flex: 1, position: "relative", height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 3 }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 3, background: col, ...(isPos ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }) }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 1, height: 10, background: "rgba(255,255,255,0.15)" }} />
      </div>
      <div style={{ width: 68, textAlign: "right", fontSize: 12, color: col, fontWeight: 500 }}>
        {value != null ? `${isPos ? "+" : ""}${value.toFixed(1)}%` : "—"}
      </div>
      <div style={{ width: 36, fontSize: 11, color: "#334155" }}>SPY</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "14px 0", cursor: "pointer", fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}>
          <path d="M4 6L8 10L12 6" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div style={{ overflow: "hidden", maxHeight: open ? "2000px" : "0", transition: "max-height 0.3s ease" }}>
        <div style={{ paddingTop: 20, paddingBottom: 28 }}>{children}</div>
      </div>
    </div>
  );
}

const ANALYSIS_LABELS: Record<string, Record<string, string>> = {
  sector:       { segments: "Key themes",     margins: "Sector flows",   guidance: "Near-term catalysts", relationships: "Key relationships" },
  subsector:    { segments: "Unique drivers", margins: "Performance",    guidance: "Catalysts & risks",   relationships: "Constituent stocks" },
  subsubsector: { segments: "The thesis",     margins: "Performance",    guidance: "Key catalysts",       relationships: "Beneficiaries & risks" },
};
const NODE_TYPE_LABELS: Record<string, string> = { sector: "Sector", subsector: "Sub-sector", subsubsector: "Industry" };

// ─── Component ────────────────────────────────────────────────────────────────

export default function HierarchyDetail({ node, stocks, analysisKey, initialFundamentals, initialOverview, parentName }: Props) {
  const router  = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const isPro = user?.publicMetadata?.isPro === true;

  async function authFetch(url: string, init?: RequestInit) {
    const token = await getToken();
    return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }

  const name    = node.display_name ?? node.company_name ?? node.etf_ticker ?? "Node";
  const etf     = node.etf_ticker;
  const hasEtf  = !!etf;
  const labels  = ANALYSIS_LABELS[node.node_type] ?? ANALYSIS_LABELS.sector;
  const typeLabel = NODE_TYPE_LABELS[node.node_type] ?? "";
  const nodeTypeColor = node.colour ?? "#64748b";

  // ── Live market data ───────────────────────────────────────────────────────
  interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }
  const [live, setLive]     = useState<LiveEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!etf) { setLoaded(true); return; }
    const cached = getCachedMarketData();
    if (cached?.[etf]) { setLive(cached[etf]); setLoaded(true); }
    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((json: Record<string, LiveEntry> | null) => {
        if (json) setCachedMarketData(json as Parameters<typeof setCachedMarketData>[0]);
        if (json?.[etf]) setLive(json[etf]);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [etf]);

  // ── Fundamentals — server provides initial data; client skips refetch ──────
  const [fundamentals, setFundamentals] = useState<FundamentalsEntry | null>(initialFundamentals ?? null);

  useEffect(() => {
    // If server already passed fundamentals, no client fetch needed
    if (fundamentals || !etf) return;
    // Fallback: try the stock fundamentals cache (won't find ETFs, but harmless)
    fetch("/api/fundamentals")
      .then((r) => r.ok ? r.json() : null)
      .then((json: Record<string, FundamentalsEntry> | null) => {
        if (json?.[etf]) setFundamentals(json[etf]);
      })
      .catch(() => {});
  }, [etf, fundamentals]);

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const [inWatchlist, setInWatchlist] = useState(false);
  const [wlFlash, setWlFlash]         = useState<"added" | "duplicate" | "limit" | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!etf) return;
    setInWatchlist(getWatchlist().includes(etf));
    const onUpdate = () => setInWatchlist(getWatchlist().includes(etf));
    window.addEventListener(WATCHLIST_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => { window.removeEventListener(WATCHLIST_EVENT, onUpdate); window.removeEventListener("storage", onUpdate); };
  }, [etf]);

  function handleAddToWatchlist() {
    if (!etf) return;
    const result = addToWatchlist(etf);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setWlFlash(result);
    flashTimer.current = setTimeout(() => setWlFlash(null), result === "limit" ? 3000 : 1800);
  }

  // ── Relative strength ─────────────────────────────────────────────────────
  interface RSData { vs1w: number | null; vs1m: number | null; vs3m: number | null; score: number; trend: "outperforming" | "inline" | "underperforming"; }
  const [rsData, setRsData]       = useState<RSData | null>(null);
  const [rsLoading, setRsLoading] = useState(true);

  useEffect(() => {
    if (!etf) { setRsLoading(false); return; }
    fetch(`/api/relative-strength?ticker=${etf}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: RSData | null) => { if (d) setRsData(d); })
      .catch(() => {})
      .finally(() => setRsLoading(false));
  }, [etf]);

  // ── News ──────────────────────────────────────────────────────────────────
  interface ApiNewsItem { id: number; headline: string; source: string | null; published_at: string; url: string | null; }
  const [news, setNews]               = useState<ApiNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    const ticker = etf ?? analysisKey;
    fetch(`/api/news?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: ApiNewsItem[]) => setNews(Array.isArray(d) ? d : []))
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [etf, analysisKey]);

  // ── ETF holdings ──────────────────────────────────────────────────────────
  interface EtfHolding { symbol: string; holdingName: string; holdingPercent: number; }
  const [holdings, setHoldings] = useState<EtfHolding[]>([]);

  useEffect(() => {
    if (!etf) return;
    fetch(`/api/etf/holdings?symbol=${etf}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d: EtfHolding[]) => setHoldings(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [etf]);

  // ── Overview ──────────────────────────────────────────────────────────────
  // For hierarchy nodes: always use DB cached_overview or Claude generation.
  // Yahoo's longBusinessSummary for ETFs describes fund mechanics ("invests
  // substantially all assets in securities comprising the index…"), not the
  // sector itself — it's not useful. Claude generates sector-specific content.
  const [overview, setOverview]           = useState<string | null>(initialOverview ?? null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewTriggered, setOverviewTriggered] = useState(false);

  // If no overview yet, trigger background generation once
  useEffect(() => {
    if (overview || overviewTriggered) return;
    setOverviewTriggered(true);
    setOverviewLoading(true);
    fetch("/api/hierarchy/overview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: node.id, parentName: parentName ?? null }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { overview: string | null } | null) => { if (d?.overview) setOverview(d.overview); })
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, [overview, overviewTriggered, node.id, parentName]);

  // ── Deeper dive ───────────────────────────────────────────────────────────
  interface AnalysisData { segments: string; margins: string; guidance: string; relationships: string; last_generated_at?: string; }
  const [analysis, setAnalysis]           = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [analysisMsgIdx, setAnalysisMsgIdx]   = useState(0);

  useEffect(() => {
    if (!analysisLoading) { setAnalysisMsgIdx(0); return; }
    const id = setInterval(() => setAnalysisMsgIdx((i) => (i + 1) % ANALYSIS_MSGS.length), 700);
    return () => clearInterval(id);
  }, [analysisLoading]);

  async function handleGenerateAnalysis() {
    if (analysisLoading) return;
    setAnalysisLoading(true); setAnalysisError(false); setAnalysisVisible(false);
    try {
      const [data] = await Promise.all([
        fetch(`/api/analysis?ticker=${encodeURIComponent(analysisKey)}&readonly=true`)
          .then((r) => r.ok ? r.json() : null).catch(() => null),
        new Promise<void>((res) => setTimeout(res, 2500)),
      ]);
      if (data && !data.cached && data.segments) {
        setAnalysis(data as AnalysisData);
        requestAnimationFrame(() => requestAnimationFrame(() => setAnalysisVisible(true)));
      } else if (data?.cached === false) {
        setAnalysis({ segments: "Analysis is being prepared — check back in a few minutes.", margins: "", guidance: "", relationships: "" });
        requestAnimationFrame(() => requestAnimationFrame(() => setAnalysisVisible(true)));
      } else { setAnalysisError(true); }
    } finally { setAnalysisLoading(false); }
  }

  // ── Scenarios ─────────────────────────────────────────────────────────────
  interface ScenarioCase { "6m": string; "1y": string; "2y": string; target6m: { low: number; high: number }; target1y: { low: number; high: number }; target2y: { low: number; high: number }; }
  interface ScenarioData { bull: ScenarioCase; base: ScenarioCase; bear: ScenarioCase; generated_at: string; }
  const [scenarioData, setScenarioData]     = useState<ScenarioData | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioTab, setScenarioTab]         = useState<"bull" | "base" | "bear">("base");
  const [scenarioVisible, setScenarioVisible] = useState(false);
  const [scenarioMsgIdx, setScenarioMsgIdx]   = useState(0);
  const [trackedTheses, setTrackedTheses]     = useState<Record<string, string>>({});
  const [trackingInFlight, setTrackingInFlight] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!scenarioLoading) { setScenarioMsgIdx(0); return; }
    const id = setInterval(() => setScenarioMsgIdx((i) => (i + 1) % SCENARIO_MSGS.length), 700);
    return () => clearInterval(id);
  }, [scenarioLoading]);

  async function handleGenerateScenarios() {
    if (scenarioLoading) return;
    setScenarioLoading(true); setScenarioVisible(false);
    try {
      const [data] = await Promise.all([
        fetch(`/api/scenarios?ticker=${encodeURIComponent(analysisKey)}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        new Promise<void>((res) => setTimeout(res, 2500)),
      ]);
      if (data?.cached === false) {
        const ph = { "6m": "Scenarios are being prepared — check back in a few minutes.", "1y": "", "2y": "", target6m: { low: 0, high: 0 }, target1y: { low: 0, high: 0 }, target2y: { low: 0, high: 0 } };
        setScenarioData({ bull: ph, base: ph, bear: ph, generated_at: "" });
        requestAnimationFrame(() => requestAnimationFrame(() => setScenarioVisible(true)));
      } else if (data?.bull) {
        setScenarioData(data as ScenarioData);
        requestAnimationFrame(() => requestAnimationFrame(() => setScenarioVisible(true)));
      }
    } finally { setScenarioLoading(false); }
  }

  // ── Visit tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/node/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: node.id }) }).catch(() => {});
  }, [node.id]);

  // ── Derived values ────────────────────────────────────────────────────────
  const displayPrice      = live?.price ?? 0;
  const displayMove       = live?.dailyMove ?? 0;
  const displayMoveDollar = live?.dailyMoveDollar ?? 0;
  const col  = moveColor(displayMove);
  const sign = displayMove >= 0 ? "+" : "";
  const dolSign = displayMove >= 0 ? "+" : "−";

  // Sentiment — aggregate from constituent stocks in admin_nodes
  const constituentTickers = stocks.map((s) => s.ticker);
  const sentimentScore = aggregateSentiment(constituentTickers);
  const sentimentCol   = sentimentScore != null ? (sentimentScore > 50 ? "#22c55e" : sentimentScore < 50 ? "#ef4444" : "#64748b") : "#64748b";

  // Constituents — intersection of ETF holdings AND tracked admin_nodes stocks.
  // Filter first, then slice, so we show up to 12 *tracked* holdings, not 12
  // arbitrary ETF holdings that may not be in the graph.
  const knownTickers = new Set(stocks.map((s) => s.ticker));
  const cachedMd     = getCachedMarketData();
  const constituents = holdings
    .filter((h) => knownTickers.has(h.symbol))
    .slice(0, 12)
    .map((h) => ({ ...h, liveMove: cachedMd?.[h.symbol]?.dailyMove ?? null }));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif', color: "#f1f5f9" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 32px 0" }}>
        <button onClick={() => router.push("/graph")} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 13, fontWeight: 400, padding: 0, fontFamily: "inherit" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Graph
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 32px 80px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: `${nodeTypeColor}18`, border: `1px solid ${nodeTypeColor}40`, color: nodeTypeColor, letterSpacing: "0.07em", textTransform: "uppercase" }}>{typeLabel}</span>
                {hasEtf && <span style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{etf}</span>}
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1.1, color: "#f1f5f9", marginBottom: 4 }}>{name}</div>
            </div>

            {hasEtf && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {!loaded ? (
                  <><div style={{ height: 40, width: 132, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 8 }} /><div style={{ height: 18, width: 88, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginLeft: "auto" }} /></>
                ) : (
                  <>
                    <div style={{ fontSize: 34, fontWeight: 600, color: "#f1f5f9", lineHeight: 1, marginBottom: 6 }}>
                      {displayPrice > 0 ? `$${displayPrice.toFixed(2)}` : "—"}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: col }}>
                      {displayPrice > 0 ? `${sign}${displayMove.toFixed(2)}%` : "—"}
                      {displayPrice > 0 && <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 10, color: col + "aa" }}>{dolSign}${Math.abs(displayMoveDollar).toFixed(2)}</span>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {hasEtf && (
              <>
                {wlFlash === "limit" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Watchlist full ({FREE_TIER_CAP}/{FREE_TIER_CAP})</span>
                    <UpgradeButton label="Upgrade to Pro" />
                  </div>
                ) : (
                  <button onClick={handleAddToWatchlist} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", background: inWatchlist ? "rgba(34,197,94,0.07)" : "rgba(59,130,246,0.07)", border: inWatchlist ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(59,130,246,0.22)", borderRadius: 8, color: inWatchlist ? "#22c55e" : "#3b82f6", fontSize: 13, fontWeight: 400, cursor: "pointer", fontFamily: "inherit" }}>
                    {wlFlash === "added" ? "✓ Added" : wlFlash === "duplicate" ? "Already in watchlist" : inWatchlist ? <><span style={{ fontSize: 13 }}>✓</span>Watchlist</> : <><span style={{ fontSize: 16 }}>+</span>Watchlist</>}
                  </button>
                )}
                {rsData && rsData.vs1m != null && Math.abs(rsData.vs1m) >= 1 && (
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "4px 9px", borderRadius: 6, flexShrink: 0, color: RS_TREND_COLOR[rsData.trend], background: RS_TREND_COLOR[rsData.trend] + "15", border: `1px solid ${RS_TREND_COLOR[rsData.trend]}30` }}>
                    {`${rsData.vs1m >= 0 ? "↑ +" : "↓ "}${rsData.vs1m.toFixed(1)}% vs SPY (1M)`}
                  </span>
                )}
              </>
            )}
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: "#1e293b", lineHeight: 1.6 }}>Market data is delayed. Nothing on this page constitutes financial advice.</div>
        </div>

        {/* ── Overview ────────────────────────────────────────────────────── */}
        <Section title={`${typeLabel} Overview`}>
          {overview ? (
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.85, fontWeight: 300, margin: 0 }}>
              {overview.slice(0, 600)}{overview.length > 600 ? "…" : ""}
            </p>
          ) : overviewLoading ? (
            <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Overview is being generated — check back in a moment.</p>
          ) : (
            <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
              {hasEtf ? `${name} tracked via ${etf}. Generate a deeper dive below for AI analysis.` : `Generate a deeper dive below for AI analysis of this ${typeLabel.toLowerCase()}.`}
            </p>
          )}
        </Section>

        {/* ── Deeper Dive ──────────────────────────────────────────────────── */}
        <Section title="Deeper dive">
          <style>{`@keyframes vauric-spin{to{transform:rotate(360deg)}}`}</style>
          {!analysis && !analysisLoading && !analysisError && (
            <button onClick={handleGenerateAnalysis} style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, color: "#3b82f6", fontSize: 13, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" }}>Generate deeper dive</button>
          )}
          {analysisLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "vauric-spin 1s linear infinite", flexShrink: 0 }}><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" /></svg>
              <span style={{ fontSize: 13, color: "#475569" }}>{ANALYSIS_MSGS[analysisMsgIdx]}</span>
            </div>
          )}
          {analysisError && !analysisLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Analysis temporarily unavailable — please try again.</p>
              <button onClick={handleGenerateAnalysis} style={{ alignSelf: "flex-start", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#475569", fontSize: 12, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>Try again</button>
            </div>
          )}
          {analysis && !analysisLoading && (
            <div style={{ opacity: analysisVisible ? 1 : 0, transition: "opacity 0.5s ease" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 14 }}>
                {([["segments", labels.segments], ["margins", labels.margins], ["guidance", labels.guidance], ["relationships", labels.relationships]] as [keyof AnalysisData, string][]).filter(([k]) => analysis[k]).map(([k, label]) => (
                  <div key={k as string}>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, fontWeight: 300, margin: 0 }}>{analysis[k] as string}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#334155", margin: 0 }}>Last updated: {daysAgo(analysis.last_generated_at)}</p>
            </div>
          )}
        </Section>

        {/* ── Scenarios ───────────────────────────────────────────────────── */}
        <Section title="Scenarios">
          {!isPro ? (
            <div style={{ padding: "12px 0 4px" }}>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>Bull/base/bear scenario analysis is a Pro feature.</p>
              <UpgradeButton label="Upgrade to Pro" />
            </div>
          ) : (
            <div>
              {!scenarioData && !scenarioLoading && (
                <div style={{ padding: "8px 0 4px" }}>
                  <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>Generate AI-powered scenarios for {name}.{hasEtf ? ` Includes price targets for ${etf}.` : ""}</p>
                  <button onClick={handleGenerateScenarios} style={{ background: "#3b82f6", border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 500, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" }}>Generate scenarios</button>
                </div>
              )}
              {scenarioLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "vauric-spin 1s linear infinite", flexShrink: 0 }}><circle cx="8" cy="8" r="6" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="2" /><path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" /></svg>
                  <span style={{ fontSize: 13, color: "#475569" }}>{SCENARIO_MSGS[scenarioMsgIdx]}</span>
                </div>
              )}
              {scenarioData && !scenarioLoading && (() => {
                const TABS = [{ key: "bull" as const, label: "Bull", color: "#22c55e" }, { key: "base" as const, label: "Base", color: "#64748b" }, { key: "bear" as const, label: "Bear", color: "#ef4444" }];
                const active = scenarioData[scenarioTab];
                const activeColor = TABS.find((t) => t.key === scenarioTab)!.color;
                const timeframes = [{ key: "6m" as const, label: "6 months", targetKey: "target6m" as const, targetLabel: hasEtf ? `6M ${etf}` : "6M" }, { key: "1y" as const, label: "1 year", targetKey: "target1y" as const, targetLabel: hasEtf ? `1Y ${etf}` : "1Y" }, { key: "2y" as const, label: "2+ years", targetKey: "target2y" as const, targetLabel: hasEtf ? `2Y ${etf}` : "2Y" }];
                const isTracked = !!trackedTheses[scenarioTab];
                const inFlight  = trackingInFlight.has(scenarioTab);
                async function toggleTrack() {
                  if (!user || inFlight) return;
                  setTrackingInFlight((s) => new Set(s).add(scenarioTab));
                  try {
                    if (isTracked) { await authFetch(`/api/thesis-tracking?id=${trackedTheses[scenarioTab]}`, { method: "DELETE" }); setTrackedTheses((m) => { const n = { ...m }; delete n[scenarioTab]; return n; }); }
                    else { const r = await authFetch("/api/thesis-tracking", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, ticker: analysisKey, scenario: scenarioTab }) }); if (r.ok) { const d = await r.json() as { id?: string }; if (d?.id) setTrackedTheses((m) => ({ ...m, [scenarioTab]: d.id! })); } }
                  } catch { /* ignore */ }
                  finally { setTrackingInFlight((s) => { const n = new Set(s); n.delete(scenarioTab); return n; }); }
                }
                return (
                  <div style={{ opacity: scenarioVisible ? 1 : 0, transition: "opacity 0.5s ease" }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
                      {TABS.map((t) => { const a = scenarioTab === t.key; return (<button key={t.key} onClick={() => setScenarioTab(t.key)} style={{ padding: "6px 16px", borderRadius: 7, fontSize: 13, fontFamily: "inherit", cursor: "pointer", fontWeight: a ? 600 : 400, background: a ? `${t.color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${a ? t.color + "50" : "rgba(255,255,255,0.08)"}`, color: a ? t.color : "#64748b" }}>{t.label}</button>); })}
                      <button onClick={toggleTrack} disabled={inFlight} title={isTracked ? "Stop tracking" : "Track this thesis"} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontFamily: "inherit", cursor: inFlight ? "default" : "pointer", background: isTracked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${isTracked ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)"}`, color: isTracked ? "#3b82f6" : "#475569", opacity: inFlight ? 0.5 : 1 }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 2a4.5 4.5 0 00-4.5 4.5V10L2 12h12l-1.5-2V6.5A4.5 4.5 0 008 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                        {inFlight ? "…" : isTracked ? "Tracking" : "Track thesis"}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      {timeframes.map((tf) => { const tgt = active[tf.targetKey]; return (<div key={tf.key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}><div style={{ fontSize: 10, fontWeight: 600, color: activeColor, letterSpacing: "0.07em", textTransform: "uppercase" }}>{tf.label}</div>{hasEtf && tgt && (tgt.low > 0 || tgt.high > 0) && (<span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: `${activeColor}18`, border: `1px solid ${activeColor}40`, color: activeColor }}>{tf.targetLabel}: ${tgt.low.toLocaleString()} – ${tgt.high.toLocaleString()}</span>)}</div><div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{active[tf.key]}</div></div>); })}
                    </div>
                    <p style={{ fontSize: 11, color: "#334155", margin: 0 }}>AI-generated · {daysAgo(scenarioData.generated_at)} · Not financial advice.</p>
                  </div>
                );
              })()}
            </div>
          )}
        </Section>

        {/* ── Key Metrics (ETF nodes only) ─────────────────────────────────── */}
        {hasEtf && (
          <Section title="Key Metrics">
            {fundamentals ? (
              <div style={{ display: "flex", flexWrap: "wrap", rowGap: 22 }}>
                {buildEtfMetrics(fundamentals).map(({ label, value }) => (
                  <div key={label} style={{ width: "33.333%", paddingRight: 24 }}>
                    <div style={{ fontSize: 11, color: "#334155", fontWeight: 400, marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Loading metrics…</p>
            )}
          </Section>
        )}

        {/* ── Relative Strength (ETF only) ─────────────────────────────────── */}
        {hasEtf && (
          <Section title="Relative Strength">
            {rsLoading ? (
              <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Loading…</p>
            ) : !rsData ? (
              <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>No relative strength data available.</p>
            ) : (
              <>
                {[{ label: "1W", value: rsData.vs1w }, { label: "1M", value: rsData.vs1m }, { label: "3M", value: rsData.vs3m }].map(({ label, value }) => (
                  <RSBarRow key={label} label={label} value={value} />
                ))}
                <p style={{ fontSize: 11, color: "#334155", margin: "4px 0 0" }}>Performance relative to SPY. Positive = outperforming.</p>
              </>
            )}
          </Section>
        )}

        {/* ── Sentiment (only when ≥3 constituent stocks have data) ─────────── */}
        {sentimentScore != null && (
          <Section title="Sentiment Tracker">
            <div style={{ maxWidth: 540, margin: "0 auto" }}>
              <div style={{ position: "relative", height: 6, borderRadius: 3, background: "linear-gradient(to right, rgba(239,68,68,0.4), rgba(100,116,139,0.15) 50%, rgba(34,197,94,0.4))", marginBottom: 10 }}>
                <div style={{ position: "absolute", top: "50%", left: `${sentimentScore}%`, transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: "#3b82f6", boxShadow: "0 0 10px #3b82f699", border: "2px solid #07090f" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <span style={{ fontSize: 11, color: "#ef444488" }}>Bearish</span>
                <span style={{ fontSize: 11, color: "#22c55e88" }}>Bullish</span>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 600, color: sentimentCol, marginBottom: 6 }}>{sentimentScore}% Bullish</div>
                <div style={{ fontSize: 12, color: "#334155" }}>Based on news sentiment of {constituentTickers.length} constituents</div>
              </div>
            </div>
          </Section>
        )}

        {/* ── Top Constituents (ETF only) ──────────────────────────────────── */}
        {hasEtf && (
          <Section title="Top Constituents">
            {constituents.length > 0 ? (
              <>
                <p style={{ fontSize: 12, color: "#334155", margin: "0 0 16px" }}>From {etf} holdings · Top {constituents.length} positions</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
                  {constituents.map((h) => {
                    const mv   = h.liveMove;
                    const c    = mv != null ? moveColor(mv) : "#64748b";
                    const isKnown = knownTickers.has(h.symbol);
                    return (
                      <button key={h.symbol} onClick={() => isKnown && router.push(`/stock/${h.symbol}`)}
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 12px", cursor: isKnown ? "pointer" : "default", fontFamily: "inherit", textAlign: "left" }}
                        onMouseEnter={(e) => { if (isKnown) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)"; }}
                      >
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", marginBottom: 4 }}>{h.symbol}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: c }}>{mv != null ? `${mv >= 0 ? "+" : ""}${mv.toFixed(1)}%` : "—"}</div>
                        <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{(h.holdingPercent * 100).toFixed(1)}%</div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Holdings data is loading or unavailable for {etf}.</p>
            )}
          </Section>
        )}

        {/* ── News ────────────────────────────────────────────────────────── */}
        <Section title="News">
          {newsLoading ? (
            <div style={{ fontSize: 13, color: "#334155" }}>Loading…</div>
          ) : news.length === 0 ? (
            <div style={{ fontSize: 13, color: "#334155" }}>No recent news available.</div>
          ) : (
            <div>
              {news.map((item, i) => (
                <div key={item.id} onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")} style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: i < news.length - 1 ? 18 : 0, marginBottom: i < news.length - 1 ? 18 : 0, borderBottom: i < news.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", cursor: item.url ? "pointer" : "default" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 5, fontWeight: 400 }}>{item.headline}</div>
                    <div style={{ fontSize: 12, color: "#334155" }}>{item.source ?? ""} · {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}
