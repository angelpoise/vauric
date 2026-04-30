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
  url: string;
}

type Tab = "all" | "watchlist" | "sector" | "search";

// ─── Static helpers ───────────────────────────────────────────────────────────

const TICKER_SECTOR: Record<string, string> = {
  NVDA: "tech",  MSFT: "tech",   PLTR: "tech",  AMD: "tech",  ARM: "tech",  SMCI: "tech",
  XOM: "energy", CVX: "energy",  FANG: "energy", SLB: "energy",
  HIMS: "health", RXRX: "health", LLY: "health",  MRNA: "health",
  SOFI: "finance", AFRM: "finance", PYPL: "finance", COIN: "finance", HOOD: "finance",
};

const SECTOR_LABELS: Record<string, string> = {
  tech: "Technology", energy: "Energy", health: "Healthcare",
  finance: "Finance", consumer: "Consumer",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface ApiArticle {
  id: number;
  ticker: string;
  headline: string;
  summary: string | null;
  source: string | null;
  url: string;
  published_at: string;
  notification_type: string;
}

function mapArticle(a: ApiArticle): NewsItem {
  return {
    id:       a.id,
    type:     (a.notification_type as NotifType) in {} ? (a.notification_type as NotifType) : "news",
    headline: a.headline,
    summary:  a.summary ?? "",
    source:   a.source  ?? "",
    url:      a.url     ?? "",
    date:     formatDate(a.published_at),
    ticker:   a.ticker,
    sectorId: TICKER_SECTOR[a.ticker] ?? "tech",
  };
}

const CLEAR_LIMIT        = 10; // fully visible articles
const BLUR_ABOVE_PROMPT  =  1; // blurred articles shown above the overlay prompt (article 11)
const BLUR_BEHIND_PROMPT =  4; // blurred articles behind the overlay prompt (articles 12-15)

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
    <div
      onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
      style={{
        padding: "22px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        cursor: item.url ? "pointer" : "default",
      }}
    >
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

function BlurredSection({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ filter: "blur(4px)", opacity: 0.4, pointerEvents: "none", userSelect: "none" }}>
      {items.map((item) => (
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
  );
}

function UpgradePrompt({ total }: { total: number }) {
  return (
    <div style={{
      padding: "24px 32px", textAlign: "center",
      background: "rgba(13,17,23,0.95)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 20, marginBottom: 10 }}>🔒</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", marginBottom: 6 }}>
        Free tier limit reached
      </div>
      <div style={{ fontSize: 12, color: "#475569", marginBottom: 16, fontWeight: 300 }}>
        Showing {CLEAR_LIMIT} of {total} stories
      </div>
      <button style={{
        padding: "8px 20px", background: "#3b82f6", border: "none",
        borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 500,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        Upgrade to Pro
      </button>
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
  const clear       = items.slice(0, CLEAR_LIMIT);
  const abovePrompt = items.slice(CLEAR_LIMIT, CLEAR_LIMIT + BLUR_ABOVE_PROMPT);
  const behindPrompt = items.slice(CLEAR_LIMIT + BLUR_ABOVE_PROMPT, CLEAR_LIMIT + BLUR_ABOVE_PROMPT + BLUR_BEHIND_PROMPT);
  const hasGate     = items.length > CLEAR_LIMIT;
  return (
    <>
      {clear.map((item) => (
        <NewsCard key={item.id} item={item} onTickerClick={onTickerClick} />
      ))}
      {hasGate && (
        <>
          {/* Article 11: one blurred article visible above the prompt */}
          <BlurredSection items={abovePrompt} />
          {/* Articles 12-15: blurred backdrop; prompt floats on top as an overlay */}
          <div style={{ position: "relative" }}>
            <BlurredSection items={behindPrompt} />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, transparent 0%, rgba(7,9,15,0.85) 40%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <UpgradePrompt total={items.length} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab]           = useState<Tab>("all");
  const [selectedSector, setSelectedSector] = useState("tech");
  const [searchQuery, setSearchQuery]       = useState("");
  const [watchlist, setWatchlist]           = useState<string[]>([]);
  const [showAiPop, setShowAiPop]           = useState(false);
  const [newsItems, setNewsItems]           = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading]       = useState(true);

  useEffect(() => {
    setWatchlist(getWatchlist());
    const onUpdate = () => setWatchlist(getWatchlist());
    window.addEventListener(WATCHLIST_EVENT, onUpdate);
    return () => window.removeEventListener(WATCHLIST_EVENT, onUpdate);
  }, []);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.ok ? r.json() : [])
      .then((data: ApiArticle[]) => {
        setNewsItems(Array.isArray(data) ? data.map(mapArticle) : []);
      })
      .catch(() => { setNewsItems([]); })
      .finally(() => { setNewsLoading(false); });
  }, []);

  const watchlistNews = useMemo(
    () => newsItems.filter((n) => watchlist.includes(n.ticker)),
    [newsItems, watchlist],
  );

  const sectorNews = useMemo(
    () => newsItems.filter((n) => n.sectorId === selectedSector),
    [newsItems, selectedSector],
  );

  const searchNews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return newsItems.filter(
      (n) =>
        n.headline.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q)  ||
        n.ticker.toLowerCase().includes(q)   ||
        n.source.toLowerCase().includes(q),
    );
  }, [newsItems, searchQuery]);

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
          newsLoading
            ? <EmptyState message="Loading news…" />
            : newsItems.length === 0
              ? <EmptyState message="No news available yet. The pipeline fetches stories hourly." />
              : <NewsList items={newsItems} onTickerClick={handleTickerClick} />
        )}

        {/* Watchlist */}
        {activeTab === "watchlist" && (
          newsLoading
            ? <EmptyState message="Loading news…" />
            : watchlistNews.length === 0
              ? <EmptyState message="Add stocks to your watchlist to see their news here." />
              : <NewsList items={watchlistNews} onTickerClick={handleTickerClick} />
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
            {newsLoading
              ? <EmptyState message="Loading news…" />
              : sectorNews.length === 0
                ? <EmptyState message={`No news for ${SECTOR_LABELS[selectedSector]} yet.`} />
                : <NewsList items={sectorNews} onTickerClick={handleTickerClick} />
            }
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
            {newsLoading
              ? <EmptyState message="Loading news…" />
              : searchQuery.trim().length === 0
                ? <EmptyState message="Type to search headlines, tickers, or sources." />
                : searchNews.length === 0
                  ? <EmptyState message={`No results for "${searchQuery.trim()}".`} />
                  : <NewsList items={searchNews} onTickerClick={handleTickerClick} />
            }
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
