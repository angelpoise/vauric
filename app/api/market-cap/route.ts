import { NextResponse } from "next/server";

const GRAPH_TICKERS = [
  "NVDA", "MSFT", "PLTR", "AMD", "ARM", "SMCI",
  "XOM",  "CVX",  "FANG", "SLB",
  "LLY",  "HIMS", "RXRX", "MRNA",
  "PYPL", "COIN", "HOOD", "AFRM", "SOFI",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface MarketCapEntry {
  marketCap: number;
}

// 24-hour module-level cache
const TTL_MS = 24 * 60 * 60 * 1000;
let cachedData: Record<string, MarketCapEntry> | null = null;
let cachedAt = 0;

// Parses a raw Set-Cookie header string (multiple cookies joined by ", ")
// into a single Cookie request header value ("name=val; name2=val2").
function parseCookies(raw: string): string {
  return raw
    .split(/,\s*(?=[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("="))
    .join("; ");
}

async function getSession(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    // fc.yahoo.com sets the A3 session cookie even when it returns a non-200
    const cookieRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": UA },
    });
    const raw = cookieRes.headers.get("set-cookie") ?? "";
    const cookie = parseCookies(raw);

    const crumbRes = await fetch(
      "https://query2.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": UA, Cookie: cookie } },
    );
    const crumb = await crumbRes.text();
    // A valid crumb is a short alphanumeric string, not JSON
    if (!crumb || crumb.startsWith("{")) return null;

    return { cookie, crumb };
  } catch {
    return null;
  }
}

async function fetchMarketCap(
  ticker: string,
  session: { cookie: string; crumb: string },
): Promise<number | null> {
  try {
    const url =
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}` +
      `?modules=summaryDetail&crumb=${encodeURIComponent(session.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: session.cookie },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw =
      json?.quoteSummary?.result?.[0]?.summaryDetail?.marketCap?.raw;
    return typeof raw === "number" ? raw : null;
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
      marketCap: await fetchMarketCap(ticker, session),
    })),
  );

  const data: Record<string, MarketCapEntry> = {};
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.marketCap != null) {
      data[r.value.ticker] = { marketCap: r.value.marketCap };
    }
  }

  cachedData = data;
  cachedAt = Date.now();

  return NextResponse.json(data);
}
