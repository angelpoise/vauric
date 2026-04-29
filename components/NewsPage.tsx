"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type NotifType, NOTIF } from "@/lib/graphTypes";
import { getWatchlist, WATCHLIST_EVENT } from "@/lib/watchlist";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  id: number;
  type: NotifType;
  headline: string;
  summary: string;
  source: string;
  date: string;
  ticker: string;
  sectorId: string;
}

type Tab = "all" | "watchlist" | "sector" | "search";

// ─── Static data ──────────────────────────────────────────────────────────────

const TICKER_SECTOR: Record<string, string> = {
  NVDA: "tech",  MSFT: "tech",   PLTR: "tech",  AMD: "tech",  ARM: "tech",  SMCI: "tech",
  XOM: "energy", CVX: "energy",  FANG: "energy", SLB: "energy",
  HIMS: "health", RXRX: "health", LLY: "health", MRNA: "health",
  SOFI: "finance", AFRM: "finance", PYPL: "finance", COIN: "finance", HOOD: "finance",
};

const SECTOR_LABELS: Record<string, string> = {
  tech: "Technology", energy: "Energy", health: "Healthcare",
  finance: "Finance", consumer: "Consumer",
};

const ALL_NEWS: NewsItem[] = [
  {
    id: 1, type: "earnings", ticker: "NVDA", sectorId: "tech",
    headline: "NVIDIA Q1 earnings smash estimates; data centre revenue up 427% year-over-year",
    summary: "NVIDIA reported $26.0 B in quarterly revenue, driven almost entirely by explosive demand for H100 and H200 GPUs from hyperscalers building out AI training infrastructure. Management guided Q2 revenue to $28.0 B, well ahead of the $24.6 B consensus.",
    source: "Bloomberg", date: "Apr 28, 2026",
  },
  {
    id: 2, type: "news", ticker: "HIMS", sectorId: "health",
    headline: "Hims & Hers surges 31% after FDA signals support for GLP-1 compounding extension",
    summary: "Shares of Hims & Hers rocketed after the FDA issued guidance suggesting it may allow compounding pharmacies to continue producing semaglutide formulations for an additional 18 months while supply shortages persist. The company is one of the largest compounding distributors of GLP-1 drugs.",
    source: "Reuters", date: "Apr 28, 2026",
  },
  {
    id: 3, type: "analyst", ticker: "PLTR", sectorId: "tech",
    headline: "Morgan Stanley raises Palantir target to $38; cites accelerating government AI contract pipeline",
    summary: "Analysts at Morgan Stanley upgraded their price target citing a 4× increase in AIP pilot programmes converting to full contracts and a growing backlog of US defence and intelligence agency deployments that peers cannot easily replicate.",
    source: "Morgan Stanley", date: "Apr 27, 2026",
  },
  {
    id: 4, type: "split", ticker: "COIN", sectorId: "finance",
    headline: "Coinbase added to S&P 500; index inclusion to take effect May 19",
    summary: "S&P Dow Jones Indices confirmed Coinbase will join the S&P 500 effective after the close on May 16. The inclusion is expected to trigger an estimated $10–12 B of passive buying from index-tracking funds, creating a structural demand event for the stock.",
    source: "Bloomberg", date: "Apr 27, 2026",
  },
  {
    id: 5, type: "analyst", ticker: "XOM", sectorId: "energy",
    headline: "Goldman Sachs downgrades ExxonMobil to Neutral on Permian output plateau risk",
    summary: "Goldman cited concerns that ExxonMobil's Permian Basin production growth is approaching a natural plateau as the highest-quality acreage is developed. The bank reduced its 12-month price target and flagged the risk of lower capital returns if Brent prices remain below $80.",
    source: "Goldman Sachs", date: "Apr 26, 2026",
  },
  {
    id: 6, type: "news", ticker: "AMD", sectorId: "tech",
    headline: "AMD MI300X orders accelerate as hyperscalers diversify away from NVIDIA",
    summary: "Multiple cloud providers have meaningfully increased purchase orders for AMD's MI300X accelerator as part of a deliberate strategy to reduce single-vendor dependency on NVIDIA. AMD management confirmed a new $1.5 B supply agreement with a major cloud customer during a recent industry conference.",
    source: "Reuters", date: "Apr 26, 2026",
  },
  {
    id: 7, type: "analyst", ticker: "RXRX", sectorId: "health",
    headline: "Recursion Pharma secures $150 M NVIDIA collaboration expansion for AI drug discovery",
    summary: "Recursion announced an expanded multi-year agreement with NVIDIA to access next-generation DGX systems for biological foundation model training. The partnership gives Recursion priority GPU access and joint go-to-market rights on enterprise AI drug discovery tooling.",
    source: "STAT News", date: "Apr 25, 2026",
  },
  {
    id: 8, type: "earnings", ticker: "SOFI", sectorId: "finance",
    headline: "SoFi Technologies beats Q1 estimates; member count crosses 10 million milestone",
    summary: "SoFi reported adjusted net revenue of $845 M, ahead of the $812 M consensus, with the personal loans segment benefiting from tightening bank credit standards pushing borrowers toward fintech alternatives. The company raised its full-year adjusted EBITDA guidance by $40 M.",
    source: "Bloomberg", date: "Apr 25, 2026",
  },
  {
    id: 9, type: "squeeze", ticker: "SLB", sectorId: "energy",
    headline: "SLB short interest spikes to 18-month high ahead of earnings amid oil demand concerns",
    summary: "Short interest in oilfield services giant SLB climbed to 9.2% of float, the highest level since late 2024, as investors position for potential revenue misses driven by international E&P spending cuts. Brent crude weakness has prompted several major operators to trim offshore project budgets.",
    source: "Reuters", date: "Apr 24, 2026",
  },
  {
    id: 10, type: "news", ticker: "MSFT", sectorId: "tech",
    headline: "Microsoft Azure AI revenue grows 33% as enterprise Copilot adoption accelerates",
    summary: "Microsoft disclosed that Azure AI services now represent 13% of total Azure revenue, up from 8% a year ago, with Copilot seat counts across Office 365 crossing 5 million paid users. Management highlighted strong cross-sell dynamics between Azure and the broader Microsoft 365 suite.",
    source: "Bloomberg", date: "Apr 24, 2026",
  },
  {
    id: 11, type: "earnings", ticker: "ARM", sectorId: "tech",
    headline: "Arm Holdings raises FY2026 guidance; royalty revenue from AI chips accelerates sharply",
    summary: "Arm reported royalty revenue growth of 37% year-over-year as its v9 architecture achieves deeper penetration in AI inference chips shipping from Qualcomm, Apple, and a range of custom silicon vendors. The company raised the midpoint of full-year royalty revenue guidance by 8%.",
    source: "Reuters", date: "Apr 23, 2026",
  },
  {
    id: 12, type: "news", ticker: "AFRM", sectorId: "finance",
    headline: "Affirm expands to UK market with Apple Pay integration targeting 50 M new users",
    summary: "Affirm announced its official UK launch in partnership with Apple Pay Later, giving it immediate distribution across Apple's UK device base. The company has secured agreements with five major UK retailers and expects the UK market to reach profitability within three years.",
    source: "Bloomberg", date: "Apr 23, 2026",
  },
  {
    id: 13, type: "analyst", ticker: "LLY", sectorId: "health",
    headline: "JPMorgan raises Eli Lilly target to $975; Zepbound demand exceeds manufacturing capacity",
    summary: "JPMorgan's healthcare team increased their price target after channel checks confirmed that Zepbound prescriptions continue to be supply-constrained rather than demand-constrained. The bank modelled an upside scenario where incremental manufacturing capacity unlocks an additional $6 B in annual revenue by 2027.",
    source: "JPMorgan", date: "Apr 22, 2026",
  },
  {
    id: 14, type: "news", ticker: "FANG", sectorId: "energy",
    headline: "Diamondback Energy raises quarterly dividend 7% on record Permian free cash flow",
    summary: "Diamondback declared a quarterly dividend of $0.94 per share, up from $0.88, after reporting record free cash flow generation from its Permian Basin operations. The company also announced a $2 B buyback programme, signalling confidence in sustained commodity prices and operational efficiency.",
    source: "Reuters", date: "Apr 22, 2026",
  },
  {
    id: 15, type: "delisting", ticker: "HOOD", sectorId: "finance",
    headline: "Robinhood acquires TradePMR for $300 M to enter registered investment adviser market",
    summary: "Robinhood announced the acquisition of TradePMR, a custodial platform serving over 350 registered investment advisers managing $40 B in assets. The move signals Robinhood's ambition to expand beyond retail brokerage into the lucrative wealth management and advisory services space.",
    source: "Bloomberg", date: "Apr 21, 2026",
  },
];

