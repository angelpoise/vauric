"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  type GNode,
  type StockNode,
  type SectorNode,
  type SubSectorNode,
  type SubSubSectorNode,
  type NotifType,
  NOTIF,
  moveColor,
  moveFill,
} from "@/lib/graphTypes";
import {
  getCachedMarketData, setCachedMarketData,
  getCachedNodePositions, setCachedNodePositions,
} from "@/lib/marketDataCache";
import {
  type ActiveFilters,
  DEFAULT_FILTERS,
  ALL_CAP_TIERS,
  ALL_52W_POS,
} from "@/lib/filtersTypes";
import {
  type GraphSettings,
  DEFAULT_GRAPH_SETTINGS,
} from "@/lib/graphSettingsTypes";

// Muted amber rendered for hierarchy nodes that have no ETF ticker assigned.
// Visually distinct from both the green/red performance colours and neutral grey.
const NO_ETF_COLOR = "rgb(168, 130, 52)";

// ─── LOD (Level of Detail) zoom thresholds ───────────────────────────────────
// cam.scale at which each tier fades in. Below = hidden, above+LOD_FADE = fully shown.
const LOD_SUBSECTOR    = 0.28; // subsectors fade in around this scale
const LOD_SUBSUBSECTOR = 0.48; // subsubsectors + stock nodes fade in at this scale
const LOD_FADE         = 0.07; // width of the crossfade band

// ─── Module-level position seed ──────────────────────────────────────────────
// Read sessionStorage synchronously at module evaluation time so positions are
// available before React mounts the component, eliminating the one-frame flash.
const sessionPositions: Record<string, { x: number; y: number }> | null = (() => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("vauric_node_positions");
    return raw ? (JSON.parse(raw) as Record<string, { x: number; y: number }>) : null;
  } catch { return null; }
})();

// ─── Module-level market data prefetch ───────────────────────────────────────
// Start the fetch the instant this module is imported (before React mounts the
// component), so data is in flight during canvas setup rather than after it.
let _marketDataPromise: Promise<void> | null = null;
if (typeof window !== "undefined") {
  _marketDataPromise = (async () => {
    if (getCachedMarketData()) return;
    try {
      const r    = await fetch("/api/market-data");
      const data = r.ok ? (await r.json() as Record<string, unknown>) : null;
      if (data) setCachedMarketData(data as Parameters<typeof setCachedMarketData>[0]);
    } catch { /* useEffect will surface any error state */ }
  })();
}

// ─── Props ────────────────────────────────────────────────────────────────────

const DOT_LETTERS: Record<string, string> = {
  news: "N", analyst: "A", delisting: "D",
  acquisition: "M", split: "B", earnings: "E", ipo: "I",
};

interface ContextMenuInfo { type: "node" | "edge" | "sector"; id: string; clientX: number; clientY: number; }

interface Props {
  onHover?: (node: GNode | null) => void;
  activeFilters?: ActiveFilters;
  graphSettings?: GraphSettings;
  editMode?: boolean;
  adminView?: boolean;
  connectionView?: ConnectionView;
  sectorNodes?: SectorNode[];
  onNodeDragEnd?: (nodeId: string, worldX: number, worldY: number) => void;
  onContextMenu?: (info: ContextMenuInfo) => void;
  onShiftEmptyClick?: () => void;
  onGraphLoaded?: (tickers: string[]) => void;
}

export interface GraphCanvasHandle {
  snapshotPositions: () => void;
  restorePositions: () => void;
  zoomToNode: (nodeId: string) => void;
}

// ─── Static sector node defaults (ids = ETF tickers) ────────────────────────

const DEFAULT_SECTOR_NODES: SectorNode[] = [
  { id: "XLK",  kind: "sector", name: "Information Technology", etf: "XLK",  price: 224.18, dailyMove:  1.2, x:  500, y: 420, notifications: [] },
  { id: "XLE",  kind: "sector", name: "Energy",             etf: "XLE",  price:  93.42, dailyMove: -0.8, x: 1100, y: 360, notifications: [] },
  { id: "XLV",  kind: "sector", name: "Healthcare",         etf: "XLV",  price: 143.76, dailyMove:  0.3, x:  440, y: 750, notifications: [] },
  { id: "XLF",  kind: "sector", name: "Financials",          etf: "XLF",  price:  45.21, dailyMove:  0.7, x: 1155, y: 710, notifications: [] },
  { id: "XLI",  kind: "sector", name: "Industrials",        etf: "XLI",  price:  62.00, dailyMove:  0.0, x:  800, y: 165, notifications: [] },
  { id: "XLP",  kind: "sector", name: "Consumer Staples",   etf: "XLP",  price:   0.00, dailyMove:  0.0, x:  640, y: 935, notifications: [] },
  { id: "XLY",  kind: "sector", name: "Consumer Discr.",    etf: "XLY",  price:  72.00, dailyMove:  0.0, x:  960, y: 935, notifications: [] },
  { id: "XLC",  kind: "sector", name: "Communication",      etf: "XLC",  price:  80.00, dailyMove:  0.0, x: 1360, y: 550, notifications: [] },
  { id: "XLB",  kind: "sector", name: "Materials",          etf: "XLB",  price:  85.00, dailyMove:  0.0, x:  240, y: 550, notifications: [] },
  { id: "XLRE", kind: "sector", name: "Real Estate",        etf: "XLRE", price:  42.00, dailyMove:  0.0, x:  320, y: 935, notifications: [] },
  { id: "XLU",  kind: "sector", name: "Utilities",          etf: "XLU",  price:  68.00, dailyMove:  0.0, x: 1280, y: 165, notifications: [] },
];

// Maps sector text field on stock rows → sector node id (= ETF ticker)
const SECTOR_MAP: Record<string, string> = {
  "Information Technology": "XLK",
  Technology:              "XLK",
  Energy:                  "XLE",
  Healthcare:              "XLV",
  Financials:              "XLF",
  Finance:                 "XLF",
  "Financial Services":    "XLF",
  "Consumer Staples":      "XLP",
  "Consumer Discretionary":"XLY",
  Industrials:             "XLI",
  "Communication Services":"XLC",
  Materials:               "XLB",
  "Real Estate":           "XLRE",
  Utilities:               "XLU",
};

// Maps sector ETF ticker → filter ID (now identical — each sector is its own filter entry).
// Legacy "sec-*" IDs cover the hardcoded fallback stock nodes used before DB data loads.
const ETF_TO_FILTER_ID: Record<string, string> = {
  XLK: "XLK", XLE: "XLE", XLV: "XLV", XLF: "XLF", XLI: "XLI",
  XLP: "XLP", XLY: "XLY", XLC: "XLC", XLB: "XLB", XLRE: "XLRE", XLU: "XLU",
  "sec-tech": "XLK", "sec-energy": "XLE", "sec-health": "XLV",
  "sec-finance": "XLF", "sec-consumer": "XLY",
};


// ─── Fallback stock data (used if /api/graph fetch fails) ─────────────────────

