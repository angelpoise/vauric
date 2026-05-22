export interface FundamentalsEntry {
  marketCap:                    number | null;
  previousClose:                number | null;
  open:                         number | null;
  dayLow:                       number | null;
  dayHigh:                      number | null;
  beta:                         number | null;
  trailingPE:                   number | null;
  forwardPE:                    number | null;
  volume:                       number | null;
  averageVolume:                number | null;
  fiftyTwoWeekLow:              number | null;
  fiftyTwoWeekHigh:             number | null;
  priceToSalesTrailing12Months: number | null;
  fiftyDayAverage:              number | null;
  twoHundredDayAverage:         number | null;
  longBusinessSummary:          string | null;
  sector:                       string | null;
  industry:                     string | null;
  website:                      string | null;
  country:                      string | null;
  exchange:                     string | null;
  fullTimeEmployees:            number | null;
  totalAssets:                  number | null;
  fundYield:                    number | null;
  ytdReturn:                    number | null;
  threeYearAvgReturn:           number | null;
  fiveYearAvgReturn:            number | null;
  expenseRatio:                 number | null;
}

export const FUNDAMENTALS_TTL_MS = 24 * 60 * 60 * 1000;
export let fundamentalsCache: Record<string, FundamentalsEntry> | null = null;
export let fundamentalsCachedAt = 0;

export function setFundamentalsCache(
  data: Record<string, FundamentalsEntry>,
  at = Date.now(),
): void {
  fundamentalsCache = data;
  fundamentalsCachedAt = at;
}

export function mergeFundamentalsEntry(
  ticker: string,
  entry: FundamentalsEntry,
): void {
  fundamentalsCache = { ...(fundamentalsCache ?? {}), [ticker]: entry };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchFundamentalsForTicker(ticker: string, session: unknown): Promise<FundamentalsEntry | null> {
  return null;
}

export interface EtfHolding {
  symbol: string;
  holdingName: string;
  holdingPercent: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchEtfHoldings(symbol: string, session: unknown): Promise<EtfHolding[]> {
  return [];
}

export async function getYahooSession(): Promise<null> {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function hydrateSingleTicker(ticker: string): Promise<void> {
  // no-op
}
