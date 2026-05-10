"use client";

import React from "react";
import { NOTIF, type NotifType } from "@/lib/graphTypes";
import { type GraphSettings } from "@/lib/graphSettingsTypes";
import { MENU_COLLAPSED_W } from "@/components/SideMenu";

const PANEL_W = 280;

const NOTIF_ORDER: NotifType[] = [
  "news", "analyst", "delisting", "acquisition", "split", "earnings", "ipo",
];

const NOTIF_LETTERS: Record<NotifType, string> = {
  news:        "N",
  analyst:     "A",
  delisting:   "D",
  acquisition: "M",
  split:       "B",
  earnings:    "E",
  ipo:         "I",
};

interface Props {
  open: boolean;
  onClose: () => void;
  settings: GraphSettings;
  onSettingsChange: (s: GraphSettings) => void;
}

export default function GraphSettingsPanel({
  open, onClose, settings, onSettingsChange,
}: Props) {
  const set = (partial: Partial<GraphSettings>) =>
    onSettingsChange({ ...settings, ...partial });

  function toggleNotifType(type: NotifType) {
    const hidden = settings.hiddenNotifTypes.includes(type)
      ? settings.hiddenNotifTypes.filter((t) => t !== type)
      : [...settings.hiddenNotifTypes, type];
    set({ hiddenNotifTypes: hidden });
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            left: MENU_COLLAPSED_W + PANEL_W,
            top: 0, right: 0, bottom: 0,
            zIndex: 29,
          }}
        />
      )}

      <div
        style={{
          position: "fixed", left: 0, top: 0,
          width: PANEL_W, height: "100vh", zIndex: 30,
          background: "#0d1117",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column",
          transform: open
            ? `translateX(${MENU_COLLAPSED_W}px)`
            : `translateX(-${PANEL_W}px)`,
          transition: "transform 0.25s ease",
          fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 16px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center",
            justifyContent: "space-between", flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "#f1f5f9" }}>
            Graph Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "#475569", fontFamily: "inherit",
              padding: "2px 4px",
            }}
          >
            Close
          </button>
        </div>

        {/* Scrollable sections */}
        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0 24px" }}>

          {/* Notification dots */}
          <Section title="Visible notifications">
            {NOTIF_ORDER.map((type) => {
              const visible = !settings.hiddenNotifTypes.includes(type);
              return (
                <ToggleRow
                  key={type}
                  label={NOTIF[type].label}
                  on={visible}
                  onToggle={() => toggleNotifType(type)}
                  leading={
                    <NotifDot
                      color={NOTIF[type].color}
                      letter={settings.accessibilityMode ? NOTIF_LETTERS[type] : undefined}
                      dim={!visible}
                    />
                  }
                />
              );
            })}
          </Section>

          {/* Accessibility */}
          <Section title="Accessibility">
            <ToggleRow
              label="Colour blind mode"
              hint="Adds a letter inside each notification dot"
              on={settings.accessibilityMode}
              onToggle={() => set({ accessibilityMode: !settings.accessibilityMode })}
            />
          </Section>

          {/* Node size */}
          <Section title="Node size based on">
            <RadioRow
              label="Number of connections"
              checked={settings.nodeSize === "connections"}
              onChange={() => set({ nodeSize: "connections" })}
            />
            <RadioRow
              label="Market cap"
              checked={settings.nodeSize === "marketcap"}
              onChange={() => set({ nodeSize: "marketcap" })}
            />
          </Section>
        </div>
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          padding: "14px 16px 6px",
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#334155",
        }}
      >
        {title}
      </div>
      {children}
      <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "6px 0 2px" }} />
    </div>
  );
}

function NotifDot({ color, letter, dim }: { color: string; letter?: string; dim?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 11, height: 11, borderRadius: "50%",
        background: color, flexShrink: 0,
        fontSize: 7, fontWeight: 700, color: "#000", lineHeight: 1,
        opacity: dim ? 0.3 : 1, transition: "opacity 0.15s",
      }}
    >
      {letter ?? ""}
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0,
        background: on ? "#3b82f6" : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background 0.2s",
      }}
    >
      <div
        style={{
          position: "absolute", top: 2,
          left: on ? 14 : 2,
          width: 12, height: 12, borderRadius: "50%",
          background: on ? "#fff" : "#475569",
          transition: "left 0.2s, background 0.2s",
        }}
      />
    </div>
  );
}

function ToggleRow({
  label, hint, leading, on, onToggle,
}: {
  label: string;
  hint?: string;
  leading?: React.ReactNode;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: "100%", padding: "7px 16px",
        display: "flex", alignItems: "center", gap: 10,
        background: "none", border: "none",
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}
    >
      {leading}
      <span style={{ flex: 1 }}>
        <span
          style={{
            fontSize: 12, display: "block",
            color: on ? "#e2e8f0" : "#475569",
            transition: "color 0.12s",
          }}
        >
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 10, color: "#334155", display: "block", marginTop: 1 }}>
            {hint}
          </span>
        )}
      </span>
      <Toggle on={on} />
    </button>
  );
}

function RadioRow({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      style={{
        width: "100%", padding: "7px 16px",
        display: "flex", alignItems: "center", gap: 10,
        background: "none", border: "none",
        cursor: "pointer", textAlign: "left", fontFamily: "inherit",
      }}
    >
      <div
        style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${checked ? "#3b82f6" : "#334155"}`,
          background: checked ? "#3b82f6" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        {checked && (
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
        )}
      </div>
      <span
        style={{
          fontSize: 12,
          color: checked ? "#e2e8f0" : "#475569",
          transition: "color 0.12s",
        }}
      >
        {label}
      </span>
    </button>
  );
}
