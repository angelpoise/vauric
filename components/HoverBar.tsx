"use client";

import { type GNode, type SubSectorNode, type SubSubSectorNode, NOTIF, moveColor } from "@/lib/graphTypes";

export const HBAR_H = 68;

interface Props {
  node: GNode | null;
  leftOffset: number;
}

function Divider() {
  return (
    <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />
  );
}

// Defensive accessors for fields that only exist on stock/sector nodes but may be
// dynamically merged onto hierarchy nodes by GraphCanvas.setHover via live ETF data.
function nodePrice(node: GNode): number {
  return (node as { price?: number }).price ?? 0;
}
function nodeDailyMove(node: GNode): number {
  return (node as { dailyMove?: number }).dailyMove ?? 0;
}

// Primary identifier shown large on the left
function nodeIdentifier(node: GNode): string {
  if (node.kind === "stock")         return node.ticker;
  if (node.kind === "sector")        return node.etf;
  // subsector/subsubsector: use own ETF if present, otherwise the name
  return (node as SubSectorNode | SubSubSectorNode).etf ?? node.name;
}

// Secondary label shown below the identifier
function nodeSubtitle(node: GNode): string | null {
  if (node.kind === "sector")        return "Sector ETF";
  if (node.kind === "subsector")     return `${(node as SubSectorNode).sectorEtf} · Sub-sector`;
  if (node.kind === "subsubsector")  return `${(node as SubSubSectorNode).sectorEtf} · Sub-sub-sector`;
  return null;
}

export default function HoverBar({ node, leftOffset }: Props) {
  const move     = node ? nodeDailyMove(node) : 0;
  const price    = node ? nodePrice(node) : 0;
  const col      = moveColor(move);
  const pctSign  = move >= 0 ? "+" : "";
  const dolSign  = move >= 0 ? "+" : "-";
  const dollarMove = price > 0 ? Math.abs((price * move) / 100) : 0;

  // Whether we have meaningful live price data to display
  const hasLiveData = price > 0 || move !== 0;

  // Hierarchy node with no ETF ticker — show informational note instead of price
  const hasNoEtf = node
    && (node.kind === "subsector" || node.kind === "subsubsector")
    && !(node as SubSectorNode | SubSubSectorNode).etf;

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
          {/* Primary identifier (ticker for stocks, ETF or name for hierarchy) */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.05em", lineHeight: 1 }}>
              {nodeIdentifier(node)}
            </div>
          </div>

          <Divider />

          {/* Display name + optional subtitle */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 300, whiteSpace: "nowrap" }}>
              {node.name}
            </div>
            {nodeSubtitle(node) && (
              <div style={{ fontSize: 11, color: "#475569", fontWeight: 300, marginTop: 2 }}>
                {nodeSubtitle(node)}
              </div>
            )}
          </div>

          <Divider />

          {hasNoEtf ? (
            <>
              <Divider />
              <div style={{ flexShrink: 0, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
                No ETF tracking
              </div>
            </>
          ) : (
            <>
              {/* Price */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: "#f1f5f9" }}>
                  {hasLiveData && price > 0 ? `$${price.toFixed(2)}` : "—"}
                </div>
              </div>

              <Divider />

              {/* Daily move % */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: hasLiveData ? col : "#334155" }}>
                  {hasLiveData ? `${pctSign}${move.toFixed(2)}%` : "—"}
                </div>
              </div>

              {/* Daily move $ — only shown for stock nodes with available price */}
              {node.kind === "stock" && hasLiveData && price > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 400, color: col + "bb" }}>
                    {dolSign}${dollarMove.toFixed(2)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notification pills */}
          {node.notifications.length > 0 && (
            <>
              <Divider />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap", overflow: "hidden" }}>
                {node.notifications.map((n, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: NOTIF[n.type].color + "14",
                      border: `1px solid ${NOTIF[n.type].color}30`,
                      borderRadius: 20, padding: "3px 10px 3px 7px", flexShrink: 0,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: NOTIF[n.type].color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: NOTIF[n.type].color, fontWeight: 400, whiteSpace: "nowrap" }}>
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
          Hover over a node for details
        </div>
      )}
    </div>
  );
}
