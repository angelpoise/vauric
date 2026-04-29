export type NotifType =
  | "news"
  | "analyst"
  | "squeeze"
  | "delisting"
  | "split"
  | "earnings"
  | "ipo";

export interface Notif {
  type: NotifType;
}

interface BaseNode {
  id: string;
  x: number;
  y: number;
  notifications: Notif[];
}

export interface StockNode extends BaseNode {
  kind: "stock";
  ticker: string;
  name: string;
  price: number;
  dailyMove: number;
  sectorId: string;
}

export interface SectorNode extends BaseNode {
  kind: "sector";
  name: string;
  etf: string;
  price: number;
  dailyMove: number;
}

export type GNode = StockNode | SectorNode;

export const NOTIF: Record<NotifType, { color: string; label: string }> = {
  news:      { color: "#facc15", label: "News" },
  analyst:   { color: "#f97316", label: "Analyst action" },
  squeeze:   { color: "#ef4444", label: "Short squeeze" },
  delisting: { color: "#a855f7", label: "Delisting / Acquisition" },
  split:     { color: "#3b82f6", label: "Split / Offering" },
  earnings:  { color: "#ffffff", label: "Earnings" },
  ipo:       { color: "#22c55e", label: "IPO" },
};

// Interpolates between grey and full green/red based on move magnitude.
// Dead zone: |m| <= 0.05 → pure grey. Full colour at |m| >= 1.0.
function lerpRGB(m: number): { r: number; g: number; b: number } {
  const abs = Math.abs(m);
  // Grey base: rgb(100, 116, 139)
  const gr = 100, gg = 116, gb = 139;
  if (abs <= 0.05) return { r: gr, g: gg, b: gb };
  const t = Math.min(1, (abs - 0.05) / 0.95);
  if (m > 0) {
    // Green target: rgb(34, 197, 94)
    return {
      r: Math.round(gr + t * (34  - gr)),
      g: Math.round(gg + t * (197 - gg)),
      b: Math.round(gb + t * (94  - gb)),
    };
  }
  // Red target: rgb(239, 68, 68)
  return {
    r: Math.round(gr + t * (239 - gr)),
    g: Math.round(gg + t * (68  - gg)),
    b: Math.round(gb + t * (68  - gb)),
  };
}

export function moveColor(m: number): string {
  const { r, g, b } = lerpRGB(m);
  return `rgb(${r},${g},${b})`;
}

export function moveFill(m: number, alpha = 0.14): string {
  const { r, g, b } = lerpRGB(m);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function moveBg(m: number): string {
  return moveFill(m, 0.12);
}