const FREE_TIER_LIMIT = 10;

// ─── Sub-components ───────────────────────────────────────────────────────────

function NotifChip({ type }: { type: NotifType }) {
  const n = NOTIF[type];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: n.color + "18", border: `1px solid ${n.color}35`,
      borderRadius: 20, padding: "3px 10px 3px 7px", flexShrink: 0,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.color }} />
      <span style={{ fontSize: 11, color: n.color, fontWeight: 400, whiteSpace: "nowrap" }}>{n.label}</span>
    </div>
  );
}

function TickerTag({ ticker, onClick }: { ticker: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.06)",
        border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: 5, padding: "2px 8px", cursor: "pointer",
        fontSize: 11, fontWeight: 700, color: "#3b82f6",
        letterSpacing: "0.04em", fontFamily: "inherit", flexShrink: 0,
        transition: "background 0.12s",
      }}
    >
      {ticker}
    </button>
  );
}

function NewsCard({ item, onTickerClick }: { item: NewsItem; onTickerClick: (t: string) => void }) {
  return (
    <div style={{
      padding: "22px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <NotifChip type={item.type} />
        <TickerTag ticker={item.ticker} onClick={() => onTickerClick(item.ticker)} />
        <span style={{ fontSize: 11, color: "#334155", marginLeft: "auto" }}>
          {item.source} · {item.date}
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.5, marginBottom: 8 }}>
        {item.headline}
      </div>
      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.75, fontWeight: 300 }}>
        {item.summary}
      </div>
    </div>
  );
}

