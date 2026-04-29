"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type NotifType, NOTIF, moveColor } from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewsItem {
  headline: string;
  source: string;
  date: string;
  type: NotifType;
}

interface MetricItem {
  label: string;
  value: string;
}

interface StockData {
  name: string;
  price: number;
  dailyMove: number;
  notifications: Array<{ type: NotifType }>;
  description: string;
  metrics: MetricItem[];
  sentiment: number;
  news: NewsItem[];
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

const STOCK_DB: Record<string, StockData> = {
  NVDA: {
    name: "NVIDIA Corporation",
    price: 875.40,
    dailyMove: 5.2,
    notifications: [{ type: "earnings" }],
    description:
      "NVIDIA designs graphics processing units and system-on-chip units that power artificial intelligence workloads, gaming, and professional visualisation. The company's CUDA software platform has created a dominant ecosystem that makes its hardware the default choice for AI model training at hyperscalers and research institutions worldwide. Successive GPU architectures — Hopper and the upcoming Blackwell — continue to expand its addressable market across data centres, edge inference, and autonomous vehicles.",
    metrics: [
      { label: "Market Cap",            value: "$2.16 T"  },
      { label: "P/E Ratio",             value: "68.4×"   },
      { label: "EPS (TTM)",             value: "$12.79"  },
      { label: "52-Week High",          value: "$974.00" },
      { label: "52-Week Low",           value: "$373.28" },
      { label: "Volume",                value: "41.2 M"  },
      { label: "Avg Volume (90d)",      value: "38.7 M"  },
      { label: "Short Interest",        value: "0.8%"    },
      { label: "Consecutive Up Days",   value: "4"       },
      { label: "Dist. from 52W High",   value: "−10.1%" },
      { label: "Dist. from 52W Low",    value: "+134.5%"},
      { label: "Relative Volume",       value: "1.06×"  },
    ],
    sentiment: 82,
    news: [
      { headline: "NVIDIA Blackwell shipments accelerate ahead of schedule",                       source: "Reuters",       date: "Apr 28, 2026", type: "news"     },
      { headline: "Analyst raises NVDA price target to $1,100 on data-centre demand",             source: "Morgan Stanley", date: "Apr 25, 2026", type: "analyst"  },
      { headline: "NVIDIA reports record Q1 revenue; beats consensus on EPS",                     source: "Bloomberg",     date: "Apr 22, 2026", type: "earnings" },
      { headline: "NVDA options activity spikes — elevated short-squeeze risk flagged",            source: "Market Watch",  date: "Apr 18, 2026", type: "squeeze"  },
      { headline: "US government clears H20 chip exports to select allied markets",               source: "WSJ",           date: "Apr 15, 2026", type: "news"     },
    ],
  },
  MSFT: {
    name: "Microsoft Corporation",
    price: 415.26,
    dailyMove: 0.9,
    notifications: [],
    description:
      "Microsoft operates one of the world's largest cloud platforms (Azure), a dominant productivity suite (Microsoft 365), and a growing AI business built on its deep partnership with OpenAI. Azure is gaining enterprise workloads at pace, aided by Copilot integrations that embed AI directly into the tools organisations already use. The company's diversified revenue mix — cloud, gaming, LinkedIn, advertising — provides resilience across economic cycles.",
    metrics: [
      { label: "Market Cap",            value: "$3.09 T"  },
      { label: "P/E Ratio",             value: "34.2×"   },
      { label: "EPS (TTM)",             value: "$12.13"  },
      { label: "52-Week High",          value: "$468.35" },
      { label: "52-Week Low",           value: "$385.58" },
      { label: "Volume",                value: "22.1 M"  },
      { label: "Avg Volume (90d)",      value: "20.4 M"  },
      { label: "Short Interest",        value: "0.4%"    },
      { label: "Consecutive Up Days",   value: "2"       },
      { label: "Dist. from 52W High",   value: "−11.4%" },
      { label: "Dist. from 52W Low",    value: "+7.7%"  },
      { label: "Relative Volume",       value: "1.08×"  },
    ],
    sentiment: 74,
    news: [
      { headline: "Azure revenue grows 33% YoY in Q3, beats analyst estimates",     source: "Bloomberg",    date: "Apr 27, 2026", type: "news"    },
      { headline: "Copilot Pro reaches 50 million paid subscribers globally",        source: "Reuters",      date: "Apr 24, 2026", type: "news"    },
      { headline: "Goldman Sachs raises MSFT price target to $510",                 source: "Goldman Sachs",date: "Apr 20, 2026", type: "analyst" },
    ],
  },
  PLTR: {
    name: "Palantir Technologies",
    price: 24.38,
    dailyMove: 3.1,
    notifications: [{ type: "news" }],
    description:
      "Palantir builds data analytics and AI platforms for government intelligence agencies and large commercial enterprises. Its Gotham platform serves defence and intelligence clients; Foundry targets commercial operators; and the newer AIP product brings large-language-model capabilities to sensitive enterprise environments. Recent commercial growth has accelerated as AIP adoption widens beyond its traditional government base.",
    metrics: [
      { label: "Market Cap",            value: "$52.4 B"  },
      { label: "P/E Ratio",             value: "210.2×"  },
      { label: "EPS (TTM)",             value: "$0.12"   },
      { label: "52-Week High",          value: "$27.50"  },
      { label: "52-Week Low",           value: "$14.84"  },
      { label: "Volume",                value: "56.8 M"  },
      { label: "Avg Volume (90d)",      value: "52.3 M"  },
      { label: "Short Interest",        value: "3.1%"    },
      { label: "Consecutive Up Days",   value: "3"       },
      { label: "Dist. from 52W High",   value: "−11.3%" },
      { label: "Dist. from 52W Low",    value: "+64.3%" },
      { label: "Relative Volume",       value: "1.09×"  },
    ],
    sentiment: 71,
    news: [
      { headline: "Palantir wins $480 M US Army AI contract extension",              source: "Defense News", date: "Apr 28, 2026", type: "news"    },
      { headline: "AIP commercial revenue up 55% YoY in Q1",                        source: "Bloomberg",    date: "Apr 23, 2026", type: "news"    },
      { headline: "Analyst initiates PLTR at Buy with $32 target",                  source: "Wedbush",      date: "Apr 19, 2026", type: "analyst" },
    ],
  },
  AMD: {
    name: "Advanced Micro Devices",
    price: 172.84,
    dailyMove: 2.4,
    notifications: [],
    description:
      "AMD designs high-performance CPUs, GPUs, and adaptive computing solutions for PC, server, and embedded markets. Its EPYC server CPU line continues to take share from Intel, while its MI300X AI accelerators are gaining traction as a lower-cost alternative to NVIDIA's H100. The company benefits from rising data-centre capex as cloud providers seek GPU supply diversity.",
    metrics: [
      { label: "Market Cap",            value: "$279.6 B" },
      { label: "P/E Ratio",             value: "48.7×"   },
      { label: "EPS (TTM)",             value: "$3.55"   },
      { label: "52-Week High",          value: "$227.30" },
      { label: "52-Week Low",           value: "$120.07" },
      { label: "Volume",                value: "35.4 M"  },
      { label: "Avg Volume (90d)",      value: "33.1 M"  },
      { label: "Short Interest",        value: "1.6%"    },
      { label: "Consecutive Up Days",   value: "3"       },
      { label: "Dist. from 52W High",   value: "−23.9%" },
      { label: "Dist. from 52W Low",    value: "+44.0%" },
      { label: "Relative Volume",       value: "1.07×"  },
    ],
    sentiment: 68,
    news: [
      { headline: "AMD MI300X wins Oracle Cloud contract for AI inference",          source: "Reuters",      date: "Apr 27, 2026", type: "news"    },
      { headline: "EPYC server CPU shipments reach record quarterly volumes",        source: "Tom's Hardware",date: "Apr 22, 2026", type: "news"    },
      { headline: "AMD raises full-year guidance on data-centre GPU demand",         source: "Bloomberg",    date: "Apr 18, 2026", type: "analyst" },
    ],
  },
  ARM: {
    name: "Arm Holdings",
    price: 118.62,
    dailyMove: 4.8,
    notifications: [{ type: "earnings" }],
    description:
      "Arm designs the instruction set architecture and processor IP that powers the vast majority of mobile devices, and increasingly servers, automotive systems, and AI edge inference chips. The company earns royalties on every chip shipped, giving it a unique leverage model across the semiconductor industry. Its v9 architecture commands higher royalty rates than prior generations, providing a structural revenue tailwind as existing v8 device fleets cycle through.",
    metrics: [
      { label: "Market Cap",            value: "$124.3 B" },
      { label: "P/E Ratio",             value: "91.8×"   },
      { label: "EPS (TTM)",             value: "$1.29"   },
      { label: "52-Week High",          value: "$188.75" },
      { label: "52-Week Low",           value: "$74.68"  },
      { label: "Volume",                value: "18.2 M"  },
      { label: "Avg Volume (90d)",      value: "16.4 M"  },
      { label: "Short Interest",        value: "1.2%"    },
      { label: "Consecutive Up Days",   value: "4"       },
      { label: "Dist. from 52W High",   value: "−37.1%" },
      { label: "Dist. from 52W Low",    value: "+58.8%" },
      { label: "Relative Volume",       value: "1.11×"  },
    ],
    sentiment: 79,
    news: [
      { headline: "Arm Q4 earnings beat on record royalty revenue from v9 adoption",   source: "Bloomberg", date: "Apr 29, 2026", type: "earnings" },
      { headline: "Apple confirms all 2026 Mac line will ship on Arm architecture",    source: "9to5Mac",   date: "Apr 25, 2026", type: "news"     },
      { headline: "Analyst raises ARM target to $160 on server CPU royalty upside",   source: "BofA",      date: "Apr 21, 2026", type: "analyst"  },
    ],
  },
  XOM: {
    name: "ExxonMobil Corporation",
    price: 118.24,
    dailyMove: -1.2,
    notifications: [{ type: "analyst" }],
    description:
      "ExxonMobil is one of the world's largest vertically integrated oil and gas companies, with operations spanning upstream exploration, refining, chemicals, and carbon capture. The company's Permian Basin position is among the most capital-efficient in the industry, and ExxonMobil has committed to significant low-carbon investments while maintaining dividend growth as a core shareholder return mechanism.",
    metrics: [
      { label: "Market Cap",             value: "$472.8 B" },
      { label: "P/E Ratio",              value: "13.4×"   },
      { label: "EPS (TTM)",              value: "$8.83"   },
      { label: "52-Week High",           value: "$126.34" },
      { label: "52-Week Low",            value: "$98.73"  },
      { label: "Volume",                 value: "15.6 M"  },
      { label: "Avg Volume (90d)",       value: "16.8 M"  },
      { label: "Short Interest",         value: "0.6%"    },
      { label: "Consecutive Down Days",  value: "2"       },
      { label: "Dist. from 52W High",    value: "−6.4%"  },
      { label: "Dist. from 52W Low",     value: "+19.8%" },
      { label: "Relative Volume",        value: "0.93×"  },
    ],
    sentiment: 38,
    news: [
      { headline: "Morgan Stanley downgrades XOM to Equal Weight on oil price outlook", source: "Morgan Stanley", date: "Apr 27, 2026", type: "analyst" },
      { headline: "Brent crude falls 3% on demand concerns from China macro data",      source: "Reuters",        date: "Apr 25, 2026", type: "news"    },
      { headline: "ExxonMobil expands Permian output by 100 kbpd in Q1 report",        source: "Bloomberg",      date: "Apr 20, 2026", type: "news"    },
    ],
  },
  CVX: {
    name: "Chevron Corporation",
    price: 158.90,
    dailyMove: -0.9,
    notifications: [],
    description:
      "Chevron is a global integrated energy company with major upstream assets in the Permian Basin, Kazakhstan, and Australia. The company's acquisition of Hess bolstered its Guyana exposure — one of the most prolific new offshore discoveries of the past decade. Chevron returns capital to shareholders through dividends and buybacks while managing a measured energy transition strategy.",
    metrics: [
      { label: "Market Cap",             value: "$293.1 B" },
      { label: "P/E Ratio",              value: "15.1×"   },
      { label: "EPS (TTM)",              value: "$10.52"  },
      { label: "52-Week High",           value: "$168.96" },
      { label: "52-Week Low",            value: "$132.47" },
      { label: "Volume",                 value: "11.3 M"  },
      { label: "Avg Volume (90d)",       value: "11.9 M"  },
      { label: "Short Interest",         value: "0.7%"    },
      { label: "Consecutive Down Days",  value: "2"       },
      { label: "Dist. from 52W High",    value: "−5.9%"  },
      { label: "Dist. from 52W Low",     value: "+19.9%" },
      { label: "Relative Volume",        value: "0.95×"  },
    ],
    sentiment: 42,
    news: [
      { headline: "Chevron Guyana output rises 12% QoQ in first-quarter report",    source: "Reuters",   date: "Apr 26, 2026", type: "news"    },
      { headline: "Hess integration on track; synergies tracking ahead of plan",    source: "Bloomberg", date: "Apr 22, 2026", type: "news"    },
      { headline: "Analyst trims CVX target to $175 as crude softens",              source: "Citigroup", date: "Apr 18, 2026", type: "analyst" },
    ],
  },
  FANG: {
    name: "Diamondback Energy",
    price: 194.52,
    dailyMove: 2.1,
    notifications: [],
    description:
      "Diamondback Energy is a pure-play Permian Basin operator focused on low-cost oil and gas production in the Midland and Delaware sub-basins. The Endeavor Energy acquisition added significant Midland Basin inventory at attractive per-acre values. Diamondback combines a high free-cash-flow generation profile with a variable plus base dividend framework that rewards shareholders directly from production economics.",
    metrics: [
      { label: "Market Cap",            value: "$35.8 B"  },
      { label: "P/E Ratio",             value: "9.6×"    },
      { label: "EPS (TTM)",             value: "$20.26"  },
      { label: "52-Week High",          value: "$218.40" },
      { label: "52-Week Low",           value: "$154.32" },
      { label: "Volume",                value: "3.8 M"   },
      { label: "Avg Volume (90d)",      value: "3.6 M"   },
      { label: "Short Interest",        value: "1.4%"    },
      { label: "Consecutive Up Days",   value: "2"       },
      { label: "Dist. from 52W High",   value: "−10.9%" },
      { label: "Dist. from 52W Low",    value: "+26.1%" },
      { label: "Relative Volume",       value: "1.06×"  },
    ],
    sentiment: 58,
    news: [
      { headline: "Diamondback raises dividend after record free cash flow quarter",          source: "Bloomberg",  date: "Apr 26, 2026", type: "news"    },
      { headline: "Endeavor integration drives Midland well cost below $550 per lateral ft", source: "Hart Energy", date: "Apr 21, 2026", type: "news"    },
      { headline: "FANG upgraded to Overweight at JP Morgan on Permian cost leadership",     source: "JP Morgan",  date: "Apr 17, 2026", type: "analyst" },
    ],
  },
  SLB: {
    name: "SLB (Schlumberger)",
    price: 44.18,
    dailyMove: -1.8,
    notifications: [{ type: "squeeze" }],
    description:
      "SLB is the world's leading oilfield services company, providing technology, information solutions, and integrated project management across the exploration and production lifecycle. The company benefits from sustained upstream investment in the Middle East and offshore markets while navigating softness in North American land activity. Its digital division — which provides AI-driven reservoir modelling — represents an emerging growth avenue.",
    metrics: [
      { label: "Market Cap",             value: "$63.2 B"  },
      { label: "P/E Ratio",              value: "14.8×"   },
      { label: "EPS (TTM)",              value: "$2.98"   },
      { label: "52-Week High",           value: "$55.19"  },
      { label: "52-Week Low",            value: "$37.62"  },
      { label: "Volume",                 value: "19.4 M"  },
      { label: "Avg Volume (90d)",       value: "17.2 M"  },
      { label: "Short Interest",         value: "4.2%"    },
      { label: "Consecutive Down Days",  value: "3"       },
      { label: "Dist. from 52W High",    value: "−19.9%" },
      { label: "Dist. from 52W Low",     value: "+17.4%" },
      { label: "Relative Volume",        value: "1.13×"  },
    ],
    sentiment: 31,
    news: [
      { headline: "SLB short interest spikes to multi-year high on sector selling",      source: "S3 Partners", date: "Apr 28, 2026", type: "squeeze" },
      { headline: "North America land activity contracts 8% from prior quarter",         source: "Reuters",     date: "Apr 24, 2026", type: "news"    },
      { headline: "SLB international revenue holds up on Middle East capex growth",      source: "Bloomberg",   date: "Apr 20, 2026", type: "news"    },
    ],
  },
  HIMS: {
    name: "Hims & Hers Health",
    price: 21.44,
    dailyMove: 12.3,
    notifications: [{ type: "news" }, { type: "analyst" }],
    description:
      "Hims & Hers is a telehealth and consumer health platform offering subscription-based personalised treatments for hair loss, erectile dysfunction, mental health, and weight management. The company's direct-to-consumer model bypasses traditional healthcare distribution and drives high lifetime value from recurring prescription subscriptions. GLP-1 compounding approvals have opened a major new market opportunity, though regulatory scrutiny remains a key risk.",
    metrics: [
      { label: "Market Cap",            value: "$4.8 B"   },
      { label: "P/E Ratio",             value: "n/m"     },
      { label: "EPS (TTM)",             value: "−$0.11"  },
      { label: "52-Week High",          value: "$72.94"  },
      { label: "52-Week Low",           value: "$8.46"   },
      { label: "Volume",                value: "68.3 M"  },
      { label: "Avg Volume (90d)",      value: "32.4 M"  },
      { label: "Short Interest",        value: "18.6%"   },
      { label: "Consecutive Up Days",   value: "1"       },
      { label: "Dist. from 52W High",   value: "−70.6%" },
      { label: "Dist. from 52W Low",    value: "+153.4%"},
      { label: "Relative Volume",       value: "2.11×"  },
    ],
    sentiment: 85,
    news: [
      { headline: "Hims wins court ruling preserving GLP-1 compounding rights through 2026", source: "Bloomberg", date: "Apr 29, 2026", type: "news"    },
      { headline: "Subscriber count beats Q1 estimates by 14% on weight-loss demand",        source: "Reuters",   date: "Apr 26, 2026", type: "news"    },
      { headline: "Wedbush raises HIMS target to $35; cites GLP-1 optionality",              source: "Wedbush",   date: "Apr 22, 2026", type: "analyst" },
      { headline: "FDA reviews compounding pharmacy framework for GLP-1 drugs",              source: "STAT News", date: "Apr 18, 2026", type: "news"    },
    ],
  },
  RXRX: {
    name: "Recursion Pharmaceuticals",
    price: 5.82,
    dailyMove: 4.1,
    notifications: [{ type: "analyst" }],
    description:
      "Recursion uses machine learning and high-throughput biological experiments to decode biology and accelerate drug discovery. Its operating system — combining robotics, computer vision, and foundation models — has generated one of the largest proprietary biological datasets in existence. Pipeline assets span rare diseases, oncology, and infectious disease, with several programmes currently in clinical trials.",
    metrics: [
      { label: "Market Cap",            value: "$1.4 B"   },
      { label: "P/E Ratio",             value: "n/m"     },
      { label: "EPS (TTM)",             value: "−$1.42"  },
      { label: "52-Week High",          value: "$11.68"  },
      { label: "52-Week Low",           value: "$3.74"   },
      { label: "Volume",                value: "8.2 M"   },
      { label: "Avg Volume (90d)",      value: "7.6 M"   },
      { label: "Short Interest",        value: "6.8%"    },
      { label: "Consecutive Up Days",   value: "3"       },
      { label: "Dist. from 52W High",   value: "−50.2%" },
      { label: "Dist. from 52W Low",    value: "+55.6%" },
      { label: "Relative Volume",       value: "1.08×"  },
    ],
    sentiment: 63,
    news: [
      { headline: "Recursion Phase 2 rare disease trial shows early efficacy signal",        source: "STAT News", date: "Apr 27, 2026", type: "analyst" },
      { headline: "RXRX AI platform partnership with NVIDIA expands to drug target ID",      source: "Reuters",   date: "Apr 22, 2026", type: "news"    },
      { headline: "New paper: Recursion maps 2.4 M biological relationships in dataset",     source: "Nature",    date: "Apr 16, 2026", type: "news"    },
    ],
  },
  LLY: {
    name: "Eli Lilly and Company",
    price: 803.28,
    dailyMove: -0.6,
    notifications: [],
    description:
      "Eli Lilly is a global pharmaceutical company whose portfolio transformation has been driven by blockbuster GLP-1 drugs — Mounjaro for diabetes and Zepbound for obesity. These products address a combined addressable market analysts estimate exceeds $150 billion annually. The company is investing heavily in manufacturing capacity to meet extraordinary demand while its oncology and neuroscience pipeline provides longer-term growth optionality.",
    metrics: [
      { label: "Market Cap",             value: "$762.1 B" },
      { label: "P/E Ratio",              value: "51.3×"   },
      { label: "EPS (TTM)",              value: "$15.66"  },
      { label: "52-Week High",           value: "$972.53" },
      { label: "52-Week Low",            value: "$661.54" },
      { label: "Volume",                 value: "3.6 M"   },
      { label: "Avg Volume (90d)",       value: "3.8 M"   },
      { label: "Short Interest",         value: "0.5%"    },
      { label: "Consecutive Down Days",  value: "2"       },
      { label: "Dist. from 52W High",    value: "−17.4%" },
      { label: "Dist. from 52W Low",     value: "+21.4%" },
      { label: "Relative Volume",        value: "0.95×"  },
    ],
    sentiment: 66,
    news: [
      { headline: "Lilly Zepbound supply constraints ease as new plant comes online",         source: "Reuters",   date: "Apr 27, 2026", type: "news"    },
      { headline: "Phase 3 Alzheimer's trial for donanemab meets primary endpoint",          source: "Bloomberg", date: "Apr 23, 2026", type: "news"    },
      { headline: "LLY price target trimmed to $950 at UBS on manufacturing timeline risk",  source: "UBS",       date: "Apr 19, 2026", type: "analyst" },
    ],
  },
  MRNA: {
    name: "Moderna Inc.",
    price: 75.60,
    dailyMove: -2.3,
    notifications: [],
    description:
      "Moderna is an mRNA medicine company best known for its COVID-19 vaccine. Post-pandemic, the company is racing to commercialise its mRNA platform across influenza, RSV, personalised cancer vaccines, and rare diseases. Revenue has declined significantly from peak COVID vaccine sales, creating pressure to demonstrate platform breadth through new approvals before its cash runway requires capital markets access.",
    metrics: [
      { label: "Market Cap",             value: "$28.7 B"  },
      { label: "P/E Ratio",              value: "n/m"     },
      { label: "EPS (TTM)",              value: "−$9.66"  },
      { label: "52-Week High",           value: "$168.29" },
      { label: "52-Week Low",            value: "$57.42"  },
      { label: "Volume",                 value: "9.1 M"   },
      { label: "Avg Volume (90d)",       value: "9.8 M"   },
      { label: "Short Interest",         value: "9.3%"    },
      { label: "Consecutive Down Days",  value: "2"       },
      { label: "Dist. from 52W High",    value: "−55.1%" },
      { label: "Dist. from 52W Low",     value: "+31.6%" },
      { label: "Relative Volume",        value: "0.93×"  },
    ],
    sentiment: 39,
    news: [
      { headline: "Moderna's mRNA flu vaccine Phase 3 misses efficacy vs. standard-of-care", source: "STAT News", date: "Apr 28, 2026", type: "news" },
      { headline: "Cash burn triggers concern; company reaffirms 2026 guidance",             source: "Bloomberg", date: "Apr 24, 2026", type: "news" },
      { headline: "Personalised cancer vaccine mRNA-4157 shows durable 3-year response",    source: "Reuters",   date: "Apr 19, 2026", type: "news" },
    ],
  },
  SOFI: {
    name: "SoFi Technologies",
    price: 8.42,
    dailyMove: 4.2,
    notifications: [{ type: "news" }],
    description:
      "SoFi Technologies is a digital personal finance company offering student loan refinancing, personal loans, mortgages, credit cards, investing, and banking services under one app. Its bank charter, obtained in 2022, lowered its cost of deposits materially and enabled a lending flywheel alongside technology and financial services revenue. The Galileo and Technisys acquisitions have built a B2B fintech infrastructure business that diversifies revenue beyond consumer lending.",
    metrics: [
      { label: "Market Cap",            value: "$8.9 B"   },
      { label: "P/E Ratio",             value: "n/m"     },
      { label: "EPS (TTM)",             value: "−$0.07"  },
      { label: "52-Week High",          value: "$10.34"  },
      { label: "52-Week Low",           value: "$5.22"   },
      { label: "Volume",                value: "41.6 M"  },
      { label: "Avg Volume (90d)",      value: "38.4 M"  },
      { label: "Short Interest",        value: "7.2%"    },
      { label: "Consecutive Up Days",   value: "3"       },
      { label: "Dist. from 52W High",   value: "−18.6%" },
      { label: "Dist. from 52W Low",    value: "+61.3%" },
      { label: "Relative Volume",       value: "1.08×"  },
    ],
    sentiment: 72,
    news: [
      { headline: "SoFi reaches profitability milestone with first GAAP-positive quarter", source: "Bloomberg", date: "Apr 28, 2026", type: "news"    },
      { headline: "Member count surpasses 10 million; financial services products surge", source: "Reuters",   date: "Apr 24, 2026", type: "news"    },
      { headline: "SOFI upgraded to Buy at BTIG; $12 target on lending recovery",         source: "BTIG",      date: "Apr 20, 2026", type: "analyst" },
    ],
  },
  AFRM: {
    name: "Affirm Holdings",
    price: 35.18,
    dailyMove: 3.8,
    notifications: [],
    description:
      "Affirm is a buy-now-pay-later lender that integrates directly into merchant checkout flows to offer instalment payment plans to consumers. The company has expanded beyond retail into travel, healthcare, and large-ticket purchases, and its Apple Pay integration significantly broadened its distribution. Affirm distinguishes itself from competitors by not charging late fees, relying on interest income and merchant fees instead.",
    metrics: [
      { label: "Market Cap",            value: "$11.1 B"  },
      { label: "P/E Ratio",             value: "n/m"     },
      { label: "EPS (TTM)",             value: "−$1.02"  },
      { label: "52-Week High",          value: "$54.73"  },
      { label: "52-Week Low",           value: "$21.49"  },
      { label: "Volume",                value: "8.4 M"   },
      { label: "Avg Volume (90d)",      value: "7.9 M"   },
      { label: "Short Interest",        value: "5.8%"    },
      { label: "Consecutive Up Days",   value: "3"       },
      { label: "Dist. from 52W High",   value: "−35.7%" },
      { label: "Dist. from 52W Low",    value: "+63.7%" },
      { label: "Relative Volume",       value: "1.06×"  },
    ],
    sentiment: 67,
    news: [
      { headline: "Affirm GMV grows 40% YoY; Apple Pay integration drives broad adoption", source: "Bloomberg", date: "Apr 27, 2026", type: "news"    },
      { headline: "Delinquency rates fall to two-year low as credit environment improves", source: "Reuters",   date: "Apr 23, 2026", type: "news"    },
      { headline: "AFRM price target raised to $50 at Jefferies on commerce acceleration", source: "Jefferies", date: "Apr 18, 2026", type: "analyst" },
    ],
  },
  PYPL: {
    name: "PayPal Holdings",
    price: 63.44,
    dailyMove: -0.8,
    notifications: [],
    description:
      "PayPal is a global digital payments platform serving over 400 million active accounts across consumer and merchant segments. New leadership has refocused the company on profitability and omnichannel commerce features rather than user growth. Fastlane (guest checkout acceleration) and Pay with Venmo are the company's near-term catalysts as it battles Apple Pay and emerging BNPL players for checkout share.",
    metrics: [
      { label: "Market Cap",             value: "$67.2 B"  },
      { label: "P/E Ratio",              value: "17.4×"   },
      { label: "EPS (TTM)",              value: "$3.65"   },
      { label: "52-Week High",           value: "$88.95"  },
      { label: "52-Week Low",            value: "$52.73"  },
      { label: "Volume",                 value: "12.8 M"  },
      { label: "Avg Volume (90d)",       value: "12.4 M"  },
      { label: "Short Interest",         value: "2.1%"    },
      { label: "Consecutive Down Days",  value: "2"       },
      { label: "Dist. from 52W High",    value: "−28.7%" },
      { label: "Dist. from 52W Low",     value: "+20.3%" },
      { label: "Relative Volume",        value: "1.03×"  },
    ],
    sentiment: 44,
    news: [
      { headline: "PayPal Fastlane checkout adoption reaches 1,000 merchant integrations", source: "Bloomberg", date: "Apr 26, 2026", type: "news"    },
      { headline: "Venmo monetisation improves as Pay with Venmo volumes double YoY",      source: "Reuters",   date: "Apr 22, 2026", type: "news"    },
      { headline: "PYPL maintained at Neutral; execution risk remains elevated — analyst", source: "Barclays",  date: "Apr 17, 2026", type: "analyst" },
    ],
  },
  COIN: {
    name: "Coinbase Global",
    price: 215.80,
    dailyMove: 6.1,
    notifications: [{ type: "split" }],
    description:
      "Coinbase is the largest regulated cryptocurrency exchange in the United States, providing trading, custody, staking, and developer services for retail and institutional clients. The company benefits from regulatory clarity and has expanded its institutional prime brokerage and layer-2 Base network. Its revenue is highly correlated with crypto market volumes, making it a leveraged play on digital asset sentiment.",
    metrics: [
      { label: "Market Cap",            value: "$52.6 B"  },
      { label: "P/E Ratio",             value: "28.4×"   },
      { label: "EPS (TTM)",             value: "$7.60"   },
      { label: "52-Week High",          value: "$349.75" },
      { label: "52-Week Low",           value: "$130.21" },
      { label: "Volume",                value: "7.3 M"   },
      { label: "Avg Volume (90d)",      value: "6.8 M"   },
      { label: "Short Interest",        value: "8.4%"    },
      { label: "Consecutive Up Days",   value: "4"       },
      { label: "Dist. from 52W High",   value: "−38.3%" },
      { label: "Dist. from 52W Low",    value: "+65.7%" },
      { label: "Relative Volume",       value: "1.07×"  },
    ],
    sentiment: 77,
    news: [
      { headline: "Coinbase announces 10-for-1 stock split effective May 15",        source: "Bloomberg", date: "Apr 29, 2026", type: "split" },
      { headline: "Bitcoin ETF net inflows hit record $2.4 B in a single week",      source: "Reuters",   date: "Apr 25, 2026", type: "news"  },
      { headline: "Base network daily transactions surpass 10 million milestone",    source: "The Block", date: "Apr 21, 2026", type: "news"  },
    ],
  },
  HOOD: {
    name: "Robinhood Markets",
    price: 22.36,
    dailyMove: 5.4,
    notifications: [],
    description:
      "Robinhood is a retail-focused financial services platform offering commission-free trading in stocks, options, and cryptocurrency alongside cash management, retirement accounts, and credit cards. The Gold subscription tier provides a stable recurring revenue layer on top of volatile payment-for-order-flow income. International expansion into the UK and EU represents an emerging growth vector alongside continued product breadth expansion.",
    metrics: [
      { label: "Market Cap",            value: "$20.3 B"  },
      { label: "P/E Ratio",             value: "44.1×"   },
      { label: "EPS (TTM)",             value: "$0.51"   },
      { label: "52-Week High",          value: "$42.38"  },
      { label: "52-Week Low",           value: "$12.58"  },
      { label: "Volume",                value: "22.7 M"  },
      { label: "Avg Volume (90d)",      value: "20.4 M"  },
      { label: "Short Interest",        value: "4.6%"    },
      { label: "Consecutive Up Days",   value: "4"       },
      { label: "Dist. from 52W High",   value: "−47.3%" },
      { label: "Dist. from 52W Low",    value: "+77.7%" },
      { label: "Relative Volume",       value: "1.11×"  },
    ],
    sentiment: 69,
    news: [
      { headline: "Robinhood Gold subscribers reach 3 million, driving recurring revenue", source: "Bloomberg", date: "Apr 28, 2026", type: "news" },
      { headline: "HOOD crypto trading volumes jump 80% as Bitcoin rallies",               source: "Reuters",   date: "Apr 24, 2026", type: "news" },
      { headline: "UK launch adds 400,000 customers in first three months of operation",   source: "FT",        date: "Apr 20, 2026", type: "news" },
    ],
  },
  SMCI: {
    name: "Super Micro Computer",
    price: 38.42,
    dailyMove: 2.8,
    notifications: [{ type: "analyst" }],
    description:
      "Super Micro Computer designs and manufactures high-performance server and storage solutions with a specialisation in GPU-dense AI training and inference infrastructure. The company is a key supply-chain beneficiary of NVIDIA GPU demand, building rack-scale systems that hyperscalers and enterprise clients deploy for large AI workloads. After navigating significant accounting-related regulatory scrutiny through 2024–25, SMCI filed its delayed financial statements and is working to restore investor confidence while continuing to participate in the AI infrastructure buildout.",
    metrics: [
      { label: "Market Cap",            value: "$2.3 B"   },
      { label: "P/E Ratio",             value: "8.2×"    },
      { label: "EPS (TTM)",             value: "$4.68"   },
      { label: "52-Week High",          value: "$118.64" },
      { label: "52-Week Low",           value: "$18.43"  },
      { label: "Volume",                value: "12.4 M"  },
      { label: "Avg Volume (90d)",      value: "15.2 M"  },
      { label: "Short Interest",        value: "8.6%"    },
      { label: "Consecutive Up Days",   value: "2"       },
      { label: "Dist. from 52W High",   value: "−67.6%" },
      { label: "Dist. from 52W Low",    value: "+108.4%"},
      { label: "Relative Volume",       value: "0.82×"  },
    ],
    sentiment: 52,
    news: [
      { headline: "Super Micro files delayed 10-K; auditor issues clean opinion",          source: "Bloomberg", date: "Apr 26, 2026", type: "news"    },
      { headline: "Analyst initiates SMCI at Hold; monitors audit recovery progress",      source: "Barclays",  date: "Apr 22, 2026", type: "analyst" },
      { headline: "Super Micro ships record GPU server volume in Q1 on AI demand",         source: "Reuters",   date: "Apr 18, 2026", type: "news"    },
    ],
  },
};

function getStockData(ticker: string): StockData {
  return (
    STOCK_DB[ticker] ?? {
      name: `${ticker} Inc.`,
      price: 100.0,
      dailyMove: 0,
      notifications: [],
      description:
        "Company overview data will be available once connected to a live data source. This section will display a 2–3 sentence summary of the company's business model, competitive positioning, and strategic priorities relevant to current market conditions.",
      metrics: [
        { label: "Market Cap",           value: "—" },
        { label: "P/E Ratio",            value: "—" },
        { label: "EPS (TTM)",            value: "—" },
        { label: "52-Week High",         value: "—" },
        { label: "52-Week Low",          value: "—" },
        { label: "Volume",               value: "—" },
        { label: "Avg Volume (90d)",     value: "—" },
        { label: "Short Interest",       value: "—" },
        { label: "Consecutive Up Days",  value: "—" },
        { label: "Dist. from 52W High",  value: "—" },
        { label: "Dist. from 52W Low",   value: "—" },
        { label: "Relative Volume",      value: "—" },
      ],
      sentiment: 50,
      news: [],
    }
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ type }: { type: NotifType }) {
  const n = NOTIF[type];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: n.color + "18",
        border: `1px solid ${n.color}35`,
        borderRadius: 20,
        padding: "3px 10px 3px 7px",
        flexShrink: 0,
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: n.color }} />
      <span style={{ fontSize: 11, color: n.color, fontWeight: 400, whiteSpace: "nowrap" }}>
        {n.label}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          padding: "14px 0",
          cursor: "pointer",
          fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#64748b",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="#475569"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        style={{
          overflow: "hidden",
          maxHeight: open ? "2000px" : "0",
          transition: "max-height 0.3s ease",
        }}
      >
        <div style={{ paddingTop: 20, paddingBottom: 28 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Link row ─────────────────────────────────────────────────────────────────

function PlaceholderLink({ label }: { label: string }) {
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 16px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 8,
        color: "#3b82f6",
        fontSize: 14,
        textDecoration: "none",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        fontWeight: 300,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 7H11M8 4L11 7L8 10"
          stroke="#3b82f6"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }

export default function StockDetail({ ticker }: { ticker: string }) {
  const router = useRouter();
  const data = getStockData(ticker);

  const [live, setLive] = useState<LiveEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cached = getCachedMarketData();
    if (cached) {
      if (cached[ticker]) setLive(cached[ticker]);
      setLoaded(true);
      return;
    }

    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json) setCachedMarketData(json);
        if (json?.[ticker]) setLive(json[ticker]);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, [ticker]);

  const displayPrice     = live?.price     ?? data.price;
  const displayMove      = live?.dailyMove ?? data.dailyMove;
  const displayMoveDollar = live != null
    ? Math.abs(live.dailyMoveDollar)
    : Math.abs((data.price * data.dailyMove) / 100);

  const col     = moveColor(displayMove);
  const sign    = displayMove >= 0 ? "+" : "";
  const dolSign = displayMove >= 0 ? "+" : "−";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07090f",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        color: "#f1f5f9",
      }}
    >
      {/* Back button */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 32px 0" }}>
        <button
          onClick={() => router.push("/graph")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#475569",
            fontSize: 13,
            fontWeight: 400,
            padding: 0,
            fontFamily: "inherit",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8L10 13"
              stroke="#475569"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Graph
        </button>
      </div>

      {/* Main container */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 32px 80px" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            paddingBottom: 28,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            marginBottom: 8,
          }}
        >
          {/* Ticker + price row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                  color: "#f1f5f9",
                  marginBottom: 8,
                }}
              >
                {ticker}
              </div>
              <div style={{ fontSize: 16, color: "#475569", fontWeight: 300 }}>
                {data.name}
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {!loaded ? (
                <>
                  <div style={{ height: 40, width: 132, background: "rgba(255,255,255,0.05)", borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 18, width: 88, background: "rgba(255,255,255,0.04)", borderRadius: 4, marginLeft: "auto" }} />
                </>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 600,
                      color: "#f1f5f9",
                      lineHeight: 1,
                      marginBottom: 6,
                    }}
                  >
                    ${displayPrice.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: col }}>
                    {sign}{displayMove.toFixed(2)}%
                    <span
                      style={{ fontSize: 13, fontWeight: 400, marginLeft: 10, color: col + "aa" }}
                    >
                      {dolSign}${displayMoveDollar.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 16px",
                background: "rgba(59,130,246,0.07)",
                border: "1px solid rgba(59,130,246,0.22)",
                borderRadius: 8,
                color: "#3b82f6",
                fontSize: 13,
                fontWeight: 400,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
              Watchlist
            </button>

            {data.notifications.map((n, i) => (
              <Chip key={i} type={n.type} />
            ))}

            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#64748b",
                fontSize: 13,
                fontWeight: 400,
                cursor: "pointer",
                fontFamily: "inherit",
                marginLeft: "auto",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
              </svg>
              AI Summary
            </button>
          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: 16, fontSize: 11, color: "#1e293b", lineHeight: 1.6 }}>
            Market data is delayed. Nothing on this page constitutes financial advice.
          </div>
        </div>

        {/* ── Sections ────────────────────────────────────────────────────── */}

        <Section title="Company Overview">
          <p
            style={{
              fontSize: 14,
              color: "#94a3b8",
              lineHeight: 1.85,
              fontWeight: 300,
              margin: 0,
            }}
          >
            {data.description}
          </p>
        </Section>

        <Section title="Key Metrics">
          <div style={{ display: "flex", flexWrap: "wrap", rowGap: 22 }}>
            {data.metrics.map(({ label, value }) => (
              <div key={label} style={{ width: "33.333%", paddingRight: 24 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#334155",
                    fontWeight: 400,
                    marginBottom: 5,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 15, color: "#e2e8f0", fontWeight: 500 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Sentiment Tracker">
          <div style={{ maxWidth: 540, margin: "0 auto" }}>
            <div
              style={{
                position: "relative",
                height: 6,
                borderRadius: 3,
                background:
                  "linear-gradient(to right, rgba(239,68,68,0.4), rgba(100,116,139,0.15) 50%, rgba(34,197,94,0.4))",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${data.sentiment}%`,
                  transform: "translate(-50%, -50%)",
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: col,
                  boxShadow: `0 0 10px ${col}99`,
                  border: "2px solid #07090f",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 11, color: "#ef444488" }}>Bearish</span>
              <span style={{ fontSize: 11, color: "#22c55e88" }}>Bullish</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: col,
                  marginBottom: 6,
                }}
              >
                {data.sentiment}% Bullish
              </div>
              <div style={{ fontSize: 12, color: "#334155" }}>
                Based on recent news coverage
              </div>
            </div>
          </div>
        </Section>

        <Section title="News">
          {data.news.length === 0 ? (
            <div style={{ fontSize: 13, color: "#334155" }}>No recent news available.</div>
          ) : (
            <div>
              {data.news.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    paddingBottom: i < data.news.length - 1 ? 18 : 0,
                    marginBottom: i < data.news.length - 1 ? 18 : 0,
                    borderBottom:
                      i < data.news.length - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
                  }}
                >
                  <div style={{ flexShrink: 0, paddingTop: 1 }}>
                    <Chip type={item.type} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: "#cbd5e1",
                        lineHeight: 1.5,
                        marginBottom: 5,
                        fontWeight: 400,
                      }}
                    >
                      {item.headline}
                    </div>
                    <div style={{ fontSize: 12, color: "#334155" }}>
                      {item.source} · {item.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Earnings">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PlaceholderLink label="Most recent earnings report" />
            <PlaceholderLink label="Earnings call recording" />
          </div>
        </Section>

        <Section title="Company Links">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <PlaceholderLink label="Investor relations" />
            <PlaceholderLink label="SEC EDGAR filings" />
          </div>
        </Section>
      </div>
    </div>
  );
}
