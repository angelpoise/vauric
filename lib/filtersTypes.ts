import type { NotifType } from "./graphTypes";

export interface FilterRange { min: number | null; max: number | null; }

export interface ActiveFilters {
  dailyMove:       FilterRange;
  sectors:         string[];       // subset of ALL_SECTORS
  notifTypes:      NotifType[];    // subset of ALL_NOTIF_TYPES
  onlyWithNotifs:  boolean;
  marketCapTiers:  string[];       // subset of ALL_CAP_TIERS
  price:           FilterRange;
  trailingPE:      FilterRange;
  beta:            FilterRange;
  avgVolumeMin:    number | null;
  fiftyTwoWeekPos: string[];       // subset of ALL_52W_POS
  relVolumeMin:    number | null;
  streak:          "any" | "up" | "down";
  nodeSize:        "connections" | "marketcap";
  sentimentMin:    number | null;
}

export const ALL_SECTORS     = ["tech", "energy", "health", "finance", "consumer"] as const;
export const ALL_NOTIF_TYPES: NotifType[] = ["news", "analyst", "squeeze", "delisting", "split", "earnings", "ipo"];
export const ALL_CAP_TIERS   = ["mega", "large", "mid", "small"] as const;
export const ALL_52W_POS     = ["low", "mid", "high"] as const;

export const DEFAULT_FILTERS: ActiveFilters = {
  dailyMove:       { min: null, max: null },
  sectors:         [...ALL_SECTORS],
  notifTypes:      [...ALL_NOTIF_TYPES],
  onlyWithNotifs:  false,
  marketCapTiers:  [...ALL_CAP_TIERS],
  price:           { min: null, max: null },
  trailingPE:      { min: null, max: null },
  beta:            { min: null, max: null },
  avgVolumeMin:    null,
  fiftyTwoWeekPos: [...ALL_52W_POS],
  relVolumeMin:    null,
  streak:          "any",
  nodeSize:        "connections",
  sentimentMin:    null,
};

export function countActiveFilters(f: ActiveFilters): number {
  let n = 0;
  if (f.dailyMove.min !== null || f.dailyMove.max !== null)             n++;
  if (f.sectors.length < ALL_SECTORS.length)                            n++;
  if (f.notifTypes.length < ALL_NOTIF_TYPES.length || f.onlyWithNotifs) n++;
  if (f.marketCapTiers.length < ALL_CAP_TIERS.length)                   n++;
  if (f.price.min !== null || f.price.max !== null)                     n++;
  if (f.trailingPE.min !== null || f.trailingPE.max !== null)           n++;
  if (f.beta.min !== null || f.beta.max !== null)                       n++;
  if (f.avgVolumeMin !== null)                                          n++;
  if (f.fiftyTwoWeekPos.length < ALL_52W_POS.length)                   n++;
  if (f.relVolumeMin !== null)                                          n++;
  if (f.streak !== "any")                                               n++;
  if (f.nodeSize !== "connections")                                     n++;
  if (f.sentimentMin !== null)                                          n++;
  return n;
}
