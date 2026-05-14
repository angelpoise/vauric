// Polygon SIC code prefix → GICS sector display name
export const SIC_TO_GICS: Array<[number, number, string]> = [
  [100,   999,  "Materials"],
  [1000,  1499, "Materials"],
  [1500,  1799, "Industrials"],
  [2000,  2099, "Consumer Staples"],
  [2100,  2199, "Consumer Staples"],
  [2200,  2399, "Consumer Discretionary"],
  [2400,  2799, "Materials"],
  [2800,  2829, "Materials"],
  [2830,  2836, "Healthcare"],
  [2837,  2899, "Materials"],
  [2900,  2999, "Energy"],
  [3000,  3299, "Materials"],
  [3300,  3499, "Materials"],
  [3500,  3569, "Industrials"],
  [3570,  3579, "Information Technology"],
  [3580,  3599, "Industrials"],
  [3600,  3679, "Information Technology"],
  [3680,  3699, "Information Technology"],
  [3700,  3716, "Consumer Discretionary"],
  [3717,  3743, "Industrials"],
  [3744,  3759, "Consumer Discretionary"],
  [3760,  3769, "Industrials"],
  [3770,  3799, "Consumer Discretionary"],
  [3800,  3811, "Industrials"],
  [3812,  3812, "Industrials"],
  [3813,  3825, "Industrials"],
  [3826,  3851, "Healthcare"],
  [3852,  3899, "Industrials"],
  [3900,  3999, "Consumer Discretionary"],
  [4000,  4599, "Industrials"],
  [4600,  4699, "Energy"],
  [4700,  4723, "Industrials"],
  [4724,  4729, "Consumer Discretionary"],
  [4730,  4799, "Industrials"],
  [4800,  4899, "Communication Services"],
  [4900,  4999, "Utilities"],
  [5000,  5199, "Industrials"],
  [5200,  5999, "Consumer Discretionary"],
  [6000,  6199, "Financials"],
  [6200,  6299, "Financials"],
  [6300,  6399, "Financials"],
  [6400,  6499, "Financials"],
  [6500,  6599, "Real Estate"],
  [6700,  6797, "Financials"],
  [6798,  6798, "Real Estate"],
  [6799,  6799, "Financials"],
  [7000,  7299, "Consumer Discretionary"],
  [7300,  7399, "Information Technology"],
  [7500,  7599, "Consumer Discretionary"],
  [7600,  7699, "Consumer Discretionary"],
  [7800,  7999, "Communication Services"],
  [8000,  8099, "Healthcare"],
  [8100,  8299, "Industrials"],
  [8700,  8999, "Industrials"],
];

// Ticker-level overrides for companies whose SIC code doesn't match their GICS sector.
export const TICKER_SECTOR_OVERRIDE: Record<string, string> = {
  SPGI: "Financials",
  MCO:  "Financials",
  MSCI: "Financials",
  ICE:  "Financials",
  CBOE: "Financials",
  CME:  "Financials",
  NDAQ: "Financials",
  FDS:  "Financials",
  VRSK: "Financials",
};

export function sicToGics(sic: number): string | null {
  for (const [lo, hi, sector] of SIC_TO_GICS) {
    if (sic >= lo && sic <= hi) return sector;
  }
  return null;
}

export function sectorFromPolygon(ticker: string, sicCode: string | null): string | null {
  if (TICKER_SECTOR_OVERRIDE[ticker]) return TICKER_SECTOR_OVERRIDE[ticker];
  if (!sicCode) return null;
  const sic = parseInt(sicCode, 10);
  return isNaN(sic) ? null : sicToGics(sic);
}

// Strip share-class suffixes that Polygon sometimes appends to company names.
export function cleanCompanyName(raw: string): string {
  return raw
    .replace(/,?\s*(Class\s+[A-Z]\s+)?Common\s+(Stock|Shares)\s*$/i, "")
    .replace(/,?\s*Ordinary\s+Shares\s*$/i, "")
    .replace(/,?\s*American\s+Depositary\s+(Shares?|Receipts?)\s*$/i, "")
    .replace(/,?\s*Depositary\s+(Shares?|Receipts?)\s*$/i, "")
    .replace(/\s*-\s*(Class\s+[A-Z]\s+)?Common\s+(Stock|Shares)\s*$/i, "")
    .replace(/,?\s*Class\s+[A-Z]\s+Shares\s*$/i, "")
    .trim();
}
