import type { NotifType } from "./graphTypes";

export interface ClassificationResult {
  type: NotifType;
  // Only true for specific, high-significance single-stock events.
  // "news" type never generates a dot — it's background context.
  generatesNotification: boolean;
  // True when the headline is broad sector/market commentary rather than
  // stock-specific. Used to drive sector node notification dots.
  isSectorNews: boolean;
  // Populated only when isSectorNews is true.
  sectorId: string | null;
}

interface Rule {
  type: NotifType;
  keywords: string[];
  headlineOnly?: boolean;
  negativeKeywords?: string[];
  requireTickerInHeadline?: boolean;
  negativeContextKeywords?: string[];
}

// Ordered rules — first match wins.
const RULES: Rule[] = [
  {
    type: "earnings",
    keywords: ["earnings", "eps", "revenue", "quarterly", "beat", "miss", "guidance"],
  },
  {
    type: "analyst",
    keywords: ["upgrade", "downgrade", "price target", "outperform", "underperform", "buy", "sell", "neutral", "initiate"],
  },
  {
    type: "squeeze",
    keywords: ["short squeeze"],
    headlineOnly: true,
  },
  {
    type: "split",
    keywords: ["stock split", "reverse split", "secondary offering", "share offering"],
  },
  {
    // "delisting" covers acquisitions/mergers.
    // Negative keywords block biographical/historical references.
    type: "delisting",
    keywords: ["acquisition", "merger", "buyout", "takeover", "acquire"],
    headlineOnly: true,
    negativeKeywords: [
      "decade", "history", "historical", "farewell", "legacy", "era",
      "years", "former", "retired", "retirement", "anniversary", "past",
      "look back", "reminisce", "veteran", "founded", "since", "biography",
      "memoir", "career", "tenure", "stepping down", "steps down",
    ],
  },
  {
    type: "ipo",
    keywords: ["ipo", "initial public offering", "going public"],
    headlineOnly: true,
    requireTickerInHeadline: true,
    negativeKeywords: [
      "invest in", "ahead of", "before", "rival", "competitor", "leading up to",
      "other", "another", "new", "upcoming", "plans", "eyes", "considers", "watch", "target",
      "spacex", "reddit", "stripe", "klarna", "shein", "chime", "databricks",
    ],
    negativeContextKeywords: ["market", "stocks", "investors", "wall street"],
  },
];

// Types that constitute a meaningful single-stock event worthy of a graph dot.
const NOTIFICATION_TYPES = new Set<NotifType>(["analyst", "squeeze", "delisting", "split", "earnings", "ipo"]);

// Broad sector/market signals — articles whose headlines match these terms
// (and do NOT name the tracked ticker directly) are sector news, not stock news.
const SECTOR_SIGNALS: Array<{ id: string; terms: string[] }> = [
  {
    id: "tech",
    terms: [
      "xlk", "ai sector", "semiconductor sector", "chip sector", "tech sector",
      "semiconductor industry", "cloud sector", "ai stocks", "chip stocks",
      "tech stocks", "technology sector", "semiconductor stocks",
    ],
  },
  {
    id: "energy",
    terms: [
      "xle", "energy sector", "oil prices", "crude oil", "natural gas prices",
      "opec", "oil market", "energy stocks", "oil stocks", "energy industry",
    ],
  },
  {
    id: "health",
    terms: [
      "xlv", "healthcare sector", "pharma sector", "biotech sector",
      "healthcare stocks", "pharmaceutical sector", "drug stocks", "health stocks",
    ],
  },
  {
    id: "finance",
    terms: [
      "xlf", "interest rates", "fed rate", "federal reserve rate",
      "fintech sector", "banking sector", "rate hike", "rate cut",
      "finance sector", "financial sector", "bank stocks",
    ],
  },
  {
    id: "consumer",
    terms: [
      "xly", "consumer sector", "retail sector", "consumer spending",
      "consumer stocks", "retail stocks", "consumer discretionary",
    ],
  },
];

function detectSector(
  headline: string,
  ticker: string,
): { isSectorNews: boolean; sectorId: string | null } {
  const hl  = headline.toLowerCase();
  const sym = ticker.toLowerCase();

  // If the ticker symbol appears in the headline it is stock-specific.
  if (hl.includes(sym)) return { isSectorNews: false, sectorId: null };

  for (const { id, terms } of SECTOR_SIGNALS) {
    if (terms.some((t) => hl.includes(t))) {
      return { isSectorNews: true, sectorId: id };
    }
  }
  return { isSectorNews: false, sectorId: null };
}

export function classifyNews(
  headline: string,
  summary: string,
  ticker: string,
): ClassificationResult {
  const hl  = headline.toLowerCase();
  const sm  = summary.toLowerCase();
  const sym = ticker.toLowerCase();

  let type: NotifType = "news";

  for (const rule of RULES) {
    const texts = rule.headlineOnly ? [hl] : [hl, sm];
    if (!texts.some((t) => rule.keywords.some((kw) => t.includes(kw)))) continue;
    if (rule.requireTickerInHeadline && !hl.includes(sym)) continue;
    if (rule.negativeKeywords?.some((nk) => hl.includes(nk))) continue;
    if (rule.negativeContextKeywords?.some((nk) => hl.includes(nk))) continue;
    type = rule.type;
    break;
  }

  const generatesNotification = NOTIFICATION_TYPES.has(type);
  const { isSectorNews, sectorId } = detectSector(headline, ticker);

  return { type, generatesNotification, isSectorNews, sectorId };
}
