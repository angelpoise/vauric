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

export function moveColor(m: number) {
  return m > 0.5 ? "#22c55e" : m < -0.5 ? "#ef4444" : "#64748b";
}

export function moveBg(m: number) {
  return m > 0.5
    ? "rgba(34,197,94,0.12)"
    : m < -0.5
    ? "rgba(239,68,68,0.12)"
    : "rgba(100,116,139,0.12)";
}
