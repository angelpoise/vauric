/**
 * Shared fundamentals fetch utilities and module-level cache.
 * Kept in lib/ so both the fundamentals route and the admin stocks route
 * can import without triggering Next.js's route-file type constraints.
 */

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
  // ETF-specific fields (null for stocks)
  totalAssets:                  number | null;
  fundYield:                    number | null; // decimal, e.g. 0.0051 = 0.51%
  ytdReturn:                    number | null;
  threeYearAvgReturn:           number | null;
  fiveYearAvgReturn:            number | null;
  expenseRatio:                 number | null;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ─── Module-level cache ───────────────────────────────────────────────────────

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

/** Merge a single ticker's entry into the cache without resetting the TTL. */
export function mergeFundamentalsEntry(
  ticker: string,
  entry: FundamentalsEntry,
): void {
  fundamentalsCache = { ...(fundamentalsCache ?? {}), [ticker]: entry };
}

// ─── Yahoo Finance fetch ──────────────────────────────────────────────────────

function parseCookies(raw: string): string {
  return raw
    .split(/,\s*(?=[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("="))
    .join("; ");
}

export async function getYahooSession(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
    });
    const cookie = parseCookies(cookieRes.headers.get("set-cookie") ?? "");
    const crumbRes = await fetch(
      "https://query2.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": UA, Cookie: cookie } },
    );
    const crumb = await crumbRes.text();
    if (!crumb || crumb.startsWith("{")) return null;
    return { cookie, crumb };
  } catch {
    return null;
  }
}

function num(sd: Record<string, unknown>, key: string): number | null {
  const field = sd[key] as { raw?: number } | null | undefined;
  return typeof field?.raw === "number" ? field.raw : null;
}

export async function fetchFundamentalsForTicker(
  ticker: string,
  session: { cookie: string; crumb: string },
): Promise<FundamentalsEntry | null> {
  try {
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=summaryDetail,assetProfile,fundProfile,defaultKeyStatistics,price&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: session.cookie },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0] as Record<string, unknown> | null | undefined;
    const sd  = result?.summaryDetail        as Record<string, unknown> | null | undefined;
    const ap  = result?.assetProfile         as Record<string, unknown> | null | undefined;
    const fp  = result?.fundProfile          as Record<string, unknown> | null | undefined;
    const dks = result?.defaultKeyStatistics as Record<string, unknown> | null | undefined;
    const pr  = result?.price                as Record<string, unknown> | null | undefined;
    if (!sd) return null;

    return {
      marketCap:                    num(sd, "marketCap"),
      previousClose:                num(sd, "previousClose"),
      open:                         num(sd, "open"),
      dayLow:                       num(sd, "dayLow"),
      dayHigh:                      num(sd, "dayHigh"),
      // summaryDetail.beta works for stocks; ETFs sometimes put it in defaultKeyStatistics
      beta:                         num(sd, "beta") ?? num(dks ?? {}, "beta"),
      trailingPE:                   num(sd, "trailingPE"),
      forwardPE:                    num(sd, "forwardPE"),
      volume:                       num(sd, "regularMarketVolume"),
      averageVolume:                num(sd, "averageVolume"),
      fiftyTwoWeekLow:              num(sd, "fiftyTwoWeekLow"),
      fiftyTwoWeekHigh:             num(sd, "fiftyTwoWeekHigh"),
      priceToSalesTrailing12Months: num(sd, "priceToSalesTrailing12Months"),
      fiftyDayAverage:              num(sd, "fiftyDayAverage"),
      twoHundredDayAverage:         num(sd, "twoHundredDayAverage"),
      longBusinessSummary: typeof ap?.longBusinessSummary === "string" ? ap.longBusinessSummary : null,
      sector:              typeof ap?.sector             === "string" ? ap.sector             : null,
      industry:            typeof ap?.industry           === "string" ? ap.industry           : null,
      website:             typeof ap?.website            === "string" ? ap.website            : null,
      country:             typeof ap?.country            === "string" ? ap.country            : null,
      exchange:            typeof pr?.exchange           === "string" ? pr.exchange           : null,
      fullTimeEmployees:   typeof ap?.fullTimeEmployees  === "number" ? ap.fullTimeEmployees  : null,
      // ETF-specific (populated for ETF tickers, null for stocks)
      totalAssets:       num(sd, "totalAssets"),
      fundYield:         num(sd, "yield") ?? num(fp ?? {}, "yield"),
      ytdReturn:         num(sd, "ytdReturn"),
      threeYearAvgReturn: num(sd, "threeYearAverageReturn"),
      fiveYearAvgReturn:  num(sd, "fiveYearAverageReturn"),
      expenseRatio:      num(fp ?? {}, "annualReportExpenseRatio"),
    };
  } catch {
    return null;
  }
}

export interface EtfHolding {
  symbol: string;
  holdingName: string;
  holdingPercent: number; // 0–1
}

/** Fetch top ETF holdings from Yahoo Finance's topHoldings module. */
export async function fetchEtfHoldings(
  symbol: string,
  session: { cookie: string; crumb: string },
): Promise<EtfHolding[]> {
  try {
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}` +
      `?modules=topHoldings&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: session.cookie },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const th = json?.quoteSummary?.result?.[0]?.topHoldings as
      | { holdings?: Array<{ symbol?: string; holdingName?: string; holdingPercent?: { raw?: number } }> }
      | null | undefined;
    return (th?.holdings ?? [])
      .filter((h) => !!h.symbol)
      .map((h) => ({
        symbol:         h.symbol!,
        holdingName:    h.holdingName ?? h.symbol!,
        holdingPercent: h.holdingPercent?.raw ?? 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Fetches fundamentals for a single ticker and merges it into the shared
 * module cache so it is immediately available without waiting for the next
 * full refresh. Called when a new stock is added via the admin panel.
 */
export async function hydrateSingleTicker(ticker: string): Promise<void> {
  try {
    const session = await getYahooSession();
    if (!session) return;
    const entry = await fetchFundamentalsForTicker(ticker, session);
    if (entry) mergeFundamentalsEntry(ticker, entry);
  } catch (err) {
    console.error(`[fundamentals] hydrateSingleTicker(${ticker}) failed:`, err);
  }
}
