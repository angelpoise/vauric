"use client";

import { useState } from "react";

export const MENU_COLLAPSED_W = 44;
export const MENU_EXPANDED_W = 180;

interface Props {
  expanded: boolean;
  onToggle: () => void;
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
  { label: "Account",       icon: <AccountIcon /> },
  { label: "Settings",      icon: <SettingsIcon /> },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function SideMenu({ expanded, onToggle }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

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
  };

  const iconWrap: React.CSSProperties = {
    width: MENU_COLLAPSED_W,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    transition: "color 0.12s ease",
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
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
      {NAV_ITEMS.map(({ label, icon }, i) => (
        <button
          key={label}
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
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: hovered === i ? "#94a3b8" : "#64748b",
              whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0,
              transition: "opacity 0.12s ease, color 0.12s ease",
              fontFamily: '"DM Sans", var(--font-dm-sans), sans-serif',
              letterSpacing: "0.01em",
            }}
          >
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
