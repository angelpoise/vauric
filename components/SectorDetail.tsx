"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type NotifType, NOTIF, moveColor } from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  headline: string;
  source: string;
  date: string;
  type: NotifType;
}

interface ConstituentStock {
  ticker: string;
  name: string;
  marketCap: number;
  placeholderMove: number;
  notifications: Array<{ type: NotifType }>;
}

interface SectorData {
  name: string;
  etf: string;
  etfFullName: string;
  placeholderPrice: number;
  description: string;
  staticMetrics: Array<{ label: string; value: string }>;
  constituents: ConstituentStock[];
  news: NewsItem[];
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

const SECTOR_DB: Record<string, SectorData> = {
  tech: {
    name: "Technology",
    etf: "XLK",
    etfFullName: "Technology Select Sector SPDR Fund",
    placeholderPrice: 224.18,
    description:
      "The Technology sector encompasses companies that develop and sell software, hardware, semiconductors, and IT services that power the modern digital economy. It is the largest sector by market capitalisation in the S&P 500 and is disproportionately driven by a small number of mega-cap platform businesses and chipmakers. Structural tailwinds from AI infrastructure build-out, cloud migration, and enterprise software adoption continue to support long-term growth above the broader market.",
    staticMetrics: [
      { label: "52-Week High",    value: "$238.47" },
      { label: "52-Week Low",     value: "$173.52" },
      { label: "YTD Performance", value: "+8.4%"   },
      { label: "AUM",             value: "$68.2 B"  },
    ],
    constituents: [
      { ticker: "NVDA", name: "NVIDIA",               marketCap: 2720, placeholderMove:  5.2, notifications: [{ type: "earnings" }] },
      { ticker: "MSFT", name: "Microsoft",             marketCap: 2890, placeholderMove:  0.9, notifications: [] },
      { ticker: "PLTR", name: "Palantir",              marketCap:  245, placeholderMove:  3.1, notifications: [{ type: "news" }] },
      { ticker: "AMD",  name: "AMD",                   marketCap:  168, placeholderMove:  2.4, notifications: [] },
      { ticker: "ARM",  name: "Arm Holdings",          marketCap:  128, placeholderMove:  4.8, notifications: [{ type: "earnings" }] },
      { ticker: "SMCI", name: "Super Micro Computer",  marketCap:   24, placeholderMove:  2.8, notifications: [{ type: "analyst" }] },
    ],
    news: [
      { headline: "AI infrastructure capex hits record $200 B in Q1 across hyperscalers",   source: "Bloomberg",    date: "Apr 28, 2026", type: "news"    },
      { headline: "Semiconductor equipment orders surge on new fab investment cycle",        source: "Reuters",      date: "Apr 24, 2026", type: "news"    },
      { headline: "XLK upgraded to Overweight at Morgan Stanley on AI earnings visibility", source: "Morgan Stanley",date: "Apr 20, 2026", type: "analyst" },
    ],
  },
  energy: {
    name: "Energy",
    etf: "XLE",
    etfFullName: "Energy Select Sector SPDR Fund",
    placeholderPrice: 93.42,
    description:
      "The Energy sector includes companies involved in the exploration, production, refining, and transportation of oil and natural gas, as well as energy equipment and services providers. It is a cyclical sector whose performance is highly correlated with commodity prices and global demand expectations. While facing long-term headwinds from the energy transition, near-term free cash flow generation remains elevated relative to historical norms.",
    staticMetrics: [
      { label: "52-Week High",    value: "$102.18" },
      { label: "52-Week Low",     value: "$79.34"  },
      { label: "YTD Performance", value: "−4.2%"  },
      { label: "AUM",             value: "$32.6 B"  },
    ],
    constituents: [
      { ticker: "XOM",  name: "ExxonMobil",         marketCap: 482, placeholderMove: -1.2, notifications: [{ type: "analyst" }] },
      { ticker: "CVX",  name: "Chevron",             marketCap: 268, placeholderMove: -0.9, notifications: [] },
      { ticker: "SLB",  name: "SLB",                 marketCap:  41, placeholderMove: -1.8, notifications: [{ type: "squeeze" }] },
      { ticker: "FANG", name: "Diamondback Energy",  marketCap:  34, placeholderMove:  2.1, notifications: [] },
    ],
    news: [
      { headline: "Brent crude slides 3% on China demand miss; energy sector leads declines", source: "Reuters",   date: "Apr 27, 2026", type: "news"    },
      { headline: "Permian Basin output reaches record 6.8 million barrels per day",          source: "Bloomberg", date: "Apr 23, 2026", type: "news"    },
      { headline: "Goldman cuts XLE target; sector underperformance to persist near-term",    source: "Goldman Sachs",date: "Apr 18, 2026", type: "analyst" },
    ],
  },
  health: {
    name: "Healthcare",
    etf: "XLV",
    etfFullName: "Health Care Select Sector SPDR Fund",
    placeholderPrice: 143.76,
    description:
      "The Healthcare sector covers pharmaceutical companies, biotechnology, medical devices, managed care, and healthcare services. It tends to be more defensive than the broader market, with revenues supported by demographic ageing and the non-discretionary nature of medical spending. GLP-1 obesity and diabetes treatments have become a dominant theme, reshaping both drug company valuations and broader healthcare cost expectations.",
    staticMetrics: [
      { label: "52-Week High",    value: "$162.84" },
      { label: "52-Week Low",     value: "$124.11" },
      { label: "YTD Performance", value: "−2.8%"  },
      { label: "AUM",             value: "$38.4 B"  },
    ],
    constituents: [
      { ticker: "LLY",  name: "Eli Lilly",        marketCap: 695, placeholderMove: -0.6, notifications: [] },
      { ticker: "MRNA", name: "Moderna",           marketCap:  14, placeholderMove: -2.3, notifications: [] },
      { ticker: "HIMS", name: "Hims & Hers",      marketCap:   9, placeholderMove: 12.3, notifications: [{ type: "news" }, { type: "analyst" }] },
      { ticker: "RXRX", name: "Recursion Pharma", marketCap:   2, placeholderMove:  4.1, notifications: [{ type: "analyst" }] },
    ],
    news: [
      { headline: "GLP-1 drug market projected to reach $150 B by 2030 — report",            source: "STAT News",  date: "Apr 28, 2026", type: "news"    },
      { headline: "FDA approves new Alzheimer's treatment; biotech names rally",              source: "Bloomberg",  date: "Apr 24, 2026", type: "news"    },
      { headline: "UBS upgrades XLV to Buy citing defensive characteristics in volatile tape",source: "UBS",        date: "Apr 19, 2026", type: "analyst" },
    ],
  },
  finance: {
    name: "Finance",
    etf: "XLF",
    etfFullName: "Financial Select Sector SPDR Fund",
    placeholderPrice: 45.21,
    description:
      "The Finance sector encompasses banks, insurance companies, asset managers, fintech platforms, and diversified financial services firms. It is sensitive to interest rate expectations, credit conditions, and regulatory changes. The current cycle has seen traditional banks benefit from elevated net interest margins while fintech disruptors compete aggressively on digital lending, payments, and investment platforms.",
    staticMetrics: [
      { label: "52-Week High",    value: "$50.34"  },
      { label: "52-Week Low",     value: "$37.82"  },
      { label: "YTD Performance", value: "+3.1%"   },
      { label: "AUM",             value: "$44.8 B"  },
    ],
    constituents: [
      { ticker: "PYPL", name: "PayPal",             marketCap: 68, placeholderMove: -0.8, notifications: [] },
      { ticker: "COIN", name: "Coinbase",           marketCap: 62, placeholderMove:  6.1, notifications: [{ type: "split" }] },
      { ticker: "HOOD", name: "Robinhood",          marketCap: 21, placeholderMove:  5.4, notifications: [] },
      { ticker: "AFRM", name: "Affirm",             marketCap: 14, placeholderMove:  3.8, notifications: [] },
      { ticker: "SOFI", name: "SoFi Technologies",  marketCap:  8, placeholderMove:  4.2, notifications: [{ type: "news" }] },
    ],
    news: [
      { headline: "Fintech IPO pipeline builds; three companies file S-1s in a single week", source: "Bloomberg",  date: "Apr 27, 2026", type: "news"    },
      { headline: "Fed holds rates steady; financial sector reprices on longer higher outlook",source: "Reuters",    date: "Apr 23, 2026", type: "news"    },
      { headline: "Barclays upgrades XLF on net interest margin resilience",                  source: "Barclays",   date: "Apr 17, 2026", type: "analyst" },
    ],
  },
  consumer: {
    name: "Consumer Discretionary",
    etf: "XLY",
    etfFullName: "Consumer Discretionary Select Sector SPDR Fund",
    placeholderPrice: 196.44,
    description:
      "The Consumer Discretionary sector includes companies that sell non-essential goods and services — from e-commerce and retail to restaurants, hotels, and automotive. It is one of the most economically sensitive sectors, performing strongly during expansions and declining sharply during recessions. Current consumer spending resilience is being tested by student loan repayments, credit card delinquency trends, and persistent shelter inflation.",
    staticMetrics: [
      { label: "52-Week High",    value: "$224.82" },
      { label: "52-Week Low",     value: "$163.27" },
      { label: "YTD Performance", value: "−6.4%"  },
      { label: "AUM",             value: "$19.3 B"  },
    ],
    constituents: [],
    news: [
      { headline: "US consumer confidence falls to 18-month low on tariff uncertainty",       source: "Reuters",    date: "Apr 28, 2026", type: "news"    },
      { headline: "E-commerce penetration reaches 22% of total retail — census data",        source: "Bloomberg",  date: "Apr 22, 2026", type: "news"    },
      { headline: "Analyst downgrades XLY to Neutral; flags softening spending signals",     source: "Jefferies",  date: "Apr 16, 2026", type: "analyst" },
    ],
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 0",
          cursor: "pointer",
          fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }}
        >
          <path d="M4 6L8 10L12 6" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div style={{ overflow: "hidden", maxHeight: open ? "4000px" : "0", transition: "max-height 0.3s ease" }}>
        <div style={{ paddingTop: 20, paddingBottom: 28 }}>{children}</div>
      </div>
    </div>
  );
}

