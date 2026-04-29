import { NextResponse } from "next/server";

const GRAPH_TICKERS = [
  "NVDA", "MSFT", "PLTR", "AMD", "ARM", "SMCI",
  "XOM",  "CVX",  "FANG", "SLB",
  "LLY",  "HIMS", "RXRX", "MRNA",
  "PYPL", "COIN", "HOOD", "AFRM", "SOFI",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
}

// 24-hour module-level cache
const TTL_MS = 24 * 60 * 60 * 1000;
let cachedData: Record<string, FundamentalsEntry> | null = null;
let cachedAt = 0;

function parseCookies(raw: string): string {
  return raw
    .split(/,\s*(?=[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("="))
    .join("; ");
}

async function getSession(): Promise<{ cookie: string; crumb: string } | null> {
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

async function fetchFundamentals(
  ticker: string,
  session: { cookie: string; crumb: string },
): Promise<FundamentalsEntry | null> {
  try {
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=summaryDetail&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: session.cookie },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const sd = json?.quoteSummary?.result?.[0]?.summaryDetail as
      | Record<string, unknown>
      | null
      | undefined;
    if (!sd) return null;

    return {
      marketCap:                    num(sd, "marketCap"),
      previousClose:                num(sd, "previousClose"),
      open:                         num(sd, "open"),
      dayLow:                       num(sd, "dayLow"),
      dayHigh:                      num(sd, "dayHigh"),
      beta:                         num(sd, "beta"),
      trailingPE:                   num(sd, "trailingPE"),
      forwardPE:                    num(sd, "forwardPE"),
      volume:                       num(sd, "regularMarketVolume"),
      averageVolume:                num(sd, "averageVolume"),
      fiftyTwoWeekLow:              num(sd, "fiftyTwoWeekLow"),
      fiftyTwoWeekHigh:             num(sd, "fiftyTwoWeekHigh"),
      priceToSalesTrailing12Months: num(sd, "priceToSalesTrailing12Months"),
      fiftyDayAverage:              num(sd, "fiftyDayAverage"),
      twoHundredDayAverage:         num(sd, "twoHundredDayAverage"),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  if (cachedData && Date.now() - cachedAt < TTL_MS) {
    return NextResponse.json(cachedData);
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Could not establish Yahoo Finance session" },
      { status: 503 },
    );
  }

  const settled = await Promise.allSettled(
    GRAPH_TICKERS.map(async (ticker) => ({
      ticker,
      entry: await fetchFundamentals(ticker, session),
    })),
  );

  const data: Record<string, FundamentalsEntry> = {};
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.entry != null) {
      data[r.value.ticker] = r.value.entry;
    }
  }

  cachedData = data;
  cachedAt = Date.now();

  return NextResponse.json(data);
}
