import type { NotifType } from "@/lib/graphTypes";

export interface GraphSettings {
  hiddenNotifTypes: NotifType[];
  accessibilityMode: boolean;
  nodeSize: "connections" | "marketcap";
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  hiddenNotifTypes: [],
  accessibilityMode: false,
  nodeSize: "marketcap",
};

const STORAGE_KEY = "vauric_graph_settings";

export function loadGraphSettings(): GraphSettings {
  if (typeof window === "undefined") return DEFAULT_GRAPH_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GRAPH_SETTINGS;
    return { ...DEFAULT_GRAPH_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GRAPH_SETTINGS;
  }
}

export function saveGraphSettings(s: GraphSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
