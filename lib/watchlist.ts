export const FREE_TIER_CAP = 10;
export const WATCHLIST_EVENT = "vauric:watchlist-update";
const WATCHLIST_KEY = "vauric_watchlist";

export type AddResult = "added" | "duplicate" | "limit";

export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persist(tickers: string[]): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers));
  window.dispatchEvent(new Event(WATCHLIST_EVENT));
}

export function addToWatchlist(ticker: string): AddResult {
  const list = getWatchlist();
  if (list.includes(ticker)) return "duplicate";
  if (list.length >= FREE_TIER_CAP) return "limit";
  persist([...list, ticker]);
  return "added";
}

export function removeFromWatchlist(ticker: string): void {
  persist(getWatchlist().filter((t) => t !== ticker));
}