function NewsChip({ type }: { type: NotifType }) {
  const n = NOTIF[type];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: n.color + "18", border: `1px solid ${n.color}35`, borderRadius: 20, padding: "3px 10px 3px 7px", flexShrink: 0 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.color }} />
      <span style={{ fontSize: 11, color: n.color, fontWeight: 400, whiteSpace: "nowrap" }}>{n.label}</span>
    </div>
  );
}

function PlaceholderLink({ label }: { label: string }) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "#3b82f6", fontSize: 14, textDecoration: "none", fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif', fontWeight: 300 }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7H11M8 4L11 7L8 10" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }

export default function SectorDetail({ id }: { id: string }) {
  const router = useRouter();
  const sector = SECTOR_DB[id];

  const [marketData, setMarketData] = useState<Record<string, LiveEntry> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fundamentalsData, setFundamentalsData] = useState<Record<string, { marketCap: number | null }> | null>(null);

  useEffect(() => {
    fetch("/api/fundamentals")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json) setFundamentalsData(json); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cached = getCachedMarketData();
    if (cached) {
      setMarketData(cached);
      setLoaded(true);
      return;
    }
    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json) { setCachedMarketData(json); setMarketData(json); }
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, []);

  if (!sector) {
    return (
      <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif', color: "#475569", fontSize: 14 }}>
        Unknown sector.{" "}
        <button onClick={() => router.push("/graph")} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 14, fontFamily: "inherit", marginLeft: 6 }}>
          Back to graph
        </button>
      </div>
    );
  }

  const etfLive = marketData?.[sector.etf];
  const displayPrice      = etfLive?.price       ?? sector.placeholderPrice;
  const displayMove       = etfLive?.dailyMove    ?? 0;
  const displayMoveDollar = etfLive != null ? Math.abs(etfLive.dailyMoveDollar) : 0;

  const col     = moveColor(displayMove);
  const sign    = displayMove >= 0 ? "+" : "";
  const dolSign = displayMove >= 0 ? "+" : "−";

  const perfMetrics: Array<{ label: string; value: string }> = [
    {
      label: "Daily Move",
      value: !loaded ? "—" : etfLive ? `${sign}${displayMove.toFixed(2)}%` : "—",
    },
    {
      label: "Daily Move $",
      value: !loaded ? "—" : etfLive ? `${dolSign}$${displayMoveDollar.toFixed(2)}` : "—",
    },
    ...sector.staticMetrics,
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#07090f", fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif', color: "#f1f5f9" }}>

      {/* Back button */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 32px 0" }}>
        <button
          onClick={() => router.push("/graph")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "#475569", fontSize: 13, fontWeight: 400, padding: 0, fontFamily: "inherit" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Graph
        </button>
      </div>

      {/* Main container */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 32px 80px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ paddingBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>

            {/* Name + ETF */}
            <div>
              <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "0.04em", lineHeight: 1, color: "#f1f5f9", marginBottom: 8 }}>
                {sector.name}
              </div>
              <div style={{ fontSize: 14, color: "#475569", fontWeight: 300 }}>
                {sector.etf} — {sector.etfFullName}
              </div>
            </div>

            {/* Price + move */}
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {!loaded ? (
                <>
                  <div style={{ height: 40, width: 132, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 18, width: 88, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginLeft: "auto" }} />
                </>
              ) : (
                <>
                  <div style={{ fontSize: 34, fontWeight: 600, color: "#f1f5f9", lineHeight: 1, marginBottom: 6 }}>
                    ${displayPrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: col }}>
                    {sign}{displayMove.toFixed(2)}%
                    <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 10, color: col + "aa" }}>
                      {dolSign}${displayMoveDollar.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: 11, color: "#1e293b", lineHeight: 1.6 }}>
            Market data is delayed. Nothing on this page constitutes financial advice.
          </div>
        </div>

        {/* ── Sections ────────────────────────────────────────────────────── */}

        <Section title="Sector Overview">
          <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.85, fontWeight: 300, margin: 0 }}>
            {sector.description}
          </p>
        </Section>

        <Section title="ETF Performance">
          <div style={{ display: "flex", flexWrap: "wrap", rowGap: 22 }}>
            {perfMetrics.map(({ label, value }) => (
              <div key={label} style={{ width: "33.333%", paddingRight: 24 }}>
                <div style={{ fontSize: 11, color: "#334155", fontWeight: 400, marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {label}
                </div>
                <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Constituent Stocks">
          {sector.constituents.length === 0 ? (
            <div style={{ fontSize: 13, color: "#334155" }}>No tracked constituents for this sector yet.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[...sector.constituents].sort((a, b) => {
                const capA = fundamentalsData?.[a.ticker]?.marketCap ?? a.marketCap;
                const capB = fundamentalsData?.[b.ticker]?.marketCap ?? b.marketCap;
                return capB - capA;
              }).map((stock) => {
                const liveMove = marketData?.[stock.ticker]?.dailyMove ?? stock.placeholderMove;
                const liveLoaded = loaded;
                const cardCol = liveLoaded ? moveColor(liveMove) : "rgb(100,116,139)";
                const cardSign = liveMove >= 0 ? "+" : "";
                return (
                  <button
                    key={stock.ticker}
                    onClick={() => router.push(`/stock/${stock.ticker}`)}
                    style={{
                      width: "calc(33.333% - 7px)",
                      minWidth: 160,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10,
                      padding: "14px 16px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "border-color 0.15s ease, background 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.14)";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.07)";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.02)";
                    }}
                  >
                    {/* Ticker row */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>
                        {stock.ticker}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: cardCol }}>
                          {cardSign}{liveMove.toFixed(2)}%
                        </span>
                        {stock.notifications.map((n, i) => (
                          <div
                            key={i}
                            title={NOTIF[n.type].label}
                            style={{ width: 7, height: 7, borderRadius: "50%", background: NOTIF[n.type].color, flexShrink: 0 }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Company name */}
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {stock.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Sector News">
          <div>
            {sector.news.map((item, i) => (
              <div
                key={i}
                style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingBottom: i < sector.news.length - 1 ? 18 : 0, marginBottom: i < sector.news.length - 1 ? 18 : 0, borderBottom: i < sector.news.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <div style={{ flexShrink: 0, paddingTop: 1 }}>
                  <NewsChip type={item.type} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 5, fontWeight: 400 }}>
                    {item.headline}
                  </div>
                  <div style={{ fontSize: 12, color: "#334155" }}>
                    {item.source} · {item.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="ETF Links">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PlaceholderLink label={`${sector.etf} ETF issuer page`} />
            <PlaceholderLink label="SEC EDGAR filings" />
          </div>
        </Section>
      </div>
    </div>
  );
}