const FALLBACK_STOCK_NODES: StockNode[] = [
  { id: "NVDA", kind: "stock", ticker: "NVDA", name: "NVIDIA",               price:  875.40, dailyMove:  5.2, sectorId: "sec-tech",    x:  305, y: 245, notifications: [] },
  { id: "MSFT", kind: "stock", ticker: "MSFT", name: "Microsoft",            price:  415.26, dailyMove:  0.9, sectorId: "sec-tech",    x:  475, y: 200, notifications: [] },
  { id: "PLTR", kind: "stock", ticker: "PLTR", name: "Palantir",             price:   24.38, dailyMove:  3.1, sectorId: "sec-tech",    x:  635, y: 260, notifications: [] },
  { id: "AMD",  kind: "stock", ticker: "AMD",  name: "AMD",                  price:  172.84, dailyMove:  2.4, sectorId: "sec-tech",    x:  360, y: 510, notifications: [] },
  { id: "ARM",  kind: "stock", ticker: "ARM",  name: "Arm Holdings",         price:  118.62, dailyMove:  4.8, sectorId: "sec-tech",    x:  645, y: 495, notifications: [] },
  { id: "SMCI", kind: "stock", ticker: "SMCI", name: "Super Micro Computer", price:   38.42, dailyMove:  2.8, sectorId: "sec-tech",    x:  175, y: 165, notifications: [] },
  { id: "XOM",  kind: "stock", ticker: "XOM",  name: "ExxonMobil",           price:  118.24, dailyMove: -1.2, sectorId: "sec-energy",  x:  920, y: 258, notifications: [] },
  { id: "CVX",  kind: "stock", ticker: "CVX",  name: "Chevron",              price:  158.90, dailyMove: -0.9, sectorId: "sec-energy",  x: 1082, y: 200, notifications: [] },
  { id: "FANG", kind: "stock", ticker: "FANG", name: "Diamondback Energy",   price:  194.52, dailyMove:  2.1, sectorId: "sec-energy",  x: 1275, y: 278, notifications: [] },
  { id: "SLB",  kind: "stock", ticker: "SLB",  name: "SLB",                  price:   44.18, dailyMove: -1.8, sectorId: "sec-energy",  x: 1215, y: 178, notifications: [] },
  { id: "HIMS", kind: "stock", ticker: "HIMS", name: "Hims & Hers",          price:   21.44, dailyMove: 12.3, sectorId: "sec-health",  x:  258, y: 710, notifications: [] },
  { id: "RXRX", kind: "stock", ticker: "RXRX", name: "Recursion Pharma",     price:    5.82, dailyMove:  4.1, sectorId: "sec-health",  x:  308, y: 858, notifications: [] },
  { id: "LLY",  kind: "stock", ticker: "LLY",  name: "Eli Lilly",            price:  803.28, dailyMove: -0.6, sectorId: "sec-health",  x:  592, y: 832, notifications: [] },
  { id: "MRNA", kind: "stock", ticker: "MRNA", name: "Moderna",              price:   75.60, dailyMove: -2.3, sectorId: "sec-health",  x:  502, y: 682, notifications: [] },
  { id: "SOFI", kind: "stock", ticker: "SOFI", name: "SoFi Technologies",    price:    8.42, dailyMove:  4.2, sectorId: "sec-finance", x:  978, y: 682, notifications: [] },
  { id: "AFRM", kind: "stock", ticker: "AFRM", name: "Affirm",               price:   35.18, dailyMove:  3.8, sectorId: "sec-finance", x: 1312, y: 622, notifications: [] },
  { id: "PYPL", kind: "stock", ticker: "PYPL", name: "PayPal",               price:   63.44, dailyMove: -0.8, sectorId: "sec-finance", x: 1362, y: 782, notifications: [] },
  { id: "COIN", kind: "stock", ticker: "COIN", name: "Coinbase",             price:  215.80, dailyMove:  6.1, sectorId: "sec-finance", x: 1082, y: 828, notifications: [] },
  { id: "HOOD", kind: "stock", ticker: "HOOD", name: "Robinhood",            price:   22.36, dailyMove:  5.4, sectorId: "sec-finance", x: 1228, y: 868, notifications: [] },
];

const FALLBACK_EXTRA_EDGES: Edge[] = [
  { source: "SMCI", target: "NVDA", kind: "explicit" },
  { source: "SMCI", target: "ARM",  kind: "explicit" },
  { source: "NVDA", target: "AMD",  kind: "explicit" },
  { source: "NVDA", target: "ARM",  kind: "explicit" },
  { source: "AMD",  target: "ARM",  kind: "explicit" },
  { source: "PLTR", target: "MSFT", kind: "explicit" },
  { source: "PLTR", target: "SOFI", kind: "explicit" },
  { source: "FANG", target: "XOM",  kind: "explicit" },
  { source: "AFRM", target: "PYPL", kind: "explicit" },
  { source: "COIN", target: "SOFI", kind: "explicit" },
  { source: "HOOD", target: "COIN", kind: "explicit" },
  { source: "SOFI", target: "AFRM", kind: "explicit" },
  { source: "HIMS", target: "RXRX", kind: "explicit" },
];

// ─── Connection view ──────────────────────────────────────────────────────────

export type ConnectionMode = "structural" | "exposure" | "peer" | "impact";

export interface ConnectionView {
  modes: ConnectionMode[];       // which tier/type to show (multi-select)
  focusTickers: string[];        // if non-empty, only show edges touching these tickers
  focusSectors: string[];        // ETF codes — show connections relevant to these sectors
}

export const DEFAULT_CONNECTION_VIEW: ConnectionView = {
  modes: ["structural"],
  focusTickers: [],
  focusSectors: [],
};

// ─── Graph data assembly ──────────────────────────────────────────────────────

interface Edge {
  source: string;
  target: string;
  kind: "sector" | "primary" | "explicit";
  tier?: number; // 1=Exposure 2=Peer 3=Impact; undefined for structural/sector edges
}

interface GraphData {
  nodes: GNode[];
  edges: Edge[];
  nodeById: Map<string, GNode>;
  adjacency: Map<string, Set<string>>;
}

