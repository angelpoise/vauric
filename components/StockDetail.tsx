"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { type NotifType, NOTIF, moveColor } from "@/lib/graphTypes";
import UpgradeButton from "@/components/UpgradeButton";
import PriceAlertModal from "@/components/PriceAlertModal";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";
import {
  FREE_TIER_CAP,
  WATCHLIST_EVENT,
  getWatchlist,
  addToWatchlist,
} from "@/lib/watchlist";

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

const STOCK_SECTOR: Record<string, string> = {
  NVDA: "tech", MSFT: "tech", PLTR: "tech", AMD: "tech", ARM: "tech", SMCI: "tech",
  XOM: "energy", CVX: "energy", FANG: "energy", SLB: "energy",
  HIMS: "health", RXRX: "health", LLY: "health", MRNA: "health",
  SOFI: "finance", AFRM: "finance", PYPL: "finance", COIN: "finance", HOOD: "finance",
};

const SECTOR_META: Record<string, { name: string; color: string }> = {
  tech:     { name: "Technology",             color: "#3b82f6" },
  energy:   { name: "Energy",                 color: "#f59e0b" },
  health:   { name: "Healthcare",             color: "#22c55e" },
  finance:  { name: "Finance",                color: "#a855f7" },
  consumer: { name: "Consumer Discretionary", color: "#14b8a6" },
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

const ANALYSIS_MSGS = [
  "Analysing business segments…",
  "Reviewing recent performance…",
  "Processing market data…",
  "Compiling insights…",
];

const SCENARIO_MSGS = [
  "Modelling bull case…",
  "Assessing base case…",
  "Stress-testing bear case…",
  "Calculating price targets…",
];

function daysAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "unknown";
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

const SECTOR_ETF: Record<string, string> = {
  tech: "XLK", energy: "XLE", health: "XLV", finance: "XLF", consumer: "XLY",
};

const RS_TREND_COLOR = { outperforming: "#22c55e", inline: "#64748b", underperforming: "#ef4444" };

function RSBarRow({ label, value, etf }: { label: string; value: number | null; etf: string }) {
  const MAX_PCT = 15;
  const isPos   = (value ?? 0) >= 0;
  const color   = value != null ? (isPos ? "#22c55e" : "#ef4444") : "#334155";
  const fillPct = value != null ? (Math.min(Math.abs(value), MAX_PCT) / MAX_PCT) * 50 : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ width: 24, fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, position: "relative", height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.15)", transform: "translateX(-50%)" }} />
        {value != null && (
          isPos
            ? <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: `${fillPct}%`, background: `${color}88`, borderRadius: "0 3px 3px 0" }} />
            : <div style={{ position: "absolute", right: "50%", top: 0, bottom: 0, width: `${fillPct}%`, background: `${color}88`, borderRadius: "3px 0 0 3px" }} />
        )}
      </div>
      <span style={{ width: 106, fontSize: 12, color, fontWeight: 500, textAlign: "right", flexShrink: 0, fontFamily: "inherit" }}>
        {value != null ? `${isPos ? "+" : ""}${value.toFixed(1)}% vs ${etf}` : `— vs ${etf}`}
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

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
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
        <path d="M3 7H11M8 4L11 7L8 10" stroke="#3b82f6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LiveEntry {
  price: number;
  dailyMove: number;
  dailyMoveDollar: number;
  streak?: number;
  streakDirection?: "up" | "down" | "flat";
}

interface FundamentalsEntry {
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
  fullTimeEmployees:            number | null;
}

function formatMarketCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(1)}M`;
  return `$${(v / 1e3).toFixed(1)}K`;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  return v.toLocaleString("en-US");
}

interface MetricRow { label: string; value: string; color?: string; }

function buildMetrics(f: FundamentalsEntry | null, live: LiveEntry | null): MetricRow[] {
  const p = (v: number | null | undefined, fn: (n: number) => string): string =>
    v != null ? fn(v) : "—";
  const px = (v: number | null | undefined): string => p(v, (n) => `$${n.toFixed(2)}`);
  const pe = (v: number | null | undefined): string => p(v, (n) => `${n.toFixed(2)}×`);

  let streakValue = "—";
  let streakColor: string | undefined;
  if (live != null) {
    const n = live.streak ?? 0;
    const dir = live.streakDirection ?? "flat";
    if (dir === "up") {
      streakValue = `${n} up day${n !== 1 ? "s" : ""}`;
      streakColor = "#22c55e";
    } else if (dir === "down") {
      streakValue = `${n} down day${n !== 1 ? "s" : ""}`;
      streakColor = "#ef4444";
    } else {
      streakValue = n > 0 ? "Flat" : "—";
    }
  }

  return [
    { label: "Market Cap",    value: p(f?.marketCap, formatMarketCap) },
    { label: "Trailing P/E",  value: pe(f?.trailingPE) },
    { label: "Forward P/E",   value: pe(f?.forwardPE) },
    { label: "Price / Sales", value: pe(f?.priceToSalesTrailing12Months) },
    { label: "Beta",          value: p(f?.beta, (n) => n.toFixed(2)) },
    { label: "Avg Volume",    value: p(f?.averageVolume, formatVolume) },
    { label: "52W High",      value: px(f?.fiftyTwoWeekHigh) },
    { label: "52W Low",       value: px(f?.fiftyTwoWeekLow) },
    { label: "50D Average",   value: px(f?.fiftyDayAverage) },
    { label: "200D Average",  value: px(f?.twoHundredDayAverage) },
    { label: "Streak",        value: streakValue, color: streakColor },
  ];
}

function firstThreeSentences(text: string): string {
  let count = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (/[.!?]/.test(text[i]) && (text[i + 1] === " " || text[i + 1] === "\n")) {
      count++;
      if (count === 3) return text.slice(0, i + 1).trim();
    }
  }
  return text.trim();
}

export default function StockDetail({ ticker }: { ticker: string }) {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const isPro = user?.publicMetadata?.isPro === true;

  async function authFetch(url: string, init?: RequestInit): Promise<Response> {
    const token = await getToken();
    return fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }
  const data = getStockData(ticker);

  const [live, setLive] = useState<LiveEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [fundamentals, setFundamentals] = useState<FundamentalsEntry | null>(null);

  interface ApiNewsItem { id: number; headline: string; source: string | null; published_at: string; notification_type: string; url: string | null; }
  const [stockNews, setStockNews]               = useState<ApiNewsItem[]>([]);
  const [stockNewsLoading, setStockNewsLoading] = useState(true);

  interface GraphStock { ticker: string; investor_relations_url: string | null; company_name: string; }
  const [graphStock, setGraphStock] = useState<GraphStock | null>(null);

  interface EarningsItem { filing_type: string; period: string | null; filing_date: string; filing_url: string; }
  const [earnings, setEarnings]               = useState<EarningsItem[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(true);

  interface NextEarningsData { report_date: string; report_time: string | null; }
  const [nextEarnings, setNextEarnings]     = useState<NextEarningsData | null>(null);
  const [earningsFetched, setEarningsFetched] = useState(false);
  const [lastEarnings, setLastEarnings]     = useState<NextEarningsData | null>(null);
  const [lastEarningsFetched, setLastEarningsFetched] = useState(false);

  interface RSData { etf: string; vs1w: number | null; vs1m: number | null; vs3m: number | null; score: number; trend: "outperforming" | "inline" | "underperforming"; }
  const [rsData, setRsData]     = useState<RSData | null>(null);
  const [rsLoading, setRsLoading] = useState(true);

  interface ScenarioCase { "6m": string; "1y": string; "2y": string; priceTarget: number; }
  interface ScenarioData { bull: ScenarioCase; base: ScenarioCase; bear: ScenarioCase; generated_at: string; }
  const [scenarioData, setScenarioData]       = useState<ScenarioData | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioTab, setScenarioTab]   = useState<"bull" | "base" | "bear">("base");
  const [analysisMsgIdx, setAnalysisMsgIdx] = useState(0);
  const [scenarioMsgIdx, setScenarioMsgIdx] = useState(0);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [scenarioVisible, setScenarioVisible] = useState(false);
  const [trackedTheses, setTrackedTheses]     = useState<Record<string, string>>({}); // scenario → id
  const [trackingInFlight, setTrackingInFlight] = useState<Set<string>>(new Set());

  interface AnalysisData { segments: string; margins: string; guidance: string; relationships: string; last_generated_at?: string; }
  const [analysis, setAnalysis]               = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError]     = useState(false);

  const [inWatchlist, setInWatchlist] = useState(false);
  const [wlFlash, setWlFlash] = useState<"added" | "duplicate" | "limit" | null>(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fire-and-forget visit tracking — completely invisible to the user
  useEffect(() => {
    fetch("/api/stock/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    }).catch(() => {});
  }, [ticker]);

  useEffect(() => {
    setInWatchlist(getWatchlist().includes(ticker));
    const onUpdate = () => setInWatchlist(getWatchlist().includes(ticker));
    window.addEventListener(WATCHLIST_EVENT, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, [ticker]);

  function handleAddToWatchlist() {
    const result = addToWatchlist(ticker);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setWlFlash(result);
    flashTimer.current = setTimeout(() => setWlFlash(null), result === "limit" ? 3000 : 1800);
  }

  useEffect(() => {
    // Show cached price/move immediately so the header doesn't flash
    const cached = getCachedMarketData();
    if (cached?.[ticker]) {
      setLive(cached[ticker]);
      setLoaded(true);
    }
    // Always fetch with streak so the streak metric populates correctly;
    // serverCacheStreak keeps this response fast after the first request.
    fetch("/api/market-data?includeStreak=true")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (json) setCachedMarketData(json);
        if (json?.[ticker]) setLive(json[ticker]);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); });
  }, [ticker]);

  useEffect(() => {
    fetch("/api/fundamentals")
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.[ticker]) setFundamentals(json[ticker]); })
      .catch(() => {});
  }, [ticker]);

  useEffect(() => {
    setStockNews([]);
    setStockNewsLoading(true);
    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.ok ? r.json() : [])
      .then((json) => { setStockNews(Array.isArray(json) ? json : []); })
      .catch(() => { setStockNews([]); })
      .finally(() => { setStockNewsLoading(false); });
  }, [ticker]);

  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.stocks) {
          const s = data.stocks.find((s: GraphStock) => s.ticker === ticker);
          setGraphStock(s ?? null);
        }
      })
      .catch(() => {});
  }, [ticker]);

  useEffect(() => {
    setEarningsFetched(false);
    setNextEarnings(null);
    setLastEarningsFetched(false);
    setLastEarnings(null);

    fetch(`/api/earnings-calendar?ticker=${ticker}&days=90`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: NextEarningsData[]) => {
        console.log(`[earnings-calendar] ${ticker}:`, data);
        if (Array.isArray(data) && data.length > 0) setNextEarnings(data[0]);
      })
      .catch(() => {})
      .finally(() => setEarningsFetched(true));

    fetch(`/api/earnings-calendar?ticker=${ticker}&past=true`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: NextEarningsData[]) => {
        if (Array.isArray(data) && data.length > 0) setLastEarnings(data[0]);
      })
      .catch(() => {})
      .finally(() => setLastEarningsFetched(true));
  }, [ticker]);

  useEffect(() => {
    setRsData(null);
    setRsLoading(true);
    fetch(`/api/relative-strength?ticker=${ticker}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d: RSData | null) => { if (d) setRsData(d); })
      .catch(() => {})
      .finally(() => setRsLoading(false));
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load thesis tracking state for this user
  useEffect(() => {
    if (!user) return;
    authFetch(`/api/thesis-tracking?userId=${encodeURIComponent(user.id)}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: Array<{ id: string; ticker: string; scenario: string }>) => {
        const map: Record<string, string> = {};
        for (const row of rows) {
          if (row.ticker === ticker) map[row.scenario] = row.id;
        }
        setTrackedTheses(map);
      })
      .catch(() => {});
  }, [user, ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cycle analysis status messages while loading
  useEffect(() => {
    if (!analysisLoading) { setAnalysisMsgIdx(0); return; }
    const id = setInterval(() => setAnalysisMsgIdx(i => (i + 1) % ANALYSIS_MSGS.length), 700);
    return () => clearInterval(id);
  }, [analysisLoading]);

  // Cycle scenario status messages while loading
  useEffect(() => {
    if (!scenarioLoading) { setScenarioMsgIdx(0); return; }
    const id = setInterval(() => setScenarioMsgIdx(i => (i + 1) % SCENARIO_MSGS.length), 700);
    return () => clearInterval(id);
  }, [scenarioLoading]);

  useEffect(() => {
    setEarningsLoading(true);
    fetch(`/api/earnings?ticker=${ticker}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setEarnings(Array.isArray(d) ? d : []))
      .catch(() => setEarnings([]))
      .finally(() => setEarningsLoading(false));
  }, [ticker]);

  async function handleGenerateAnalysis() {
    if (analysisLoading) return;
    setAnalysisLoading(true);
    setAnalysisError(false);
    setAnalysisVisible(false);
    try {
      const [data] = await Promise.all([
        fetch(`/api/analysis?ticker=${ticker}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null) as Promise<(AnalysisData & { error?: string }) | null>,
        new Promise<void>(res => setTimeout(res, 2500)),
      ]);
      if (data && !data.error) {
        setAnalysis(data);
        requestAnimationFrame(() => requestAnimationFrame(() => setAnalysisVisible(true)));
      } else {
        setAnalysisError(true);
      }
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleGenerateScenarios() {
    if (scenarioLoading) return;
    setScenarioLoading(true);
    setScenarioVisible(false);
    try {
      const [data] = await Promise.all([
        fetch(`/api/scenarios?ticker=${ticker}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null) as Promise<ScenarioData | null>,
        new Promise<void>(res => setTimeout(res, 2500)),
      ]);
      if (data?.bull) {
        setScenarioData(data);
        requestAnimationFrame(() => requestAnimationFrame(() => setScenarioVisible(true)));
      }
    } finally {
      setScenarioLoading(false);
    }
  }

  // Returns true if the content is stale: > 7 days old OR newer significant news exists
  function isContentStale(lastGeneratedAt: string | null | undefined): boolean {
    if (!lastGeneratedAt) return true;
    const age = Date.now() - new Date(lastGeneratedAt).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) return true;
    const genMs = new Date(lastGeneratedAt).getTime();
    return stockNews.some(a => new Date(a.published_at).getTime() > genMs);
  }

  const displayPrice     = live?.price     ?? data.price;
  const displayMove      = live?.dailyMove ?? data.dailyMove;
  const displayMoveDollar = live != null
    ? Math.abs(live.dailyMoveDollar)
    : Math.abs((data.price * data.dailyMove) / 100);

  const col     = moveColor(displayMove);
  const sign    = displayMove >= 0 ? "+" : "";
  const dolSign = displayMove >= 0 ? "+" : "−";
  const sentimentCol = data.sentiment > 50 ? "#22c55e" : data.sentiment < 50 ? "#ef4444" : "#64748b";

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
              {(() => {
                function earningsLabel(data: NextEarningsData | null): string | null {
                  if (!data) return null;
                  const d = new Date(data.report_date + "T12:00:00");
                  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                  const timeStr =
                    data.report_time === "pre-market"    ? "Pre-market"
                    : data.report_time === "after-hours"   ? "After hours"
                    : data.report_time === "during-market" ? "During market"
                    : null;
                  return timeStr ? `${dateStr} · ${timeStr}` : dateStr;
                }
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                    {earningsFetched && (
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        Next earnings:{" "}
                        {nextEarnings
                          ? <span style={{ color: "#64748b", fontWeight: 500 }}>{earningsLabel(nextEarnings)}</span>
                          : <span style={{ color: "#334155" }}>TBC</span>
                        }
                      </div>
                    )}
                    {lastEarningsFetched && (
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        Last earnings:{" "}
                        {lastEarnings
                          ? <span style={{ color: "#64748b", fontWeight: 500 }}>{earningsLabel(lastEarnings)}</span>
                          : <span style={{ color: "#334155" }}>TBC</span>
                        }
                      </div>
                    )}
                  </div>
                );
              })()}
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
            {wlFlash === "limit" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#64748b", fontFamily: "inherit" }}>
                  Watchlist full ({FREE_TIER_CAP}/{FREE_TIER_CAP})
                </span>
                <UpgradeButton label="Upgrade to Pro" />
              </div>
            ) : (
              <button
                onClick={handleAddToWatchlist}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  background: inWatchlist ? "rgba(34,197,94,0.07)" : "rgba(59,130,246,0.07)",
                  border: inWatchlist ? "1px solid rgba(34,197,94,0.28)" : "1px solid rgba(59,130,246,0.22)",
                  borderRadius: 8,
                  color: inWatchlist ? "#22c55e" : "#3b82f6",
                  fontSize: 13,
                  fontWeight: 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s",
                }}
              >
                {wlFlash === "added" ? (
                  "✓ Added"
                ) : wlFlash === "duplicate" ? (
                  "Already in watchlist"
                ) : inWatchlist ? (
                  <>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>✓</span>
                    Watchlist
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                    Watchlist
                  </>
                )}
              </button>
            )}

            {(() => {
              const sectorId = STOCK_SECTOR[ticker];
              const meta = sectorId ? SECTOR_META[sectorId] : null;
              if (!meta) return null;
              return (
                <button
                  onClick={() => router.push(`/sector/${sectorId}`)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 14px 7px 12px",
                    background: `${meta.color}0a`,
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderLeft: `2px solid ${meta.color}`,
                    borderRadius: 8,
                    color: "#94a3b8",
                    fontSize: 13,
                    fontWeight: 400,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {meta.name}
                </button>
              );
            })()}

            {/* RS header pill — shows 1M figure when |vs1m| >= 1% */}
            {rsData && rsData.vs1m != null && Math.abs(rsData.vs1m) >= 1 && (
              <span style={{
                fontSize: 11, fontWeight: 500,
                padding: "4px 9px", borderRadius: 6, flexShrink: 0,
                color:       RS_TREND_COLOR[rsData.trend],
                background:  RS_TREND_COLOR[rsData.trend] + "15",
                border:      `1px solid ${RS_TREND_COLOR[rsData.trend]}30`,
              }}>
                {`${rsData.vs1m >= 0 ? "↑ +" : "↓ "}${rsData.vs1m.toFixed(1)}% vs ${rsData.etf} (1M)`}
              </span>
            )}

            {(() => {
              const seen = new Set<string>();
              return stockNews
                .filter(a => { if (seen.has(a.notification_type)) return false; seen.add(a.notification_type); return true; })
                .map((a, i) => <Chip key={i} type={(a.notification_type as NotifType) || "news"} />);
            })()}

            {/* Bell — set price alert */}
            <button
              onClick={() => setShowAlertModal(true)}
              title="Set price alert"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8, cursor: "pointer", color: "#64748b",
                fontSize: 13, fontWeight: 400, fontFamily: "inherit",
                marginLeft: "auto",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              Alert
            </button>

          </div>

          {/* Disclaimer */}
          <div style={{ marginTop: 16, fontSize: 11, color: "#1e293b", lineHeight: 1.6 }}>
            Market data is delayed. Nothing on this page constitutes financial advice.
          </div>
        </div>

        {/* ── Sections ────────────────────────────────────────────────────── */}

        <Section title="Company Overview">
          {fundamentals === null && !loaded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[100, 85, 65].map((w) => (
                <div key={w} style={{ height: 14, width: `${w}%`, background: "rgba(255,255,255,0.05)", borderRadius: 4 }} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.85, fontWeight: 300, margin: 0 }}>
              {fundamentals?.longBusinessSummary
                ? firstThreeSentences(fundamentals.longBusinessSummary)
                : data.description}
            </p>
          )}
        </Section>

        <Section title="Deeper dive">
          <style>{`@keyframes vauric-spin{to{transform:rotate(360deg)}}`}</style>

          {/* Initial button — shown to all users when no content loaded */}
          {!analysis && !analysisLoading && !analysisError && (
            <button
              onClick={handleGenerateAnalysis}
              style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, color: "#3b82f6", fontSize: 13, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Generate deeper dive
            </button>
          )}

          {/* Loading animation */}
          {analysisLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "vauric-spin 1s linear infinite", flexShrink: 0 }}>
                <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="2" />
                <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 13, color: "#475569" }}>{ANALYSIS_MSGS[analysisMsgIdx]}</span>
            </div>
          )}

          {/* Error state */}
          {analysisError && !analysisLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Analysis temporarily unavailable — please try again.</p>
              <button
                onClick={handleGenerateAnalysis}
                style={{ alignSelf: "flex-start", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#475569", fontSize: 12, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Content — fades in after load */}
          {analysis && !analysisLoading && (
            <div style={{ opacity: analysisVisible ? 1 : 0, transition: "opacity 0.5s ease" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 14 }}>
                {([
                  ["Business segments",       analysis.segments],
                  ["Margins & profitability", analysis.margins],
                  ["Recent guidance",         analysis.guidance],
                  ["Key relationships",       analysis.relationships],
                ] as [string, string][]).map(([label, text]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.75, fontWeight: 300, margin: 0 }}>{text}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "#334155", margin: 0 }}>
                Last updated: {daysAgo(analysis.last_generated_at)}
              </p>
            </div>
          )}
        </Section>

        <Section title="Scenarios">
          {!isPro ? (
            <div style={{ padding: "12px 0 4px" }}>
              <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>Bull/base/bear scenario analysis is a Pro feature.</p>
              <UpgradeButton label="Upgrade to Pro" />
            </div>
          ) : (
            <div>
              {/* Initial generate button */}
              {!scenarioData && !scenarioLoading && (
                <div style={{ padding: "8px 0 4px" }}>
                  <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px" }}>
                    Generate AI-powered bull, base, and bear case scenarios for {ticker}.
                  </p>
                  <button
                    onClick={handleGenerateScenarios}
                    style={{ background: "#3b82f6", border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 500, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Generate scenarios
                  </button>
                </div>
              )}

              {/* Loading animation */}
              {scenarioLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: "vauric-spin 1s linear infinite", flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(59,130,246,0.2)" strokeWidth="2" />
                    <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 13, color: "#475569" }}>{SCENARIO_MSGS[scenarioMsgIdx]}</span>
                </div>
              )}

              {scenarioData && !scenarioLoading && (() => {
                const TABS: Array<{ key: "bull" | "base" | "bear"; label: string; color: string }> = [
                  { key: "bull", label: "Bull", color: "#22c55e" },
                  { key: "base", label: "Base", color: "#64748b" },
                  { key: "bear", label: "Bear", color: "#ef4444" },
                ];
                const active = scenarioData[scenarioTab];
                const activeColor = TABS.find(t => t.key === scenarioTab)!.color;
                const timeframes: Array<{ key: "6m" | "1y" | "2y"; label: string }> = [
                  { key: "6m", label: "6 months" },
                  { key: "1y", label: "1 year" },
                  { key: "2y", label: "2+ years" },
                ];
                const isTracked = !!trackedTheses[scenarioTab];
                const inFlight  = trackingInFlight.has(scenarioTab);

                async function toggleTrack() {
                  if (!user || inFlight) return;
                  setTrackingInFlight(s => new Set(s).add(scenarioTab));
                  try {
                    if (isTracked) {
                      await authFetch(`/api/thesis-tracking?id=${trackedTheses[scenarioTab]}`, { method: "DELETE" });
                      setTrackedTheses(m => { const n = { ...m }; delete n[scenarioTab]; return n; });
                    } else {
                      const r = await authFetch("/api/thesis-tracking", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId: user.id, ticker, scenario: scenarioTab }),
                      });
                      if (r.ok) {
                        const d = await r.json() as { id?: string };
                        if (d?.id) setTrackedTheses(m => ({ ...m, [scenarioTab]: d.id! }));
                      }
                    }
                  } catch { /* ignore */ }
                  finally { setTrackingInFlight(s => { const n = new Set(s); n.delete(scenarioTab); return n; }); }
                }

                return (
                  <div style={{ opacity: scenarioVisible ? 1 : 0, transition: "opacity 0.5s ease" }}>
                    {/* Tab bar */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}>
                      {TABS.map(t => {
                        const a = scenarioTab === t.key;
                        return (
                          <button key={t.key} onClick={() => setScenarioTab(t.key)} style={{
                            padding: "6px 16px", borderRadius: 7, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                            fontWeight: a ? 600 : 400,
                            background: a ? `${t.color}18` : "rgba(255,255,255,0.04)",
                            border: `1px solid ${a ? t.color + "50" : "rgba(255,255,255,0.08)"}`,
                            color: a ? t.color : "#64748b",
                          }}>{t.label}</button>
                        );
                      })}
                      {/* Track this thesis bell */}
                      <button
                        onClick={toggleTrack}
                        disabled={inFlight}
                        title={isTracked ? "Stop tracking this thesis" : "Track this thesis"}
                        style={{
                          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontFamily: "inherit", cursor: inFlight ? "default" : "pointer",
                          background: isTracked ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isTracked ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                          color: isTracked ? "#3b82f6" : "#475569", opacity: inFlight ? 0.5 : 1,
                        }}
                      >
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M8 2a4.5 4.5 0 00-4.5 4.5V10L2 12h12l-1.5-2V6.5A4.5 4.5 0 008 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                          <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {inFlight ? "…" : isTracked ? "Tracking" : "Track thesis"}
                      </button>
                    </div>

                    {/* Price target pill */}
                    <div style={{ marginBottom: 16 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 20,
                        background: `${activeColor}18`, border: `1px solid ${activeColor}40`, color: activeColor,
                      }}>
                        Target: ${active.priceTarget.toLocaleString()}
                      </span>
                    </div>

                    {/* Timeframe cards */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                      {timeframes.map(tf => (
                        <div key={tf.key} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: activeColor, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 }}>{tf.label}</div>
                          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{active[tf.key]}</div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                      <p style={{ fontSize: 11, color: "#334155", margin: 0, lineHeight: 1.5 }}>
                        AI-generated · {daysAgo(scenarioData.generated_at)} · Not financial advice.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </Section>

        <Section title="Key Metrics">
          <div style={{ display: "flex", flexWrap: "wrap", rowGap: 22 }}>
            {buildMetrics(fundamentals, live).map(({ label, value, color }) => (
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
                <div style={{ fontSize: 15, color: color ?? "#e2e8f0", fontWeight: 500 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Relative Strength">
          {rsLoading ? (
            <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Loading…</p>
          ) : !rsData ? (
            <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>No relative strength data available.</p>
          ) : (
            <>
              {/* Per-timeframe bars */}
              {([
                { label: "1W", value: rsData.vs1w },
                { label: "1M", value: rsData.vs1m },
                { label: "3M", value: rsData.vs3m },
              ] as Array<{ label: string; value: number | null }>).map(({ label, value }) => (
                <RSBarRow key={label} label={label} value={value} etf={rsData.etf} />
              ))}

              <p style={{ fontSize: 11, color: "#334155", margin: "4px 0 0" }}>
                Performance relative to {rsData.etf} (sector ETF). Positive = outperforming.
              </p>
            </>
          )}
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
                  background: "#3b82f6",
                  boxShadow: "0 0 10px #3b82f699",
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
                  color: sentimentCol,
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
          {stockNewsLoading ? (
            <div style={{ fontSize: 13, color: "#334155" }}>Loading…</div>
          ) : stockNews.length === 0 ? (
            <div style={{ fontSize: 13, color: "#334155" }}>No recent news available.</div>
          ) : (
            <div>
              {stockNews.map((item, i) => (
                <div
                  key={item.id}
                  onClick={() => item.url && window.open(item.url, "_blank", "noopener,noreferrer")}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    paddingBottom: i < stockNews.length - 1 ? 18 : 0,
                    marginBottom: i < stockNews.length - 1 ? 18 : 0,
                    borderBottom: i < stockNews.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    cursor: item.url ? "pointer" : "default",
                  }}
                >
                  <div style={{ flexShrink: 0, paddingTop: 1 }}>
                    <Chip type={(item.notification_type as NotifType) || "news"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.5, marginBottom: 5, fontWeight: 400 }}>
                      {item.headline}
                    </div>
                    <div style={{ fontSize: 12, color: "#334155" }}>
                      {item.source ?? ""} · {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {!earningsLoading && earnings.length > 0 && (
          <Section title="Earnings">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {earnings.map((e, i) => (
                <ExternalLink
                  key={i}
                  href={e.filing_url}
                  label={`${e.filing_type}${e.period ? ` — ${e.period}` : ""} · ${new Date(e.filing_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                />
              ))}
              <ExternalLink
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent((graphStock?.company_name ?? data.name).replace(/\s+/g, "+"))}+earnings+call`}
                label="Search earnings calls on YouTube"
              />
            </div>
          </Section>
        )}

        <Section title="Company Links">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {graphStock?.investor_relations_url && (
              <ExternalLink href={graphStock.investor_relations_url} label="Investor relations" />
            )}
            <ExternalLink
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker}&type=10-K&dateb=&owner=include&count=10`}
              label="SEC EDGAR — Earnings & Filings"
            />
          </div>
        </Section>
      </div>

      {showAlertModal && (
        <PriceAlertModal
          ticker={ticker}
          currentPrice={live?.price ?? null}
          onClose={() => setShowAlertModal(false)}
        />
      )}
    </div>
  );
}
