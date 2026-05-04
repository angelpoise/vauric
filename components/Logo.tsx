import React from "react";

export function RadarIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <circle cx="36" cy="36" r="34" stroke="#3b82f6" strokeWidth="1.2" fill="none" opacity="0.16" />
      <circle cx="36" cy="36" r="23" stroke="#3b82f6" strokeWidth="1.7" fill="none" opacity="0.36" />
      <circle cx="36" cy="36" r="12" stroke="#3b82f6" strokeWidth="2.4" fill="none" opacity="0.76" />
      <circle cx="36" cy="36" r="3.5" fill="#3b82f6" />
      <line x1="36" y1="36" x2="60" y2="12" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" opacity="0.92" />
      <circle cx="60" cy="12" r="3.4" fill="#3b82f6" opacity="0.97" />
      <circle cx="44.5" cy="27.5" r="2.2" fill="#3b82f6" opacity="0.66" />
      <circle cx="52.3" cy="19.7" r="1.7" fill="#3b82f6" opacity="0.46" />
      <circle cx="9" cy="18" r="1.7" fill="#3b82f6" opacity="0.24" />
      <circle cx="7" cy="36" r="1.6" fill="#3b82f6" opacity="0.19" />
      <circle cx="16" cy="54" r="1.7" fill="#3b82f6" opacity="0.24" />
      <circle cx="50" cy="61" r="1.6" fill="#3b82f6" opacity="0.19" />
      <circle cx="61" cy="43" r="1.6" fill="#3b82f6" opacity="0.17" />
    </svg>
  );
}

interface LogoProps {
  variant?: "full" | "default";
}

export default function Logo({ variant = "default" }: LogoProps) {
  const iconSize = variant === "full" ? 52 : 32;
  const fontSize = variant === "full" ? 20 : 14;
  const gap = variant === "full" ? 14 : 8;

  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      <RadarIcon size={iconSize} />
      <div style={{ display: "flex", flexDirection: "column", gap: variant === "full" ? 5 : 0 }}>
        <span
          style={{
            fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
            fontWeight: 700,
            letterSpacing: "0.15em",
            fontSize,
            color: "#ffffff",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          VAURIC
        </span>
        {variant === "full" && (
          <span
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              color: "#3b82f6",
              textTransform: "uppercase",
              lineHeight: 1,
              fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
              fontWeight: 400,
              whiteSpace: "nowrap",
            }}
          >
            Market intelligence, mapped.
          </span>
        )}
      </div>
    </div>
  );
}
