import type { NotifType } from "./graphTypes";

// Ordered rules — first match wins. Checked against headline then summary.
const RULES: Array<{ type: NotifType; keywords: string[] }> = [
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
    keywords: ["short squeeze", "short interest", "heavily shorted", "days to cover"],
  },
  {
    type: "split",
    keywords: ["stock split", "reverse split", "secondary offering", "share offering"],
  },
  {
    // "delisting" covers acquisitions/mergers — labelled "Delisting / Acquisition" in the UI
    type: "delisting",
    keywords: ["acquisition", "merger", "buyout", "takeover", "acquire"],
  },
  {
    type: "ipo",
    keywords: ["ipo", "initial public offering", "going public", "listing"],
  },
];

export function classifyNews(headline: string, summary: string): NotifType {
  for (const text of [headline.toLowerCase(), summary.toLowerCase()]) {
    for (const rule of RULES) {
      if (rule.keywords.some((kw) => text.includes(kw))) return rule.type;
    }
  }
  return "news";
}
