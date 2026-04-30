import type { NotifType } from "./graphTypes";

interface Rule {
  type: NotifType;
  keywords: string[];
  headlineOnly?: boolean;       // if true, only the headline is checked (not summary)
  negativeKeywords?: string[];  // if any match the headline, this rule is skipped
  requireTickerInHeadline?: boolean; // if true, ticker symbol must appear in the headline
  negativeContextKeywords?: string[]; // market/general-news signals that override this rule
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
    // Headline-only: avoids matching "short" or "squeeze" in unrelated contexts.
    type: "squeeze",
    keywords: ["short squeeze"],
    headlineOnly: true,
  },
  {
    type: "split",
    keywords: ["stock split", "reverse split", "secondary offering", "share offering"],
  },
  {
    // "delisting" covers acquisitions/mergers — labelled "Delisting / Acquisition" in the UI
    // Headline-only: avoids "acquire" appearing in unrelated business contexts in summaries.
    type: "delisting",
    keywords: ["acquisition", "merger", "buyout", "takeover", "acquire"],
    headlineOnly: true,
  },
  {
    // Strict IPO rule: headline-only, ticker must appear in the headline,
    // extensive negative keyword list, and general market context overrides to "news".
    type: "ipo",
    keywords: ["ipo", "initial public offering", "going public"],
    headlineOnly: true,
    requireTickerInHeadline: true,
    negativeKeywords: [
      "invest in", "ahead of", "before", "rival", "competitor", "leading up to",
      "other", "another", "new", "upcoming", "plans", "eyes", "considers", "watch", "target",
      // Well-known companies whose IPO mentions are not about the tracked stock
      "spacex", "reddit", "stripe", "klarna", "shein", "chime", "databricks",
    ],
    negativeContextKeywords: ["market", "stocks", "investors", "wall street"],
  },
];

export function classifyNews(headline: string, summary: string, ticker: string): NotifType {
  const hl  = headline.toLowerCase();
  const sm  = summary.toLowerCase();
  const sym = ticker.toLowerCase();

  for (const rule of RULES) {
    const texts = rule.headlineOnly ? [hl] : [hl, sm];

    // Primary keyword match
    if (!texts.some((t) => rule.keywords.some((kw) => t.includes(kw)))) continue;

    // Ticker must appear in headline
    if (rule.requireTickerInHeadline && !hl.includes(sym)) continue;

    // Negative keyword check (headline)
    if (rule.negativeKeywords?.some((nk) => hl.includes(nk))) continue;

    // General market context check — if headline signals a broad market story, skip
    if (rule.negativeContextKeywords?.some((nk) => hl.includes(nk))) continue;

    return rule.type;
  }
  return "news";
}
