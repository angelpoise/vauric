/**
 * Placeholder sentiment scores (0–100, bullish) for tracked stocks.
 * Used to compute aggregated sentiment on hierarchy detail pages.
 * These mirror the values hardcoded in StockDetail's STOCK_DB.
 */
export const STOCK_SENTIMENT: Record<string, number> = {
  NVDA: 82, MSFT: 74, PLTR: 71, AMD: 68, ARM: 79, SMCI: 58,
  XOM:  38, CVX:  42, FANG: 58, SLB: 31,
  LLY:  71, HIMS: 76, RXRX: 62, MRNA: 44,
  SOFI: 66, AFRM: 64, PYPL: 52, COIN: 74, HOOD: 68,
};

/**
 * Compute average sentiment for a list of tickers.
 * Returns null when fewer than 3 tickers have known sentiment (avoid misleading averages).
 */
export function aggregateSentiment(tickers: string[]): number | null {
  const scores = tickers.map((t) => STOCK_SENTIMENT[t]).filter((s): s is number => s != null);
  if (scores.length < 3) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
