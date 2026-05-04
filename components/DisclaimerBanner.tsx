"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "vauric_disclaimer_dismissed";

interface Props {
  onVisibilityChange: (visible: boolean) => void;
  leftOffset?: number;
}

export default function DisclaimerBanner({ onVisibilityChange, leftOffset = 0 }: Props) {
  const [mounted, setMounted] = useState(false);
  const [permDismissed, setPermDismissed] = useState(false);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [okHovered, setOkHovered] = useState(false);
  const [dontHovered, setDontHovered] = useState(false);

  useEffect(() => {
    const perm = localStorage.getItem(STORAGE_KEY) === "1";
    setPermDismissed(perm);
    setMounted(true);
  }, []);

  const visible = mounted && !permDismissed && !sessionDismissed;

  useEffect(() => {
    onVisibilityChange(visible);
  }, [visible, onVisibilityChange]);

  if (!mounted || permDismissed || sessionDismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 44,
        background: "#0d1117",
        borderTop: "1px solid rgba(255,255,246,0.08)",
        display: "flex",
        alignItems: "center",
        paddingLeft: leftOffset + 20,
        paddingRight: 20,
        zIndex: 5,
        animation: "disclaimerSlideUp 0.3s ease",
      }}
    >
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0, flex: 1 }}>
        Vauric is an information platform only. Nothing on this site constitutes financial advice. Always do your own research.
      </p>
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginLeft: 16 }}>
        <button
          onClick={() => setSessionDismissed(true)}
          onMouseEnter={() => setOkHovered(true)}
          onMouseLeave={() => setOkHovered(false)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            color: okHovered ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.5)",
            padding: "4px 10px",
            transition: "color 0.12s ease",
            fontFamily: "inherit",
          }}
        >
          OK
        </button>
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setPermDismissed(true);
          }}
          onMouseEnter={() => setDontHovered(true)}
          onMouseLeave={() => setDontHovered(false)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            color: dontHovered ? "#60a5fa" : "#3b82f6",
            padding: "4px 10px",
            transition: "color 0.12s ease",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          Don&apos;t show again
        </button>
      </div>
    </div>
  );
}