function buildGraphData(
  sectorNodes: SectorNode[],
  stockNodes:  StockNode[],
  extraEdges:  Edge[],
  subNodes:    Array<SubSectorNode | SubSubSectorNode> = [],
): GraphData {
  const raw: GNode[] = [...sectorNodes, ...subNodes, ...stockNodes];
  // Deduplicate by id — first occurrence wins (DB-loaded sector beats fallback default)
  const seen = new Set<string>();
  const nodes = raw.filter((n) => { if (seen.has(n.id)) return false; seen.add(n.id); return true; });

  const sectorEdges: Edge[] = stockNodes.map((n) => ({ source: n.id, target: n.sectorId, kind: "sector" as const }));
  const edges: Edge[] = [...sectorEdges, ...extraEdges];

  const nodeById = new Map<string, GNode>(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach((n) => adjacency.set(n.id, new Set()));
  edges.forEach((e) => {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  });

  return { nodes, edges, nodeById, adjacency };
}

// ─── Camera ───────────────────────────────────────────────────────────────────

interface Camera { x: number; y: number; scale: number; }

// ─── Component ────────────────────────────────────────────────────────────────

interface FundEntry {
  marketCap: number | null;
  trailingPE: number | null;
  beta: number | null;
  averageVolume: number | null;
  volume: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface DbStock {
  ticker: string;
  company_name: string;
  sector: string;
  x_position: number;
  y_position: number;
}

interface DbConnection {
  ticker_a: string;
  ticker_b: string;
  tier:     number;
}

interface DbHierarchyNode {
  id:             string;
  node_type:      "sector" | "subsector" | "subsubsector";
  company_name:   string;
  display_name:   string | null;
  etf_ticker:     string | null;
  colour:         string | null;
  parent_node_id: string | null;
  x_position:     number;
  y_position:     number;
}

// ─── Module-level draw utilities ─────────────────────────────────────────────

function withOpacity(col: string, alpha: number): string {
  if (col.startsWith("rgb(")) return col.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
  if (col.startsWith("#") && col.length === 7) {
    const r = parseInt(col.slice(1, 3), 16);
    const g = parseInt(col.slice(3, 5), 16);
    const b = parseInt(col.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return col;
}

type LabelSide = "top" | "bottom" | "left" | "right";

// For each hierarchy node pick the quadrant (top/bottom/left/right) with least
// neighbour pressure, so labels point away from the densest nearby cluster.
function computeLabelSides(nodes: GNode[]): Map<string, LabelSide> {
  const INFLUENCE_R   = 380;
  const SIDES: LabelSide[] = ["top", "bottom", "left", "right"];
  const SIDE_ANGLE: Record<LabelSide, number> = {
    top: -Math.PI / 2, bottom: Math.PI / 2, left: Math.PI, right: 0,
  };
  const result = new Map<string, LabelSide>();
  for (const node of nodes.filter((n) => n.kind !== "stock")) {
    const nearby = nodes.filter(
      (n) => n.id !== node.id && Math.hypot(n.x - node.x, n.y - node.y) < INFLUENCE_R
    );
    if (!nearby.length) { result.set(node.id, "bottom"); continue; }
    const scores = { top: 0, bottom: 0, left: 0, right: 0 } as Record<LabelSide, number>;
    for (const n of nearby) {
      const dx = n.x - node.x, dy = n.y - node.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < 1) continue;
      const angle = Math.atan2(dy, dx);
      for (const side of SIDES) {
        const align = Math.cos(angle - SIDE_ANGLE[side]);
        if (align > 0) scores[side] += align / dist2;
      }
    }
    let best: LabelSide = "bottom", bestScore = Infinity;
    for (const side of SIDES) {
      if (scores[side] < bestScore) { bestScore = scores[side]; best = side; }
    }
    result.set(node.id, best);
  }
  return result;
}

// Render a stack of text lines to one side of a node ring.
function drawLabel(
  c: CanvasRenderingContext2D,
  lines: Array<{ text: string; font: string; alpha: number; col: string }>,
  side: LabelSide,
  r: number,
  gap: number,
) {
  if (!lines.length) return;
  const SP = 2;
  const heights = lines.map((l) => {
    const m = l.font.match(/([\d.]+)px/);
    return m ? parseFloat(m[1]) : 10;
  });
  const totalH = heights.reduce((s, h) => s + h, 0) + SP * (lines.length - 1);
  c.textBaseline = "top";
  let sx: number, sy: number;
  switch (side) {
    case "bottom": sx = 0;          sy = r + gap;             c.textAlign = "center"; break;
    case "top":    sx = 0;          sy = -(r + gap + totalH); c.textAlign = "center"; break;
    case "right":  sx = r + gap;    sy = -totalH / 2;         c.textAlign = "left";   break;
    default:       sx = -(r + gap); sy = -totalH / 2;         c.textAlign = "right";  break;
  }
  let y = sy;
  for (let i = 0; i < lines.length; i++) {
    c.font      = lines[i].font;
    c.fillStyle = withOpacity(lines[i].col, lines[i].alpha);
    c.fillText(lines[i].text, sx, y);
    y += heights[i] + SP;
  }
}

// Controls whether the node itself (circle) is drawn. Only stocks vanish at low zoom.
function nodeLodAlpha(node: GNode, camScale: number): number {
  if (node.kind !== "stock") return 1;
  if (camScale >= LOD_SUBSUBSECTOR + LOD_FADE) return 1;
  if (camScale <  LOD_SUBSUBSECTOR)            return 0;
  return (camScale - LOD_SUBSUBSECTOR) / LOD_FADE;
}

// Controls label opacity for hierarchy nodes. Circles are always visible; names fade in.
function labelLodAlpha(node: GNode, camScale: number): number {
  if (node.kind === "sector" || node.kind === "stock") return 1;
  const threshold = node.kind === "subsector" ? LOD_SUBSECTOR : LOD_SUBSUBSECTOR;
  if (camScale >= threshold + LOD_FADE) return 1;
  if (camScale <  threshold)            return 0;
  return (camScale - threshold) / LOD_FADE;
}

const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas({
  onHover, activeFilters, graphSettings,
  editMode, adminView, connectionView, sectorNodes, onNodeDragEnd, onContextMenu, onShiftEmptyClick, onGraphLoaded,
}, ref) {
  const router         = useRouter();
  const { user }       = useUser();
  const { getToken }   = useAuth();
  const portfolioRef   = useRef<Set<string>>(new Set());
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const cameraRef      = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const hoveredIdRef   = useRef<string | null>(null);
  const animTRef       = useRef(0);
  const panningRef     = useRef(false);
  const lastMouseRef   = useRef({ x: 0, y: 0 });
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);
  const onHoverRef     = useRef(onHover);
  onHoverRef.current   = onHover;
  const routerRef      = useRef(router);
  routerRef.current    = router;

  // Separate refs for graph data components so sectors can be updated independently.
  // Seed stock positions from the session cache (set on previous visit) so the graph
  // shows correct positions immediately instead of flashing fallback coordinates.
  const sectorNodesRef = useRef<SectorNode[]>(sectorNodes ?? DEFAULT_SECTOR_NODES.map((s) => ({ ...s })));
  const cachedPos = getCachedNodePositions() ?? sessionPositions;
  const seededStockNodes: StockNode[] = cachedPos
    ? FALLBACK_STOCK_NODES.map((n) => {
        const p = cachedPos[n.id];
        return p ? { ...n, x: p.x, y: p.y } : n;
      })
    : FALLBACK_STOCK_NODES;
  const stockNodesRef  = useRef<StockNode[]>(seededStockNodes);
  const extraEdgesRef  = useRef<Edge[]>(FALLBACK_EXTRA_EDGES);

  const graphDataRef = useRef<GraphData>(
    buildGraphData(sectorNodesRef.current, seededStockNodes, extraEdgesRef.current)
  );
  const labelSidesRef    = useRef<Map<string, LabelSide>>(new Map());
  const contentBoundsRef = useRef<{ minX: number; maxX: number; minY: number; maxY: number } | null>(null);

  // Position snapshot for edit-mode discard
  const positionSnapshotRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Target camera for smooth zoom-to-node animation
  const targetCameraRef = useRef<Camera | null>(null);

  useImperativeHandle(ref, () => ({
    snapshotPositions() {
      const snap = new Map<string, { x: number; y: number }>();
      for (const node of graphDataRef.current.nodes) {
        snap.set(node.id, { x: node.x, y: node.y });
      }
      positionSnapshotRef.current = snap;
    },
    restorePositions() {
      for (const node of graphDataRef.current.nodes) {
        const saved = positionSnapshotRef.current.get(node.id);
        if (saved) {
          node.x = saved.x;
          node.y = saved.y;
        }
      }
    },
    zoomToNode(nodeId: string) {
      const node = graphDataRef.current.nodes.find(
        (n) => n.id === nodeId || (n.kind === "stock" && (n as StockNode).ticker === nodeId)
      );
      if (!node || !canvasRef.current) return;
      const W = canvasRef.current.clientWidth;
      const H = canvasRef.current.clientHeight;
      const targetScale =
        node.kind === "sector"       ? 0.45 :
        node.kind === "subsector"    ? 0.70 :
        node.kind === "subsubsector" ? 0.90 : 1.5;
      targetCameraRef.current = {
        x: W / 2 - node.x * targetScale,
        y: H / 2 - node.y * targetScale,
        scale: targetScale,
      };
    },
  }));

  interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }
  const liveDataRef      = useRef<Record<string, LiveEntry>>({});
  const liveDataReadyRef = useRef(false);
  const fundamentalsRef    = useRef<Record<string, FundEntry>>({});
  const activeFiltersRef   = useRef<ActiveFilters>(DEFAULT_FILTERS);
  const graphSettingsRef   = useRef<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const notificationsRef   = useRef<Record<string, Array<{ type: NotifType }>>>({});

  // Connection view ref
  const connectionViewRef = useRef<ConnectionView>(DEFAULT_CONNECTION_VIEW);

  // Admin view ref — bypasses stock LOD so all nodes are visible at any zoom
  const adminViewRef = useRef(false);

  // Edit mode refs
  const editModeRef          = useRef(false);
  const draggingNodeRef      = useRef<GNode | null>(null);
  const onNodeDragEndRef     = useRef(onNodeDragEnd);
  const onContextMenuRef     = useRef(onContextMenu);
  const onShiftEmptyClickRef = useRef(onShiftEmptyClick);
  const onGraphLoadedRef     = useRef(onGraphLoaded);

  const [hoverNode, setHoverNode] = useState<GNode | null>(null);

  // Keep refs in sync with props
  useEffect(() => { activeFiltersRef.current    = activeFilters  ?? DEFAULT_FILTERS;       }, [activeFilters]);
  useEffect(() => { graphSettingsRef.current    = graphSettings  ?? DEFAULT_GRAPH_SETTINGS; }, [graphSettings]);
  useEffect(() => { editModeRef.current          = editMode       ?? false;                  }, [editMode]);
  useEffect(() => { adminViewRef.current         = adminView      ?? false;                  }, [adminView]);
  useEffect(() => { connectionViewRef.current    = connectionView ?? DEFAULT_CONNECTION_VIEW; }, [connectionView]);
  useEffect(() => { onNodeDragEndRef.current   = onNodeDragEnd;                            }, [onNodeDragEnd]);
  useEffect(() => { onContextMenuRef.current   = onContextMenu;                            }, [onContextMenu]);
  useEffect(() => { onShiftEmptyClickRef.current = onShiftEmptyClick;                      }, [onShiftEmptyClick]);
  useEffect(() => { onGraphLoadedRef.current   = onGraphLoaded;                            }, [onGraphLoaded]);

  // Rebuild graph when sector nodes change (add/edit sector from admin)
  useEffect(() => {
    if (!sectorNodes) return;
    // Preserve current positions of existing sectors (in case they've been dragged)
    const currentById = new Map(graphDataRef.current.nodes.map((n) => [n.id, n]));
    sectorNodesRef.current = sectorNodes.map((s) => {
      const existing = currentById.get(s.id);
      return existing ? { ...s, x: existing.x, y: existing.y } : { ...s };
    });
    const existingSubs = graphDataRef.current.nodes.filter(
      (n): n is SubSectorNode | SubSubSectorNode => n.kind === "subsector" || n.kind === "subsubsector"
    );
    graphDataRef.current = buildGraphData(sectorNodesRef.current, stockNodesRef.current, extraEdgesRef.current, existingSubs);
  }, [sectorNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch graph structure (stocks + hierarchy + connections) from database
  useEffect(() => {
    fetch("/api/graph", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { stocks: DbStock[]; hierarchy: DbHierarchyNode[]; connections: DbConnection[] } | null) => {
        if (!data) return;

        // ── Build a lookup: DB uuid → ETF ticker, for resolving parent_node_id
        const uuidToEtf = new Map<string, string>();
        for (const h of data.hierarchy ?? []) {
          if (h.node_type === "sector" && h.etf_ticker) uuidToEtf.set(h.id, h.etf_ticker);
        }
        // Also map subsector uuid → its parent sector ETF
        const uuidToSectorEtf = new Map<string, string>();
        for (const h of data.hierarchy ?? []) {
          if (h.node_type === "subsector" && h.parent_node_id) {
            const sectorEtf = uuidToEtf.get(h.parent_node_id);
            if (sectorEtf) uuidToSectorEtf.set(h.id, sectorEtf);
          }
        }

        // ── Build hierarchy nodes
        const dbSectorNodes: SectorNode[] = [];
        const subNodes: Array<SubSectorNode | SubSubSectorNode> = [];

        for (const h of data.hierarchy ?? []) {
          const label = h.display_name ?? h.company_name;
          const x     = h.x_position * 1600;
          const y     = h.y_position * 1100;

          if (h.node_type === "sector") {
            const etf = h.etf_ticker ?? h.company_name;
            dbSectorNodes.push({
              id: etf, kind: "sector", name: label, etf,
              price: 0, dailyMove: 0, x, y,
              colour: h.colour ?? undefined,
              notifications: [],
            });
          } else if (h.node_type === "subsector") {
            const sectorEtf = h.parent_node_id ? (uuidToEtf.get(h.parent_node_id) ?? "XLK") : "XLK";
            subNodes.push({
              id: h.company_name, kind: "subsector", name: label,
              etf: h.etf_ticker ?? undefined,
              parentId: sectorEtf,
              sectorEtf,
              colour: h.colour ?? undefined,
              x, y, notifications: [],
            });
          } else if (h.node_type === "subsubsector") {
            const parentSectorEtf = h.parent_node_id ? (uuidToSectorEtf.get(h.parent_node_id) ?? "XLK") : "XLK";
            subNodes.push({
              id: h.company_name, kind: "subsubsector", name: label,
              etf: h.etf_ticker ?? undefined,
              parentId: h.company_name, // overridden below with actual parent name
              sectorEtf: parentSectorEtf,
              colour: h.colour ?? undefined,
              x, y, notifications: [],
            });
          }
        }

        // Fix subsubsector parentId to the subsector's company_name
        const uuidToName = new Map<string, string>();
        for (const h of data.hierarchy ?? []) uuidToName.set(h.id, h.company_name);
        for (const n of subNodes) {
          if (n.kind === "subsubsector") {
            const rawH = (data.hierarchy ?? []).find((h) => h.company_name === n.name);
            if (rawH?.parent_node_id) (n as SubSubSectorNode).parentId = uuidToName.get(rawH.parent_node_id) ?? n.parentId;
          }
        }

        // ── Prefer DB sectors; fall back to defaults for any missing ETFs.
        // DB sectors use their stored position directly.
        // Fallback sectors (not yet in DB) use the position from sectorNodesRef,
        // which was initialised from localStorage via loadSectors() so user-saved
        // positions survive refresh even without a DB row.
        const dbEtfs = new Set(dbSectorNodes.map((s) => s.etf));
        const fallbackSectors = DEFAULT_SECTOR_NODES.filter((s) => !dbEtfs.has(s.etf));
        const savedById = new Map(sectorNodesRef.current.map((s) => [s.id, s]));
        const fallbackWithPos = fallbackSectors.map((s) => {
          const saved = savedById.get(s.id);
          return saved ? { ...s, x: saved.x, y: saved.y } : s;
        });
        const finalSectors = [...dbSectorNodes, ...fallbackWithPos];

        sectorNodesRef.current = finalSectors;

        // ── Stock nodes
        const stockNodes: StockNode[] = (data.stocks ?? []).map((s) => ({
          id:           s.ticker,
          kind:         "stock" as const,
          ticker:       s.ticker,
          name:         s.company_name,
          price:        0,
          dailyMove:    0,
          sectorId:     SECTOR_MAP[s.sector] ?? "XLK",
          x:            s.x_position * 1600,
          y:            s.y_position * 1100,
          notifications: [],
        }));

        // ── Extra edges (stock-stock + hierarchy connections)
        // Infer kind from node types: if either endpoint is a hierarchy node
        // (sector / subsector / subsubsector), this is a structural "primary" edge.
        // This avoids relying on the is_primary DB column for the graph fetch.
        const hierarchyIds = new Set<string>([
          ...finalSectors.map((s) => s.id),
          ...subNodes.map((s) => s.id),
        ]);
        // Explicit connections from DB (stock-stock Peer/Impact, stock-hierarchy Exposure)
        const explicitEdges: Edge[] = (data.connections ?? []).map((c) => ({
          source: c.ticker_a,
          target: c.ticker_b,
          kind:   (hierarchyIds.has(c.ticker_a) || hierarchyIds.has(c.ticker_b))
                    ? "primary" : "explicit",
          tier:   c.tier as number,
        } as Edge));

        // Structural edges auto-generated from parent_node_id — never need to be
        // stored in admin_connections. Subsector → parent sector, industry → parent subsector.
        const structuralEdges: Edge[] = subNodes.map((n) => ({
          source: n.id,
          target: n.kind === "subsector"
            ? (n as SubSectorNode).parentId
            : (n as SubSubSectorNode).parentId,
          kind: "primary" as const,
        })).filter((e) => !!e.target);

        const extraEdges: Edge[] = [...explicitEdges, ...structuralEdges];

        stockNodesRef.current = stockNodes;
        extraEdgesRef.current = extraEdges;
        graphDataRef.current  = buildGraphData(finalSectors, stockNodes, extraEdges, subNodes);
        labelSidesRef.current = computeLabelSides(graphDataRef.current.nodes);

        // Re-centre the camera on the actual node bounding box now that real
        // positions are loaded. Only hierarchy nodes define the layout shape.
        if (canvasRef.current) {
          const W = canvasRef.current.clientWidth;
          const H = canvasRef.current.clientHeight;
          const hn = graphDataRef.current.nodes.filter(
            (n) => n.kind === "sector" || n.kind === "subsector" || n.kind === "subsubsector"
          );
          if (hn.length > 0) {
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (const n of hn) {
              const r = n.kind === "sector" ? 132 : n.kind === "subsector" ? 66 : 50;
              minX = Math.min(minX, n.x - r);
              maxX = Math.max(maxX, n.x + r);
              minY = Math.min(minY, n.y - r);
              maxY = Math.max(maxY, n.y + r);
            }
            const pad   = 80;
            const scale = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY), 0.95);
            cameraRef.current = {
              scale,
              x: W / 2 - ((minX + maxX) / 2) * scale,
              y: H / 2 - ((minY + maxY) / 2) * scale,
            };
            contentBoundsRef.current = { minX, maxX, minY, maxY };
          }
        }

        onGraphLoadedRef.current?.(stockNodes.map((n) => n.ticker));

        const posMap: Record<string, { x: number; y: number }> = {};
        for (const n of stockNodes) posMap[n.id] = { x: n.x, y: n.y };
        setCachedNodePositions(posMap);
        try {
          sessionStorage.setItem("vauric_node_positions", JSON.stringify(posMap));
        } catch { /* ignore */ }

        console.log(
          `[graph] loaded ${stockNodes.length} stocks, ${dbSectorNodes.length} sectors,`,
          `${subNodes.length} sub/subsubsectors, ${extraEdges.length} connections`,
        );
      })
      .catch((err) => console.error('[graph] fetch failed:', err));
  }, []);

  // Fetch fundamentals
  useEffect(() => {
    fetch("/api/fundamentals")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) fundamentalsRef.current = data; })
      .catch(() => {});
  }, []);

  // Fetch notification dots for stock nodes and sector nodes in parallel.
  // Stock dots: only high-significance single-stock events (generates_notification=true).
  // Sector dots: sector-level news articles shown as yellow "news" dots on sector rings.
  useEffect(() => {
    const SECTOR_NODE_MAP: Record<string, string> = {
      tech:             "XLK",
      energy:           "XLE",
      health:           "XLV",
      finance:          "XLF",
      consumer:         "XLY",
      industrials:      "XLI",
      "consumer-staples": "XLP",
      communication:    "XLC",
      materials:        "XLB",
      "real-estate":    "XLRE",
      utilities:        "XLU",
    };

    Promise.allSettled([
      fetch("/api/news?notifonly=1").then((r) => r.ok ? r.json() : null),
      fetch("/api/news?sectorNews=1").then((r) => r.ok ? r.json() : null),
    ]).then(([stockRes, sectorRes]) => {
      const map: Record<string, Array<{ type: NotifType }>> = {};

      // Stock notification dots — windowing is handled server-side by the API
      const stockArticles: Array<{ ticker: string; notification_type: string; published_at: string }> =
        stockRes.status === "fulfilled" && stockRes.value ? stockRes.value : [];
      for (const a of stockArticles) {
        if (!map[a.ticker]) map[a.ticker] = [];
        const t = a.notification_type as NotifType;
        if (!map[a.ticker].some((n) => n.type === t)) map[a.ticker].push({ type: t });
      }

      // Sector notification dots — 24 h window handled by the sectorNews API endpoint
      const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
      const sectorItems: Array<{ sector_id: string; notification_type: string; published_at: string }> =
        sectorRes.status === "fulfilled" && sectorRes.value ? sectorRes.value : [];
      for (const item of sectorItems) {
        if (new Date(item.published_at).getTime() < cutoff24h) continue;
        const nodeId = SECTOR_NODE_MAP[item.sector_id];
        if (!nodeId) continue;
        if (!map[nodeId]) map[nodeId] = [];
        if (!map[nodeId].some((n) => n.type === "news")) map[nodeId].push({ type: "news" });
      }

      notificationsRef.current = map;
    }).catch(() => {});
  }, []);

  // Fetch portfolio holdings so owned stock nodes get the amber ring.
  useEffect(() => {
    if (!user) return;
    getToken().then((token) => {
      fetch(`/api/portfolio?userId=${encodeURIComponent(user.id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.ok ? r.json() : [])
        .then((holdings: Array<{ ticker: string }>) => {
          portfolioRef.current = new Set(holdings.map((h) => h.ticker));
        })
        .catch(() => {});
    }).catch(() => {});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate live data — attach to the module-level promise that started
  // fetching before this component mounted, rather than starting a new fetch.
  useEffect(() => {
    const cached = getCachedMarketData();
    if (cached) {
      liveDataRef.current      = cached;
      liveDataReadyRef.current = true;
      return;
    }

    // Safety timeout: unblock the RAF loop after 3 s if the fetch stalls.
    const timeoutId = setTimeout(() => { liveDataReadyRef.current = true; }, 3000);

    (_marketDataPromise ?? Promise.resolve())
      .then(() => {
        const data = getCachedMarketData();
        if (data) liveDataRef.current = data;
        liveDataReadyRef.current = true;
      })
      .finally(() => clearTimeout(timeoutId));
  }, []);

  useEffect(() => {
    const canvas: HTMLCanvasElement = canvasRef.current!;
    const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
    const dpr = () => window.devicePixelRatio || 1;
    let raf = 0;

    // ── Sizing ──────────────────────────────────────────────────────────────

    function resize() {
      canvas.width  = canvas.clientWidth  * dpr();
      canvas.height = canvas.clientHeight * dpr();
      if (!initializedRef.current) {
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        const scale = Math.min(W / 1600, H / 1100, 0.95);
        cameraRef.current = {
          x: W / 2 - 800 * scale,
          y: H / 2 - 535 * scale,
          scale,
        };
        initializedRef.current = true;
      }
    }

    // ── Coordinate helpers ───────────────────────────────────────────────────

    function worldPos(node: GNode, t: number) {
      if (draggingNodeRef.current && node.id === draggingNodeRef.current.id) {
        return { x: node.x, y: node.y };
      }
      const seed = node.id.charCodeAt(0) * 3 + (node.id.charCodeAt(1) || 0);
      return {
        x: node.x + Math.sin(t * 0.38 + seed * 0.71) * 4,
        y: node.y + Math.cos(t * 0.32 + seed * 0.53) * 4,
      };
    }

    function hitTestEdge(mx: number, my: number): string | null {
      const w   = toWorld(mx, my);
      const t   = animTRef.current;
      const thr = 8;
      for (const edge of graphDataRef.current.edges) {
        const src = graphDataRef.current.nodes.find((n) => n.id === edge.source);
        const tgt = graphDataRef.current.nodes.find((n) => n.id === edge.target);
        if (!src || !tgt || src.kind !== "stock" || tgt.kind !== "stock") continue;
        const p1  = worldPos(src, t);
        const p2  = worldPos(tgt, t);
        const dx  = p2.x - p1.x;
        const dy  = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 < 1) continue;
        const u  = Math.max(0, Math.min(1, ((w.x - p1.x) * dx + (w.y - p1.y) * dy) / len2));
        const nx = p1.x + u * dx;
        const ny = p1.y + u * dy;
        if ((w.x - nx) ** 2 + (w.y - ny) ** 2 < thr * thr) return `${edge.source}---${edge.target}`;
      }
      return null;
    }

    function toWorld(sx: number, sy: number) {
      const cam = cameraRef.current;
      return {
        x: (sx - cam.x) / cam.scale,
        y: (sy - cam.y) / cam.scale,
      };
    }

    // Clamp camera so at least MARGIN screen-px of the actual content stays visible on each side.
    // Uses the real node bounding box once loaded; falls back to world dimensions until then.
    const PAN_MARGIN = 200;
    function clampCamera(cam: Camera): Camera {
      const W  = canvas.clientWidth;
      const H  = canvas.clientHeight;
      const cb = contentBoundsRef.current;
      const x1 = cb ? cb.minX : 0,    x2 = cb ? cb.maxX : 1600;
      const y1 = cb ? cb.minY : 0,    y2 = cb ? cb.maxY : 1100;
      const x  = Math.max(PAN_MARGIN - x2 * cam.scale, Math.min(W - PAN_MARGIN - x1 * cam.scale, cam.x));
      const y  = Math.max(PAN_MARGIN - y2 * cam.scale, Math.min(H - PAN_MARGIN - y1 * cam.scale, cam.y));
      return (x === cam.x && y === cam.y) ? cam : { ...cam, x, y };
    }

    // ── Node radius ──────────────────────────────────────────────────────────

    function nodeRadius(n: GNode): number {
      if (n.kind === "sector")       return 132;
      if (n.kind === "subsector")    return 66;
      if (n.kind === "subsubsector") return 50;
      const conns = graphDataRef.current.adjacency.get(n.id)?.size ?? 0;
      return Math.min(28, 12 + conns * 2.2);
    }

    // ── Hit testing ──────────────────────────────────────────────────────────

    function hitTest(mx: number, my: number): GNode | null {
      const w = toWorld(mx, my);
      const t = animTRef.current;
      for (const node of [...graphDataRef.current.nodes].reverse()) {
        const hitScale = adminViewRef.current ? LOD_SUBSUBSECTOR + LOD_FADE + 1 : cameraRef.current.scale;
        if (nodeLodAlpha(node, hitScale) < 0.5) continue;
        const pos = worldPos(node, t);
        const r   = effectiveRadius(node) + 6;
        const dx  = w.x - pos.x;
        const dy  = w.y - pos.y;
        if (dx * dx + dy * dy <= r * r) return node;
      }
      return null;
    }

    // ── Filter helpers ───────────────────────────────────────────────────────

    function isNodeFiltered(node: GNode): boolean {
      if (node.kind === "sector" || node.kind === "subsector" || node.kind === "subsubsector") return false;
      const f    = activeFiltersRef.current;
      const live = liveDataRef.current[node.ticker];
      const fund = fundamentalsRef.current[node.ticker] as FundEntry | undefined;

      const sid = ETF_TO_FILTER_ID[node.sectorId] ?? node.sectorId;
      if (!f.sectors.includes(sid)) return true;

      // Sub-sector filter: stock must connect to at least one selected subsector
      if (f.subSectors.length > 0) {
        const adj = graphDataRef.current.adjacency.get(node.id) ?? new Set<string>();
        if (!f.subSectors.some((id) => adj.has(id))) return true;
      }

      // Industry filter: stock must connect to at least one selected industry
      if (f.industries.length > 0) {
        const adj = graphDataRef.current.adjacency.get(node.id) ?? new Set<string>();
        if (!f.industries.some((id) => adj.has(id))) return true;
      }

      const move = live?.dailyMove ?? 0;
      if (f.dailyMove.min !== null && move < f.dailyMove.min) return true;
      if (f.dailyMove.max !== null && move > f.dailyMove.max) return true;

      const price = live?.price ?? 0;
      if (f.price.min !== null && price < f.price.min) return true;
      if (f.price.max !== null && price > f.price.max) return true;

      if (f.marketCapTiers.length < ALL_CAP_TIERS.length) {
        const cap = fund?.marketCap ?? null;
        if (cap !== null) {
          const tier = cap >= 200e9 ? "mega" : cap >= 10e9 ? "large" : cap >= 2e9 ? "mid" : "small";
          if (!f.marketCapTiers.includes(tier)) return true;
        }
      }

      const pe = fund?.trailingPE ?? null;
      if (f.trailingPE.min !== null && (pe === null || pe < f.trailingPE.min)) return true;
      if (f.trailingPE.max !== null && (pe === null || pe > f.trailingPE.max)) return true;

      const beta = fund?.beta ?? null;
      if (f.beta.min !== null && (beta === null || beta < f.beta.min)) return true;
      if (f.beta.max !== null && (beta === null || beta > f.beta.max)) return true;

      const avgVol = fund?.averageVolume ?? null;
      if (f.avgVolumeMin !== null && (avgVol === null || avgVol < f.avgVolumeMin)) return true;

      if (f.fiftyTwoWeekPos.length < ALL_52W_POS.length) {
        const hi = fund?.fiftyTwoWeekHigh ?? null;
        const lo = fund?.fiftyTwoWeekLow  ?? null;
        const p  = live?.price ?? null;
        if (hi !== null && lo !== null && p !== null) {
          const pos52 = p / lo <= 1.10 ? "low" : p / hi >= 0.90 ? "high" : "mid";
          if (!f.fiftyTwoWeekPos.includes(pos52)) return true;
        }
      }

      if (f.relVolumeMin !== null) {
        const vol  = fund?.volume ?? null;
        const avgV = fund?.averageVolume ?? null;
        if (vol !== null && avgV !== null && avgV > 0) {
          if (vol / avgV < f.relVolumeMin) return true;
        }
      }

      if (f.streak !== "any") {
        const m = live?.dailyMove ?? 0;
        if (f.streak === "up"   && m <= 0) return true;
        if (f.streak === "down" && m >= 0) return true;
      }

      return false;
    }

    function effectiveRadius(node: GNode): number {
      if (node.kind === "sector")       return 132;
      if (node.kind === "subsector")    return 66;
      if (node.kind === "subsubsector") return 39;
      // Use graphSettingsRef (not activeFiltersRef) for nodeSize so that filter
      // presets — which spread DEFAULT_FILTERS — cannot accidentally resize nodes.
      // Opacity-only filtering must never affect the radius calculation.
      if (graphSettingsRef.current.nodeSize === "marketcap") {
        const cap = fundamentalsRef.current[node.ticker]?.marketCap ?? null;
        if (cap !== null && cap > 0) {
          const minR = 9, maxR = 28, logMin = 8, logMax = 13;
          const t = Math.max(0, Math.min(1, (Math.log10(cap) - logMin) / (logMax - logMin)));
          return Math.round(minR + t * (maxR - minR));
        }
      }
      return nodeRadius(node);
    }

    // ── Draw loop ────────────────────────────────────────────────────────────

    // Dirty-flag: skip redraw when nothing has changed
    let lastDrawKey = "";

    function draw() {
      const W   = canvas.clientWidth;
      const H   = canvas.clientHeight;
      const t   = animTRef.current;
      const hid = hoveredIdRef.current;
      const gd  = graphDataRef.current;
      const hovNeighbors = hid ? (gd.adjacency.get(hid) ?? null) : null;
      const cam = cameraRef.current;
      const d   = dpr();

      const animating = targetCameraRef.current !== null || draggingNodeRef.current !== null;
      const cv = connectionViewRef.current;
      const drawKey = `${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.scale.toFixed(3)},${hid ?? ""},${cv.modes.join(",")},${cv.focusTickers.join(",")},${cv.focusSectors.join(",")},${animating},${adminViewRef.current},${liveDataReadyRef.current}`;
      if (drawKey === lastDrawKey && !animating) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastDrawKey = drawKey;

      function shouldDrawEdge(edge: Edge): boolean {
        const cv = connectionViewRef.current;
        const { modes, focusTickers, focusSectors } = cv;

        // Ticker + sector focus: combined with OR so both can be active simultaneously.
        // If either filter is set, the edge must satisfy at least one of them.
        const hasTickerFocus = focusTickers.length > 0;
        const hasSectorFocus = focusSectors.length > 0;
        if (hasTickerFocus || hasSectorFocus) {
          const matchesTicker = hasTickerFocus &&
            (focusTickers.includes(edge.source) || focusTickers.includes(edge.target));

          const matchesSector = hasSectorFocus && (() => {
            const sectorOf = (id: string): string | null => {
              const n = gd.nodeById.get(id);
              if (!n) return null;
              if (n.kind === "stock")                                   return (n as { sectorId?: string }).sectorId ?? null;
              if (n.kind === "sector")                                  return (n as { etf?: string }).etf ?? null;
              if (n.kind === "subsector" || n.kind === "subsubsector")  return (n as { sectorEtf?: string }).sectorEtf ?? null;
              return null;
            };
            const srcSector = sectorOf(edge.source);
            const tgtSector = sectorOf(edge.target);
            return focusSectors.includes(srcSector ?? "") || focusSectors.includes(tgtSector ?? "");
          })();

          if (!matchesTicker && !matchesSector) return false;
        }

        if (modes.length === 0) return false;

        const srcKind = gd.nodeById.get(edge.source)?.kind;
        const tgtKind = gd.nodeById.get(edge.target)?.kind;
        const isSector = edge.kind === "sector";
        const isHierarchy = !isSector && (srcKind !== "stock" && tgtKind !== "stock");
        const isStockToHierarchy = (srcKind === "stock") !== (tgtKind === "stock"); // one each
        const isStockStock = srcKind === "stock" && tgtKind === "stock";

        for (const mode of modes) {
          // Structural = only the hierarchy chain (subsector→sector, industry→subsector)
          // Does NOT include stock→sector edges or stock→hierarchy exposure connections
          if (mode === "structural" && isHierarchy) return true;
          if (mode === "exposure"   && isStockToHierarchy && edge.tier === 1) return true;
          if (mode === "peer"       && isStockStock && edge.tier === 2) return true;
          if (mode === "impact"     && isStockStock && edge.tier === 3) return true;
        }

        // When a sector filter is active, always show T1 exposure connections
        // (stock→industry links) so stocks connected to the filtered sector are visible
        // even when Exposure mode isn't explicitly selected.
        if (focusSectors.length > 0 && isStockToHierarchy && edge.tier === 1) return true;

        return false;
      }

      // Smooth zoom-to-node animation
      if (targetCameraRef.current) {
        const tgt = targetCameraRef.current;
        const k   = 0.12;
        const nx  = cam.x + (tgt.x - cam.x) * k;
        const ny  = cam.y + (tgt.y - cam.y) * k;
        const ns  = cam.scale + (tgt.scale - cam.scale) * k;
        cameraRef.current = { x: nx, y: ny, scale: ns };
        if (Math.abs(nx - tgt.x) < 0.5 && Math.abs(ny - tgt.y) < 0.5 && Math.abs(ns - tgt.scale) < 0.002) {
          cameraRef.current = tgt;
          targetCameraRef.current = null;
        }
      }

      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      const lodScale = adminViewRef.current ? LOD_SUBSUBSECTOR + LOD_FADE + 1 : cam.scale;

      // Viewport bounds in world space — used to cull off-screen edges
      const vMargin = 300;
      const vL = (-cam.x) / cam.scale - vMargin;
      const vR = (W - cam.x) / cam.scale + vMargin;
      const vT = (-cam.y) / cam.scale - vMargin;
      const vB = (H - cam.y) / cam.scale + vMargin;

      // Cache isNodeFiltered per frame — called up to twice per edge otherwise
      const filterCache = new Map<string, boolean>();
      const cachedFiltered = (node: GNode) => {
        let r = filterCache.get(node.id);
        if (r === undefined) { r = isNodeFiltered(node); filterCache.set(node.id, r); }
        return r;
      };

      // Edges — individual strokes preserve intersection accumulation (spiderweb effect)
      for (const edge of gd.edges) {
        if (!shouldDrawEdge(edge)) continue;
        const src = gd.nodeById.get(edge.source);
        const tgt = gd.nodeById.get(edge.target);
        if (!src || !tgt) continue;

        const edgeLodA = Math.min(nodeLodAlpha(src, lodScale), nodeLodAlpha(tgt, lodScale));
        if (edgeLodA === 0) continue;

        const sp = worldPos(src, t);
        const tp = worldPos(tgt, t);

        // Viewport culling — skip edges entirely off-screen
        if (!(sp.x >= vL && sp.x <= vR && sp.y >= vT && sp.y <= vB) &&
            !(tp.x >= vL && tp.x <= vR && tp.y >= vT && tp.y <= vB)) continue;

        const edgeFiltered = cachedFiltered(src) || cachedFiltered(tgt);
        // Structural edges (hierarchy chain) get a thicker base line
        const isStructural = edge.kind !== "explicit" &&
          src.kind !== "stock" && tgt.kind !== "stock";
        const baseW = isStructural ? 12.0 : 3.5;

        let alpha = edgeFiltered ? 0.04 : 0.28;
        let lineW = edgeFiltered ? 0.8 : baseW;
        if (!edgeFiltered && hid) {
          const lit = edge.source === hid || edge.target === hid;
          alpha = lit ? 0.75 : 0.04;
          lineW = lit ? baseW * 1.5 : 0.8;
        }
        alpha *= edgeLodA;
        if (alpha < 0.02) continue;

        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = `rgba(148,163,184,${alpha.toFixed(3)})`;
        ctx.lineWidth   = lineW;
        ctx.stroke();
      }

      // Nodes
      for (const node of gd.nodes) {
        const lodA = nodeLodAlpha(node, lodScale);
        if (lodA === 0) continue;

        const pos        = worldPos(node, t);
        const r          = effectiveRadius(node);
        // Subsectors/subsubsectors: use own ETF first for live colour; fall back to
        // parent sector's ETF only if the node has no ETF of its own.
        const liveKey  = node.kind === "sector" ? node.etf
          : (node.kind === "subsector" || node.kind === "subsubsector") ? (node.etf ?? node.sectorEtf)
          : node.id;
        const live     = liveDataRef.current[liveKey];
        const rawMove  = liveDataReadyRef.current ? (live?.dailyMove ?? (node as { dailyMove?: number }).dailyMove ?? 0) : 0;
        // For sectors: use stored colour if no live data available, otherwise use market colour
        const marketCol  = moveColor(rawMove);
        const col = (() => {
          if (node.kind === "sector") {
            return (node.colour && (!liveDataReadyRef.current || !live))
              ? node.colour : marketCol;
          }
          if (node.kind === "subsector" || node.kind === "subsubsector") {
            // No ETF assigned → amber "no ETF tracking" colour
            if (!node.etf) return NO_ETF_COLOR;
            // Has own ETF with live data → use that ETF's performance colour
            if (liveDataReadyRef.current && live) return marketCol;
            // Own ETF data not yet loaded → fall back to parent sector brand colour
            const parentSector = gd.nodeById.get(node.sectorEtf) as { colour?: string } | undefined;
            return parentSector?.colour ?? marketCol;
          }
          return marketCol;
        })();
        const fillCol  = moveFill(rawMove);
        const isHovered  = node.id === hid;
        const isNeighbor = hovNeighbors?.has(node.id) ?? false;
        const filtered   = isNodeFiltered(node);

        let globalAlpha = 1;
        let scale       = 1;
        if (filtered) {
          globalAlpha = 0.03;
        } else if (hid) {
          if (isHovered)        scale       = 1.18;
          else if (!isNeighbor) globalAlpha = 0.07;
        }
        globalAlpha *= lodA;

        ctx.save();
        ctx.globalAlpha = globalAlpha;
        ctx.translate(pos.x, pos.y);
        ctx.scale(scale, scale);

        const labelA = labelLodAlpha(node, lodScale);
        if (node.kind === "sector") {
          drawSectorNode(ctx, node, r, col, t, rawMove, cam.scale);
        } else if (node.kind === "subsector") {
          drawSubSectorNode(ctx, node, r, col, t, cam.scale, labelA);
        } else if (node.kind === "subsubsector") {
          drawSubSubSectorNode(ctx, node, r, col, t, cam.scale, labelA);
        } else {
          drawStockNode(ctx, node, r, col, fillCol);
          // Amber ring for stocks held in the user's portfolio
          if (portfolioRef.current.has(node.ticker)) {
            ctx.beginPath();
            ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(245,158,11,0.8)";
            ctx.lineWidth   = 2;
            ctx.stroke();
          }
        }

        const gs = graphSettingsRef.current;
        const liveNotifs = (node.kind === "stock"
          ? (notificationsRef.current[node.ticker] ?? node.notifications)
          : node.kind === "sector"
            ? (notificationsRef.current[node.id] ?? node.notifications)
            : node.notifications
        ).filter((n) => !gs.hiddenNotifTypes.includes(n.type));

        liveNotifs.forEach((notif, i) => {
          const dotR = 5.6;
          const dotX = r * 0.7;
          const dotY = -r * 0.7 - i * 10;
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = NOTIF[notif.type].color;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(7,9,15,0.6)";
          ctx.lineWidth   = 1;
          ctx.stroke();
          if (gs.accessibilityMode) {
            ctx.fillStyle     = "#000";
            ctx.font          = `bold ${Math.round(dotR * 1.4)}px sans-serif`;
            ctx.textAlign     = "center";
            ctx.textBaseline  = "middle";
            ctx.fillText(DOT_LETTERS[notif.type] ?? "?", dotX, dotY);
          }
        });

        ctx.restore();
      }

      ctx.restore();

      animTRef.current += 0.008;
      raf = requestAnimationFrame(draw);
    }

    // ── Node draw helpers ────────────────────────────────────────────────────

    // withOpacity is defined at module level

    function drawSectorNode(
      c: CanvasRenderingContext2D,
      node: SectorNode,
      r: number,
      col: string,
      t: number,
      move: number,
      camScale: number,
    ) {
      const pulse = 1 + Math.sin(t * 0.7 + node.x * 0.012) * 0.03;

      c.beginPath();
      c.arc(0, 0, r * pulse, 0, Math.PI * 2);
      c.strokeStyle = col;
      c.lineWidth   = 4;
      c.stroke();

      c.beginPath();
      c.arc(0, 0, r * 0.55 * pulse, 0, Math.PI * 2);
      c.strokeStyle = withOpacity(col, 0.25);
      c.lineWidth   = 1.5;
      c.stroke();

      const grow = (base: number) => base * (1 + (1 / camScale - 1) / 5);
      const nameScreen = camScale >= 1 ? 14 : Math.min(19, grow(14));
      const infoScreen = camScale >= 1 ? 10 : Math.min(12, grow(10));
      const nameF = nameScreen / camScale;
      const infoF = infoScreen / camScale;
      const gap   = 8 / camScale;

      const sign = move >= 0 ? "+" : "";
      drawLabel(c, [
        { text: node.name,                              font: `600 ${nameF}px "DM Sans", sans-serif`, alpha: 1,    col },
        { text: `${node.etf}  ${sign}${move.toFixed(1)}%`, font: `300 ${infoF}px "DM Sans", sans-serif`, alpha: 0.73, col },
      ], "bottom", r, gap);
    }

    function drawSubSectorNode(
      c: CanvasRenderingContext2D,
      node: SubSectorNode,
      r: number,
      col: string,
      t: number,
      camScale: number,
      labelAlpha: number,
    ) {
      const pulse = 1 + Math.sin(t * 0.6 + node.x * 0.011) * 0.025;
      c.beginPath();
      c.arc(0, 0, r * pulse, 0, Math.PI * 2);
      c.strokeStyle = withOpacity(col, 0.75);
      c.lineWidth   = 3;
      c.stroke();

      if (labelAlpha === 0) return;

      const grow = (base: number) => base * (1 + (1 / camScale - 1) / 5);
      const nameScreen = camScale >= 1 ? 10 : Math.min(13, grow(10));
      const etfScreen  = camScale >= 1 ?  8 : Math.min(10, grow(8));
      const nameF = nameScreen / camScale;
      const etfF  = etfScreen  / camScale;
      const gap   = 7 / camScale;

      const lines: Array<{ text: string; font: string; alpha: number; col: string }> = [
        { text: node.name, font: `500 ${nameF}px "DM Sans", sans-serif`, alpha: 0.65 * labelAlpha, col },
      ];
      if (node.etf) lines.push({ text: node.etf, font: `300 ${etfF}px "DM Sans", sans-serif`, alpha: 0.45 * labelAlpha, col });
      drawLabel(c, lines, "bottom", r, gap);
    }

    function drawSubSubSectorNode(
      c: CanvasRenderingContext2D,
      node: SubSubSectorNode,
      r: number,
      col: string,
      t: number,
      _camScale: number,
      labelAlpha: number,
    ) {
      const pulse = 1 + Math.sin(t * 0.5 + node.x * 0.013) * 0.02;

      // Subtle dark fill so interior text stays readable over edges/other nodes
      c.beginPath();
      c.arc(0, 0, r * pulse, 0, Math.PI * 2);
      c.fillStyle = "rgba(7,9,15,0.55)";
      c.fill();

      c.beginPath();
      c.arc(0, 0, r * pulse, 0, Math.PI * 2);
      c.strokeStyle = withOpacity(col, 0.55);
      c.lineWidth   = 2;
      c.stroke();

      if (labelAlpha === 0) return;

      // Initial font size — steps down for longer names, capped at 22px
      let fSize = Math.max(13, Math.min(22, Math.floor(r * 3.5 / Math.max(7, node.name.length))));
      c.font    = `500 ${fSize}px "DM Sans", sans-serif`;
      c.textAlign    = "center";
      c.textBaseline = "middle";

      // Wrap to two lines if the name overflows the circle width
      const maxW = r * 1.75;
      let lines: string[];
      if (c.measureText(node.name).width <= maxW) {
        lines = [node.name];
      } else {
        // Find the break point (space or hyphen) closest to the midpoint
        const mid = Math.floor(node.name.length / 2);
        let best = -1, bestDist = Infinity;
        for (let i = 0; i < node.name.length; i++) {
          if (node.name[i] === ' ' || node.name[i] === '-') {
            const d = Math.abs(i - mid);
            if (d < bestDist) { bestDist = d; best = i; }
          }
        }
        if (best === -1) {
          lines = [node.name];
        } else {
          lines = (node.name[best] === '-'
            ? [node.name.slice(0, best + 1), node.name.slice(best + 1)]
            : [node.name.slice(0, best),     node.name.slice(best + 1)]
          ).filter(Boolean);
          // Slightly smaller font when using two lines
          fSize = Math.max(11, Math.floor(fSize * 0.85));
          c.font = `500 ${fSize}px "DM Sans", sans-serif`;
        }
      }

      c.fillStyle = withOpacity(col, 0.85 * labelAlpha);
      const lineGap = 3;
      const totalH  = lines.length * fSize + (lines.length - 1) * lineGap;
      const startY  = -totalH / 2 + fSize / 2;
      for (let i = 0; i < lines.length; i++) {
        c.fillText(lines[i], 0, startY + i * (fSize + lineGap));
      }
    }

    function drawStockNode(
      c: CanvasRenderingContext2D,
      node: StockNode,
      r: number,
      col: string,
      fillCol: string
    ) {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fillStyle = fillCol;
      c.fill();

      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.strokeStyle = col;
      c.lineWidth   = 1.5;
      c.stroke();

      c.fillStyle    = "#f1f5f9";
      c.font         = `500 ${Math.max(9, Math.round(r * 0.62))}px "DM Sans", sans-serif`;
      c.textAlign    = "center";
      c.textBaseline = "middle";
      c.fillText(node.ticker, 0, 0);

    }

    // ── Event handlers ───────────────────────────────────────────────────────

    function setHover(node: GNode | null) {
      if (node) {
        const liveKey = node.kind === "sector" ? node.etf
          : (node.kind === "subsector" || node.kind === "subsubsector") ? (node.etf ?? node.sectorEtf)
          : node.id;
        const live = liveDataRef.current[liveKey];
        // Merge live price/move for stocks and for hierarchy nodes with their own ETF.
        // Hierarchy nodes without an ETF must not inherit the parent sector's price/move.
        const hasPriceData = node.kind === "stock" || node.kind === "sector" ||
          ((node.kind === "subsector" || node.kind === "subsubsector") && !!node.etf);
        const liveNotifs = node.kind === "stock"
          ? (notificationsRef.current[node.ticker] ?? node.notifications)
          : node.kind === "sector"
            ? (notificationsRef.current[node.id] ?? node.notifications)
            : node.notifications;
        const merged: GNode = {
          ...node,
          ...(live && hasPriceData ? { price: live.price, dailyMove: live.dailyMove } : {}),
          notifications: liveNotifs,
        };
        setHoverNode(merged);
        onHoverRef.current?.(merged);
      } else {
        setHoverNode(null);
        onHoverRef.current?.(null);
      }
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mouseDownPosRef.current = { x: mx, y: my };

      if (editModeRef.current) {
        const hit = hitTest(mx, my);
        if (hit && (hit.kind === "stock" || hit.kind === "sector" || hit.kind === "subsector" || hit.kind === "subsubsector")) {
          draggingNodeRef.current = hit;
          canvas.style.cursor = "move";
          return;
        }
      }

      panningRef.current   = true;
      lastMouseRef.current = { x: mx, y: my };
      canvas.style.cursor  = "grabbing";
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;

      if (editModeRef.current && draggingNodeRef.current) {
        const w = toWorld(mx, my);
        draggingNodeRef.current.x = w.x;
        draggingNodeRef.current.y = w.y;
        return;
      }

      if (panningRef.current) {
        cameraRef.current.x += mx - lastMouseRef.current.x;
        cameraRef.current.y += my - lastMouseRef.current.y;
        cameraRef.current    = clampCamera(cameraRef.current);
        lastMouseRef.current = { x: mx, y: my };
        return;
      }

      const hit   = hitTest(mx, my);
      const newId = hit?.id ?? null;
      if (newId !== hoveredIdRef.current) {
        hoveredIdRef.current = newId;
        canvas.style.cursor  = hit
          ? (editModeRef.current ? "move" : "pointer")
          : (editModeRef.current ? "default" : "grab");
        setHover(hit);
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (editModeRef.current && draggingNodeRef.current) {
        const node = draggingNodeRef.current;
        const nodeId = node.kind === "stock" ? node.ticker : node.id;
        onNodeDragEndRef.current?.(nodeId, node.x, node.y);
        draggingNodeRef.current = null;
        canvas.style.cursor = "default";
        return;
      }

      panningRef.current  = false;
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab";
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = mx - mouseDownPosRef.current.x;
      const dy = my - mouseDownPosRef.current.y;
      if (dx * dx + dy * dy < 25) {
        if (editModeRef.current) {
          if (e.shiftKey && !hitTest(mx, my)) onShiftEmptyClickRef.current?.();
          return;
        }

        const hit = hitTest(mx, my);

        // Shift+click: zoom to node or zoom in 2× at cursor — never navigate
        if (e.shiftKey) {
          zoomTo(mx, my, hit);
          return;
        }

        if (hit?.kind === "stock")        routerRef.current.push(`/stock/${hit.ticker}`);
        if (hit?.kind === "sector")       routerRef.current.push(`/sector/${hit.id}`);
        if (hit?.kind === "subsector")    routerRef.current.push(`/subsector/${encodeURIComponent(hit.name)}`);
        if (hit?.kind === "subsubsector") routerRef.current.push(`/subsubsector/${encodeURIComponent(hit.name)}`);
      }
    }

    function onWindowMouseUp() {
      if (editModeRef.current && draggingNodeRef.current) {
        const node = draggingNodeRef.current;
        const nodeId = node.kind === "stock" ? (node as StockNode).ticker : node.id;
        onNodeDragEndRef.current?.(nodeId, node.x, node.y);
        draggingNodeRef.current = null;
      }
      panningRef.current  = false;
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab";
    }

    function onContextMenuEvent(e: MouseEvent) {
      if (!editModeRef.current) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit && hit.kind === "stock") {
        onContextMenuRef.current?.({ type: "node", id: (hit as StockNode).ticker, clientX: e.clientX, clientY: e.clientY });
        return;
      }
      if (hit && hit.kind === "sector") {
        onContextMenuRef.current?.({ type: "sector", id: hit.id, clientX: e.clientX, clientY: e.clientY });
        return;
      }
      const edgeId = hitTestEdge(mx, my);
      if (edgeId) onContextMenuRef.current?.({ type: "edge", id: edgeId, clientX: e.clientX, clientY: e.clientY });
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      targetCameraRef.current = null; // cancel any zoom-to-node animation
      const rect      = canvas.getBoundingClientRect();
      const mx        = e.clientX - rect.left;
      const my        = e.clientY - rect.top;
      const factor    = e.deltaY < 0 ? 1.032 : 0.968;
      const cam       = cameraRef.current;
      const newScale  = Math.max(0.10, Math.min(5, cam.scale * factor));
      const ratio     = newScale / cam.scale;
      cameraRef.current = clampCamera({
        scale: newScale,
        x: mx - (mx - cam.x) * ratio,
        y: my - (my - cam.y) * ratio,
      });
    }

    function onMouseLeave() {
      if (!panningRef.current) {
        hoveredIdRef.current = null;
        setHover(null);
      }
    }

    // ── Zoom helpers ─────────────────────────────────────────────────────────

    function zoomTo(mx: number, my: number, hit: GNode | null) {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      if (hit) {
        // Smooth zoom to the node, centred on screen
        const targetScale =
          hit.kind === "sector"       ? 0.55 :
          hit.kind === "subsector"    ? 0.80 :
          hit.kind === "subsubsector" ? 1.00 : 1.8;
        targetCameraRef.current = {
          scale: targetScale,
          x: W / 2 - hit.x * targetScale,
          y: H / 2 - hit.y * targetScale,
        };
      } else {
        // Zoom in 2× centred on the cursor position
        const cam      = cameraRef.current;
        const newScale = Math.min(5, cam.scale * 2);
        const ratio    = newScale / cam.scale;
        targetCameraRef.current = clampCamera({
          scale: newScale,
          x: mx - (mx - cam.x) * ratio,
          y: my - (my - cam.y) * ratio,
        });
      }
    }

    function onDblClick(e: MouseEvent) {
      // Double-click on empty space zooms in 2× at cursor.
      // (Double-clicking a node is already covered by shift+click.)
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      if (!hitTest(mx, my)) zoomTo(mx, my, null);
    }

    // ── Setup ────────────────────────────────────────────────────────────────

    canvas.addEventListener("mousemove",    onMouseMove);
    canvas.addEventListener("mousedown",    onMouseDown);
    canvas.addEventListener("mouseup",      onMouseUp);
    canvas.addEventListener("dblclick",     onDblClick);
    canvas.addEventListener("wheel",        onWheel, { passive: false });
    canvas.addEventListener("mouseleave",   onMouseLeave);
    canvas.addEventListener("contextmenu",  onContextMenuEvent);
    window.addEventListener("mouseup",      onWindowMouseUp);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove",    onMouseMove);
      canvas.removeEventListener("mousedown",    onMouseDown);
      canvas.removeEventListener("mouseup",      onMouseUp);
      canvas.removeEventListener("dblclick",     onDblClick);
      canvas.removeEventListener("wheel",        onWheel);
      canvas.removeEventListener("mouseleave",   onMouseLeave);
      canvas.removeEventListener("contextmenu",  onContextMenuEvent);
      window.removeEventListener("mouseup",      onWindowMouseUp);
      ro.disconnect();
    };
  }, []);

  void hoverNode;

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
    />
  );
});

export default GraphCanvas;
