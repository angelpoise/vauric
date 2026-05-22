export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
}

// 15-minute TTL — balances freshness against Yahoo Finance rate limits.
// This is an in-memory client-side cache (browser tab scoped), so different
// tabs and server instances each maintain their own independent cache.
const TTL_MS = 15 * 60 * 1000;

let cachedData: Record<string, MarketDataEntry> | null = null;
let cachedAt = 0;

export function getCachedMarketData(): Record<string, MarketDataEntry> | null {
  if (!cachedData || Date.now() - cachedAt > TTL_MS) return null;
  return cachedData;
}

export function setCachedMarketData(data: Record<string, MarketDataEntry>): void {
  cachedData = data;
  cachedAt = Date.now();
}

// Node positions — no TTL, persists for the session so the graph doesn't
// flash fallback positions on remount (e.g. back-navigating from a stock page).
export interface NodePosition { x: number; y: number; }

let cachedNodePositions: Record<string, NodePosition> | null = null;

export function getCachedNodePositions(): Record<string, NodePosition> | null {
  return cachedNodePositions;
}

export function setCachedNodePositions(positions: Record<string, NodePosition>): void {
  cachedNodePositions = positions;
}
