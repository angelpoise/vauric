"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { moveColor } from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";
import {
  WATCHLIST_EVENT,
  getWatchlist,
  removeFromWatchlist,
} from "@/lib/watchlist";

const SKIP_CONFIRM_KEY = "vauric_wl_skip_confirm";

const TAB_W = 28;
const PANEL_W = 280;

const STOCK_NAMES: Record<string, string> = {
  NVDA: "NVIDIA",
  MSFT: "Microsoft",
  PLTR: "Palantir",
  AMD: "AMD",
  ARM: "Arm Holdings",
  SMCI: "Super Micro Computer",
  XOM: "ExxonMobil",
  CVX: "Chevron",
  FANG: "Diamondback Energy",
  SLB: "SLB",
  HIMS: "Hims & Hers",
  RXRX: "Recursion Pharma",
  LLY: "Eli Lilly",
  MRNA: "Moderna",
  SOFI: "SoFi Technologies",
  AFRM: "Affirm",
  PYPL: "PayPal",
  COIN: "Coinbase",
  HOOD: "Robinhood",
};

interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }

export default function WatchlistPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tickers, setTickers] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<Record<string, LiveEntry> | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [skipConfirm, setSkipConfirm] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SKIP_CONFIRM_KEY) === "1";
  });

  const sync = useCallback(() => { setTickers(getWatchlist()); }, []);

  useEffect(() => {
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sync]);

  // Fetch market data when panel opens (uses shared cache — no extra API call if cache warm)
  useEffect(() => {
    if (!open) return;
    const cached = getCachedMarketData();
    if (cached) { setMarketData(cached); return; }
    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json) { setCachedMarketData(json); setMarketData(json); }
      })
      .catch(() => {});
  }, [open]);

  function handleRemoveClick(ticker: string) {
    if (skipConfirm) {
      removeFromWatchlist(ticker);
    } else {
      setPendingRemove((prev) => prev === ticker ? null : ticker);
    }
  }

  function handleConfirmYes() {
    if (pendingRemove) removeFromWatchlist(pendingRemove);
    setPendingRemove(null);
  }

  function handleSkipToggle(checked: boolean) {
    setSkipConfirm(checked);
    if (checked) localStorage.setItem(SKIP_CONFIRM_KEY, "1");
    else localStorage.removeItem(SKIP_CONFIRM_KEY);
  }

  return (
    // Outer wrapper: full width = TAB_W + PANEL_W.
    // When closed, translateX(PANEL_W) keeps the tab (left TAB_W px) visible at viewport edge.
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100vh",
        width: TAB_W + PANEL_W,
        zIndex: 50,
        transform: open ? "translateX(0)" : `translateX(${PANEL_W}px)`,
        transition: "transform 0.25s ease",
        // Pass pointer events through the untranslated dead zone
        pointerEvents: "none",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
      }}
    >
      {/* ── Tab toggle ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: TAB_W,
          height: 120,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRight: "none",
          borderRadius: "6px 0 0 6px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "auto",
          padding: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "#475569",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            transform: "rotate(-90deg)",
            fontFamily: "inherit",
          }}
        >
          Watchlist
        </span>
      </button>

      {/* ── Panel body ─────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: TAB_W,
          top: 0,
          width: PANEL_W,
          height: "100%",
          background: "#0d1117",
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
          overflowY: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 16px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", fontSize: 13, fontWeight: 500, color: "#f1f5f9" }}>
            My Watchlist
          </span>
        </div>

        {/* Stock list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {tickers.length === 0 ? (
            <div
              style={{
                padding: "40px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                textAlign: "center",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.2 }}>
                <polygon
                  points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <p
                style={{
                  fontSize: 12,
                  color: "#334155",
                  lineHeight: 1.7,
                  margin: 0,
                  fontWeight: 300,
                }}
              >
                No stocks in your watchlist.
                <br />
                Navigate to a stock page and click{" "}
                <span style={{ color: "#475569" }}>+ Watchlist</span> to add.
              </p>
            </div>
          ) : (
            tickers.map((ticker) => {
              const live = marketData?.[ticker];
              const move = live?.dailyMove ?? null;
              const price = live?.price ?? null;
              const col = move != null ? moveColor(move) : "#475569";
              const sign = (move ?? 0) >= 0 ? "+" : "";
              const confirming = pendingRemove === ticker;
              return (
                <div
                  key={ticker}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                >
                  {/* Main row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 16px",
                      transition: "background 0.12s ease",
                      background: confirming ? "rgba(255,255,255,0.02)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!confirming) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      if (!confirming) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    {/* Clickable info area */}
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                      onClick={() => router.push(`/stock/${ticker}`)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>
                          {ticker}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: col }}>
                          {move != null ? `${sign}${move.toFixed(2)}%` : "—"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: "#334155",
                            fontWeight: 300,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {STOCK_NAMES[ticker] ?? ticker}
                        </span>
                        <span style={{ fontSize: 11, color: "#475569", flexShrink: 0, marginLeft: 8 }}>
                          {price != null ? `$${price.toFixed(2)}` : "—"}
                        </span>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemoveClick(ticker)}
                      title="Remove from watchlist"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: confirming ? "#475569" : "#1e293b",
                        fontSize: 18,
                        lineHeight: 1,
                        padding: "2px 4px",
                        borderRadius: 4,
                        flexShrink: 0,
                        transition: "color 0.12s",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = confirming ? "#475569" : "#1e293b";
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Inline confirmation popup */}
                  {confirming && (
                    <div
                      style={{
                        padding: "10px 16px 14px",
                        borderTop: "1px solid rgba(255,255,255,0.05)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 10px 0", lineHeight: 1.5 }}>
                        Remove <span style={{ fontWeight: 600, color: "#f1f5f9" }}>{ticker}</span> from watchlist?
                      </p>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <button
                          onClick={handleConfirmYes}
                          style={{
                            flex: 1,
                            padding: "5px 0",
                            background: "rgba(239,68,68,0.1)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 6,
                            color: "#ef4444",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setPendingRemove(null)}
                          style={{
                            flex: 1,
                            padding: "5px 0",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.09)",
                            borderRadius: 6,
                            color: "#64748b",
                            fontSize: 12,
                            fontWeight: 400,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          No
                        </button>
                      </div>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={skipConfirm}
                          onChange={(e) => handleSkipToggle(e.target.checked)}
                          style={{ accentColor: "#475569", width: 12, height: 12, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 11, color: "#334155", fontWeight: 300 }}>
                          Don&apos;t ask again
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
