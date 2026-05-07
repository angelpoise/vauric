"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser, useAuth } from "@clerk/nextjs";
import { RadarIcon } from "@/components/Logo";

export const MENU_COLLAPSED_W = 44;
export const MENU_EXPANDED_W = 180;

interface Props {
  expanded: boolean;
  onToggle: () => void;
  onSearchOpen: () => void;
  onFiltersOpen: () => void;
  onSettingsOpen: () => void;
}

interface UnreadAlert {
  id: string;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  triggered_at: string | null;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line x1="2" y1="4.5"  x2="14" y2="4.5"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="8"    x2="14" y2="8"    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="11.5" x2="14" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2a4.5 4.5 0 00-4.5 4.5V10L2 12h12l-1.5-2V6.5A4.5 4.5 0 008 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 2.5h11l-4 5.5v4.5l-3-1.5V8L2.5 2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2"  y="9"  width="3" height="5" rx="0.75" fill="currentColor" opacity="0.9" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.75" fill="currentColor" />
      <rect x="11" y="2"  width="3" height="12" rx="0.75" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="1.5" x2="5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11" y1="1.5" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1" />
      <circle cx="5.5" cy="10" r="1" fill="currentColor" />
      <circle cx="8.5" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="5" y1="5.5" x2="11" y2="5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="8.5" x2="11" y2="8.5" stroke="currentColor" strokeWidth="1"   strokeLinecap="round" />
      <line x1="5" y1="11"  x2="9"  y2="11"  stroke="currentColor" strokeWidth="1"   strokeLinecap="round" />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8 L8 2.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 8 L13.2 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 8 L2.8 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14c0-3 2.686-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M12.88 6.92L14.7 6.82L14.7 9.18L12.88 9.08L12.22 10.69L13.57 11.9L11.9 13.57L10.69 12.22L9.08 12.88L9.18 14.7L6.82 14.7L6.92 12.88L5.31 12.22L4.1 13.57L2.43 11.9L3.78 10.69L3.12 9.08L1.3 9.18L1.3 6.82L3.12 6.92L3.78 5.31L2.43 4.1L4.1 2.43L5.31 3.78L6.92 3.12L6.82 1.3L9.18 1.3L9.08 3.12L10.69 3.78L11.9 2.43L13.57 4.1L12.22 5.31Z M10.5 8A2.5 2.5 0 0 1 5.5 8A2.5 2.5 0 0 1 10.5 8Z"
      />
    </svg>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Notifications", icon: <BellIcon /> },
  { label: "Search",        icon: <SearchIcon /> },
  { label: "Filters",       icon: <FilterIcon /> },
  { label: "News",          icon: <NewsIcon /> },
  { label: "Earnings",      icon: <CalendarIcon /> },
  { label: "Sectors",       icon: <BarChartIcon /> },
  { label: "Portfolio",     icon: <PortfolioIcon /> },
  { label: "Account",       icon: <AccountIcon /> },
  { label: "Settings",      icon: <SettingsIcon /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SideMenu({ expanded, onToggle, onSearchOpen, onFiltersOpen, onSettingsOpen }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();

  const [hovered, setHovered] = useState<number | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadAlerts, setUnreadAlerts] = useState<UnreadAlert[]>([]);
  const [dropdownTop, setDropdownTop] = useState(0);
  const bellRef = useRef<HTMLButtonElement>(null);

  const DM = '"DM Sans", var(--font-dm-sans), sans-serif';

  async function fetchUnread() {
    if (!user) return;
    try {
      const token = await getToken();
      const r = await fetch(`/api/alerts/unread?userId=${encodeURIComponent(user.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (r.ok) {
        const data = await r.json();
        setUnreadCount(data.count ?? 0);
        setUnreadAlerts(data.alerts ?? []);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!user) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function markOneRead(id: string) {
    try {
      const token = await getToken();
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ id, read: true }),
      });
      setUnreadAlerts((prev) => prev.filter((a) => a.id !== id));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      const token = await getToken();
      await Promise.all(
        unreadAlerts.map((a) =>
          fetch("/api/alerts", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ id: a.id, read: true }),
          })
        )
      );
      setUnreadAlerts([]);
      setUnreadCount(0);
    } catch { /* ignore */ }
  }

  function handleBellClick() {
    const rect = bellRef.current?.getBoundingClientRect();
    if (rect) setDropdownTop(rect.top);
    setNotifOpen((o) => !o);
  }

  const itemBase: React.CSSProperties = {
    width: "100%",
    height: MENU_COLLAPSED_W,
    display: "flex",
    alignItems: "center",
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    textAlign: "left",
    transition: "background 0.12s ease",
    position: "relative",
  };

  const iconWrap: React.CSSProperties = {
    width: MENU_COLLAPSED_W,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    transition: "color 0.12s ease",
  };

  const menuLeft = expanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 0, left: 0, bottom: 0,
          width: expanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W,
          background: "#0d1117",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.22s ease",
          overflow: "hidden",
          zIndex: 20,
          userSelect: "none",
        }}
      >
        {/* Logo home link */}
        <Link
          href="/"
          style={{
            width: "100%", height: MENU_COLLAPSED_W,
            display: "flex", alignItems: "center",
            textDecoration: "none", flexShrink: 0,
          }}
        >
          <span
            style={{
              width: MENU_COLLAPSED_W, display: "flex",
              justifyContent: "center", alignItems: "center", flexShrink: 0,
            }}
          >
            <RadarIcon size={20} />
          </span>
          <span
            style={{
              fontSize: 12, fontWeight: 700, letterSpacing: "0.15em",
              color: "#f1f5f9", whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0,
              transition: "opacity 0.12s ease",
              fontFamily: DM,
            }}
          >
            VAURIC
          </span>
        </Link>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0", flexShrink: 0 }} />

        {/* Hamburger toggle */}
        <button
          onClick={onToggle}
          onMouseEnter={() => setHovered(-1)}
          onMouseLeave={() => setHovered(null)}
          style={{
            ...itemBase,
            background: hovered === -1 ? "rgba(255,255,255,0.04)" : "transparent",
          }}
          aria-label="Toggle menu"
        >
          <span style={{ ...iconWrap, color: hovered === -1 ? "#94a3b8" : "#64748b" }}>
            <HamburgerIcon />
          </span>
        </button>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "2px 0", flexShrink: 0 }} />

        {/* Nav items */}
        {NAV_ITEMS.map(({ label, icon }, i) => {
          const isNotif = label === "Notifications";
          return (
            <button
              key={label}
              ref={isNotif ? bellRef : undefined}
              onClick={
                isNotif      ? handleBellClick :
                label === "Search"   ? onSearchOpen :
                label === "Filters"  ? onFiltersOpen :
                label === "News"     ? () => router.push("/news") :
                label === "Earnings" ? () => router.push("/earnings") :
                label === "Sectors"   ? () => router.push("/sector-performance") :
                label === "Portfolio" ? () => router.push("/portfolio") :
                label === "Settings" ? onSettingsOpen :
                label === "Account"  ? () => router.push("/account") :
                undefined
              }
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              style={{
                ...itemBase,
                background: hovered === i ? "rgba(255,255,255,0.04)" : "transparent",
              }}
              aria-label={label}
            >
              <span style={{ ...iconWrap, color: hovered === i ? "#94a3b8" : "#64748b" }}>
                {icon}
              </span>
              {/* Badge */}
              {isNotif && unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 8, left: 26,
                    minWidth: 16, height: 16,
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: 10, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                    fontFamily: DM,
                    pointerEvents: "none",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <span
                style={{
                  fontSize: 13, fontWeight: 400,
                  color: hovered === i ? "#94a3b8" : "#64748b",
                  whiteSpace: "nowrap",
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 0.12s ease, color 0.12s ease",
                  fontFamily: DM,
                  letterSpacing: "0.01em",
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Notification dropdown ──────────────────────────────────────────────── */}

      {/* Backdrop */}
      {notifOpen && (
        <div
          onClick={() => setNotifOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 29 }}
        />
      )}

      {notifOpen && (
        <div
          style={{
            position: "fixed",
            left: menuLeft + 8,
            top: dropdownTop,
            width: 300,
            zIndex: 30,
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            fontFamily: DM,
            overflow: "hidden",
          }}
        >
          {/* Dropdown header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#f1f5f9" }}>
              Triggered alerts
            </span>
            {unreadAlerts.length > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: "none", border: "none",
                  fontSize: 11, color: "#475569", cursor: "pointer",
                  fontFamily: DM, padding: 0,
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Alert list */}
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {unreadAlerts.length === 0 ? (
              <p style={{ fontSize: 12, color: "#334155", padding: "20px 16px", margin: 0, textAlign: "center" }}>
                No unread alerts.
              </p>
            ) : (
              unreadAlerts.map((alert) => {
                const isAbove = alert.direction === "above";
                const date = alert.triggered_at
                  ? new Date(alert.triggered_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                  : "";
                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>
                          {alert.ticker}
                        </span>
                        <span style={{ fontSize: 11, color: isAbove ? "#22c55e" : "#ef4444", fontWeight: 500 }}>
                          {isAbove ? "▲" : "▼"} ${alert.target_price.toFixed(2)}
                        </span>
                        {date && <span style={{ fontSize: 10, color: "#334155" }}>{date}</span>}
                      </div>
                      <button
                        onClick={() => {
                          markOneRead(alert.id);
                          setNotifOpen(false);
                          router.push(`/stock/${alert.ticker}`);
                        }}
                        style={{
                          background: "none", border: "none", padding: 0,
                          fontSize: 11, color: "#3b82f6", cursor: "pointer",
                          fontFamily: DM,
                        }}
                      >
                        View stock →
                      </button>
                    </div>
                    <button
                      onClick={() => markOneRead(alert.id)}
                      title="Mark as read"
                      style={{
                        background: "none", border: "none", color: "#1e293b",
                        fontSize: 17, cursor: "pointer", padding: "2px 4px",
                        fontFamily: DM, flexShrink: 0, lineHeight: 1,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#1e293b"; }}
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