function ProGate() {
  return (
    <div style={{ position: "relative", marginTop: -8 }}>
      {/* Blurred preview */}
      <div style={{ filter: "blur(4px)", opacity: 0.4, pointerEvents: "none", userSelect: "none" }}>
        {ALL_NEWS.slice(FREE_TIER_LIMIT).map((item) => (
          <div key={item.id} style={{ padding: "22px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <NotifChip type={item.type} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#e2e8f0", lineHeight: 1.5, marginBottom: 8 }}>
              {item.headline}
            </div>
          </div>
        ))}
      </div>
      {/* Lock overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, transparent 0%, #07090f 35%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          marginTop: 80, padding: "24px 32px", textAlign: "center",
          background: "rgba(13,17,23,0.9)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 20, marginBottom: 10 }}>🔒</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", marginBottom: 6 }}>
            Free tier limit reached
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 16, fontWeight: 300 }}>
            Showing {FREE_TIER_LIMIT} of {ALL_NEWS.length} stories
          </div>
          <button style={{
            padding: "8px 20px", background: "#3b82f6", border: "none",
            borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ padding: "60px 0", textAlign: "center", color: "#334155", fontSize: 13, fontWeight: 300 }}>
      {message}
    </div>
  );
}

function NewsList({ items, onTickerClick }: { items: NewsItem[]; onTickerClick: (t: string) => void }) {
  const visible = items.slice(0, FREE_TIER_LIMIT);
  const locked  = items.length > FREE_TIER_LIMIT;
  return (
    <>
      {visible.map((item) => (
        <NewsCard key={item.id} item={item} onTickerClick={onTickerClick} />
      ))}
      {locked && <ProGate />}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab]         = useState<Tab>("all");
  const [selectedSector, setSelectedSector] = useState("tech");
  const [searchQuery, setSearchQuery]     = useState("");
  const [watchlist, setWatchlist]         = useState<string[]>([]);
  const [showAiPop, setShowAiPop]         = useState(false);

  useEffect(() => {
    setWatchlist(getWatchlist());
    const onUpdate = () => setWatchlist(getWatchlist());
    window.addEventListener(WATCHLIST_EVENT, onUpdate);
    return () => window.removeEventListener(WATCHLIST_EVENT, onUpdate);
  }, []);

  const watchlistNews = useMemo(
    () => ALL_NEWS.filter((n) => watchlist.includes(n.ticker)),
    [watchlist],
  );

  const sectorNews = useMemo(
    () => ALL_NEWS.filter((n) => n.sectorId === selectedSector),
    [selectedSector],
  );

  const searchNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return ALL_NEWS.filter(
      (n) =>
        n.headline.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q)  ||
        n.ticker.toLowerCase().includes(q)   ||
        n.source.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",       label: "All News"   },
    { id: "watchlist", label: "Watchlist"  },
    { id: "sector",    label: "By Sector"  },
    { id: "search",    label: "Search"     },
  ];

  function handleTickerClick(ticker: string) {
    router.push(`/stock/${ticker}`);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#07090f",
      fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif', color: "#f1f5f9",
    }}>
      {/* Back button */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 32px 0" }}>
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

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 32px 80px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 28,
        }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, marginBottom: 10 }}>
              News
            </div>
            <div style={{ fontSize: 14, color: "#475569", fontWeight: 300 }}>
              Notification-worthy stories across the market
            </div>
          </div>

          {/* AI Summary button */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowAiPop((v) => !v)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, cursor: "pointer", color: "#475569",
                fontSize: 13, fontFamily: "inherit",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
              </svg>
            </button>

            {showAiPop && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, width: 280, zIndex: 10,
                background: "#111827", border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 10, padding: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#f1f5f9", marginBottom: 6 }}>
                  AI Market Summary
                </div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, marginBottom: 14, fontWeight: 300 }}>
                  AI-generated summaries of top stories, sentiment signals, and cross-stock themes are a Pro feature.
                </div>
                <button style={{
                  width: "100%", padding: "7px 0", background: "#3b82f6",
                  border: "none", borderRadius: 6, color: "#fff",
                  fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                }}>
                  Upgrade to Pro
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 2, marginBottom: 24,
          borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0,
        }}>
          {TABS.map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  padding: "9px 16px",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  color: active ? "#3b82f6" : "#475569",
                  borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
                  marginBottom: -1, fontFamily: "inherit",
                  transition: "color 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────── */}

        {/* All News */}
        {activeTab === "all" && (
          <NewsList items={ALL_NEWS} onTickerClick={handleTickerClick} />
        )}

        {/* Watchlist */}
        {activeTab === "watchlist" && (
          watchlistNews.length === 0 ? (
            <EmptyState message="Add stocks to your watchlist to see their news here." />
          ) : (
            <NewsList items={watchlistNews} onTickerClick={handleTickerClick} />
          )
        )}

        {/* By Sector */}
        {activeTab === "sector" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {Object.entries(SECTOR_LABELS).map(([id, label]) => {
                const active = selectedSector === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedSector(id)}
                    style={{
                      padding: "6px 14px",
                      background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                      border: active ? "1px solid rgba(59,130,246,0.35)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 20, cursor: "pointer",
                      fontSize: 12, fontWeight: active ? 500 : 400,
                      color: active ? "#3b82f6" : "#475569",
                      fontFamily: "inherit", transition: "all 0.12s",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {sectorNews.length === 0 ? (
              <EmptyState message={`No news for ${SECTOR_LABELS[selectedSector]} yet.`} />
            ) : (
              <NewsList items={sectorNews} onTickerClick={handleTickerClick} />
            )}
          </>
        )}

        {/* Search */}
        {activeTab === "search" && (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 24,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="4" stroke="#475569" strokeWidth="1.5" />
                <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by headline, ticker, or source…"
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontSize: 14, color: "#f1f5f9", fontFamily: "inherit", fontWeight: 300,
                }}
              />
            </div>
            {searchQuery.trim().length === 0 ? (
              <EmptyState message="Type to search headlines, tickers, or sources." />
            ) : searchNews.length === 0 ? (
              <EmptyState message={`No results for "${searchQuery.trim()}".`} />
            ) : (
              <NewsList items={searchNews} onTickerClick={handleTickerClick} />
            )}
          </>
        )}
      </div>

      {/* Close AI pop when clicking outside */}
      {showAiPop && (
        <div
          onClick={() => setShowAiPop(false)}
          style={{ position: "fixed", inset: 0, zIndex: 9 }}
        />
      )}
    </div>
  );
}
