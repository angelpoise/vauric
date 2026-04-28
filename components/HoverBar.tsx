"use client";

import { type GNode, NOTIF, moveColor } from "@/lib/graphTypes";

export const HBAR_H = 68;

interface Props {
  node: GNode | null;
  leftOffset: number;
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 28,
        background: "rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}
    />
  );
}


export default function HoverBar({ node, leftOffset }: Props) {
  const col = node ? moveColor(node.dailyMove) : "#64748b";
  const pctSign = node && node.dailyMove >= 0 ? "+" : "";
  const dollarMove = node ? (node.price * node.dailyMove) / 100 : 0;
  const dolSign = node && node.dailyMove >= 0 ? "+" : "-";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: leftOffset,
        right: 0,
        height: HBAR_H,
        background: "#0d1117",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        paddingLeft: 24,
        paddingRight: 20,
        gap: 20,
        fontFamily: '"DM Sans", var(--font-dm-sans), sans-serif',
        zIndex: 10,
        transform: node ? "translateY(0)" : `translateY(${HBAR_H}px)`,
        transition: "transform 0.22s ease, left 0.22s ease",
        overflow: "hidden",
      }}
    >
      {node ? (
        <>
          {/* Ticker */}
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#f1f5f9",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}
            >
              {node.kind === "stock" ? node.ticker : node.etf}
            </div>
          </div>

          <Divider />

          {/* Company name */}
          <div style={{ flexShrink: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: "#94a3b8",
                fontWeight: 300,
                whiteSpace: "nowrap",
              }}
            >
              {node.name}
            </div>
            {node.kind === "sector" && (
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 300, marginTop: 2 }}>
                Sector ETF
              </div>
            )}
          </div>

          <Divider />

          {/* Price */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#f1f5f9" }}>
              ${node.price.toFixed(2)}
            </div>
          </div>

          <Divider />

          {/* Daily move % */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: col }}>
              {pctSign}{node.dailyMove.toFixed(2)}%
            </div>
          </div>

          {/* Daily move $ */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 400, color: col + "bb" }}>
              {dolSign}${Math.abs(dollarMove).toFixed(2)}
            </div>
          </div>

          {/* Notifications */}
          {node.notifications.length > 0 && (
            <>
              <Divider />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "nowrap",
                  overflow: "hidden",
                }}
              >
                {node.notifications.map((n, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: NOTIF[n.type].color + "14",
                      border: `1px solid ${NOTIF[n.type].color}30`,
                      borderRadius: 20,
                      padding: "3px 10px 3px 7px",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: NOTIF[n.type].color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        color: NOTIF[n.type].color,
                        fontWeight: 400,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {NOTIF[n.type].label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

        </>
      ) : (
        <div style={{ fontSize: 13, color: "#334155" }}>
          Hover over a node to see stock info
        </div>
      )}
    </div>
  );
}
