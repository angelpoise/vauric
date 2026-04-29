export interface MarketDataEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
}

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
