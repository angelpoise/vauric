"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type GNode,
  type StockNode,
  type SectorNode,
  type NotifType,
  NOTIF,
  moveColor,
  moveFill,
} from "@/lib/graphTypes";
import { getCachedMarketData, setCachedMarketData } from "@/lib/marketDataCache";
import {
  type ActiveFilters,
  DEFAULT_FILTERS,
  ALL_NOTIF_TYPES,
  ALL_CAP_TIERS,
  ALL_52W_POS,
} from "@/lib/filtersTypes";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onHover?: (node: GNode | null) => void;
  activeFilters?: ActiveFilters;
}

// ─── Static sector nodes (always hardcoded) ───────────────────────────────────

const SECTOR_NODES: SectorNode[] = [
  { id: "sec-tech",    kind: "sector", name: "Technology", etf: "XLK", price: 224.18, dailyMove:  1.2, x:  500, y: 420, notifications: [] },
  { id: "sec-energy",  kind: "sector", name: "Energy",     etf: "XLE", price:  93.42, dailyMove: -0.8, x: 1100, y: 360, notifications: [] },
  { id: "sec-health",  kind: "sector", name: "Healthcare", etf: "XLV", price: 143.76, dailyMove:  0.3, x:  440, y: 750, notifications: [] },
  { id: "sec-finance", kind: "sector", name: "Finance",    etf: "XLF", price:  45.21, dailyMove:  0.7, x: 1155, y: 710, notifications: [] },
];

const SECTOR_MAP: Record<string, string> = {
  Technology: "sec-tech",
  Energy:     "sec-energy",
  Healthcare: "sec-health",
  Finance:    "sec-finance",
  Consumer:   "sec-consumer",
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

const FALLBACK_EXTRA_EDGES: Array<{ source: string; target: string }> = [
  { source: "SMCI", target: "NVDA" },
  { source: "SMCI", target: "ARM"  },
  { source: "NVDA", target: "AMD"  },
  { source: "NVDA", target: "ARM"  },
  { source: "AMD",  target: "ARM"  },
  { source: "PLTR", target: "MSFT" },
  { source: "PLTR", target: "SOFI" },
  { source: "FANG", target: "XOM"  },
  { source: "AFRM", target: "PYPL" },
  { source: "COIN", target: "SOFI" },
  { source: "HOOD", target: "COIN" },
  { source: "SOFI", target: "AFRM" },
  { source: "HIMS", target: "RXRX" },
];

// ─── Graph data assembly ──────────────────────────────────────────────────────

interface Edge { source: string; target: string; }

interface GraphData {
  nodes: GNode[];
  edges: Edge[];
  nodeById: Map<string, GNode>;
  adjacency: Map<string, Set<string>>;
}

function buildGraphData(stockNodes: StockNode[], extraEdges: Edge[]): GraphData {
  const nodes: GNode[] = [...SECTOR_NODES, ...stockNodes];
  const sectorEdges: Edge[] = stockNodes.map((n) => ({ source: n.id, target: n.sectorId }));
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
}

export default function GraphCanvas({ onHover, activeFilters }: Props) {
  const router         = useRouter();
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

  const graphDataRef = useRef<GraphData>(buildGraphData(FALLBACK_STOCK_NODES, FALLBACK_EXTRA_EDGES));

  interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }
  const liveDataRef      = useRef<Record<string, LiveEntry>>({});
  const liveDataReadyRef = useRef(false);
  const fundamentalsRef    = useRef<Record<string, FundEntry>>({});
  const activeFiltersRef   = useRef<ActiveFilters>(DEFAULT_FILTERS);
  const notificationsRef   = useRef<Record<string, Array<{ type: NotifType }>>>({});

  const [hoverNode, setHoverNode] = useState<GNode | null>(null);

  // Keep activeFilters ref in sync with prop (read by draw loop without re-creating the effect)
  useEffect(() => {
    activeFiltersRef.current = activeFilters ?? DEFAULT_FILTERS;
  }, [activeFilters]);

  // Fetch graph structure (stocks + connections) from database.
  // Falls back to hardcoded data if the request fails.
  useEffect(() => {
    fetch("/api/graph")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { stocks: DbStock[]; connections: DbConnection[] } | null) => {
        if (!data || !data.stocks?.length) return;
        const stockNodes: StockNode[] = data.stocks.map((s) => ({
          id:           s.ticker,
          kind:         "stock" as const,
          ticker:       s.ticker,
          name:         s.company_name,
          price:        0,
          dailyMove:    0,
          sectorId:     SECTOR_MAP[s.sector] ?? "sec-tech",
          x:            s.x_position * 1600,
          y:            s.y_position * 1100,
          notifications: [],
        }));
        const extraEdges: Edge[] = (data.connections ?? []).map((c) => ({
          source: c.ticker_a,
          target: c.ticker_b,
        }));
        graphDataRef.current = buildGraphData(stockNodes, extraEdges);
        console.log(`[graph] loaded ${stockNodes.length} stock nodes, ${extraEdges.length} connections`);
      })
      .catch((err) => console.error('[graph] fetch failed:', err));
  }, []);

  // Fetch fundamentals data for filter calculations (market cap, beta, PE, etc.)
  useEffect(() => {
    fetch("/api/fundamentals")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) fundamentalsRef.current = data; })
      .catch(() => {});
  }, []);

  // Fetch recent news to drive live notification dots on graph nodes.
  // Nodes get a dot per distinct notification_type published in the last 24 hours.
  useEffect(() => {
    fetch("/api/news?notifonly=1")
      .then((r) => r.ok ? r.json() : null)
      .then((articles: Array<{ ticker: string; notification_type: string; published_at: string }> | null) => {
        if (!articles) return;
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const map: Record<string, Array<{ type: NotifType }>> = {};
        for (const a of articles) {
          if (new Date(a.published_at).getTime() < cutoff) continue;
          if (!map[a.ticker]) map[a.ticker] = [];
          const t = a.notification_type as NotifType;
          if (!map[a.ticker].some((n) => n.type === t)) {
            map[a.ticker].push({ type: t });
          }
        }
        notificationsRef.current = map;
      })
      .catch(() => {});
  }, []);

  // Populate live data before the draw loop starts so nodes colour correctly on the first frame.
  // The module-level cache persists across navigations; only fetches when empty or stale (>15 min).
  useEffect(() => {
    const cached = getCachedMarketData();
    if (cached) {
      liveDataRef.current      = cached;
      liveDataReadyRef.current = true;
      return;
    }

    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setCachedMarketData(data);
          liveDataRef.current = data;
          console.log("[market-data] AMD entry:", data["AMD"] ?? "not present in API response");
        }
        liveDataReadyRef.current = true;
      })
      .catch(() => { liveDataReadyRef.current = true; });
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
      const seed = node.id.charCodeAt(0) * 3 + (node.id.charCodeAt(1) || 0);
      return {
        x: node.x + Math.sin(t * 0.38 + seed * 0.71) * 4,
        y: node.y + Math.cos(t * 0.32 + seed * 0.53) * 4,
      };
    }

    function toWorld(sx: number, sy: number) {
      const cam = cameraRef.current;
      return {
        x: (sx - cam.x) / cam.scale,
        y: (sy - cam.y) / cam.scale,
      };
    }

    // ── Node radius ──────────────────────────────────────────────────────────

    function nodeRadius(n: GNode): number {
      if (n.kind === "sector") return 44;
      const conns = graphDataRef.current.adjacency.get(n.id)?.size ?? 0;
      return Math.min(28, 12 + conns * 2.2);
    }

    // ── Hit testing ──────────────────────────────────────────────────────────

    function hitTest(mx: number, my: number): GNode | null {
      const w = toWorld(mx, my);
      const t = animTRef.current;
      for (const node of [...graphDataRef.current.nodes].reverse()) {
        const pos = worldPos(node, t);
        const r   = effectiveRadius(node) + 6;
        const dx  = w.x - pos.x;
        const dy  = w.y - pos.y;
        if (dx * dx + dy * dy <= r * r) return node;
      }
      return null;
    }

    // ── Filter helpers ───────────────────────────────────────────────────────

    // Returns true if the node should be faded out by active filters.
    // Sector nodes are never filtered.
    function isNodeFiltered(node: GNode): boolean {
      if (node.kind === "sector") return false;
      const f    = activeFiltersRef.current;
      const live = liveDataRef.current[node.ticker];
      const fund = fundamentalsRef.current[node.ticker] as FundEntry | undefined;

      // Sector membership
      const sid = node.sectorId.replace("sec-", "");
      if (!f.sectors.includes(sid)) return true;

      // Notification presence / type — use live data if available, fall back to node placeholder
      const notifs = notificationsRef.current[(node as StockNode).ticker] ?? node.notifications;
      if (f.onlyWithNotifs && notifs.length === 0) return true;
      if (f.notifTypes.length < ALL_NOTIF_TYPES.length && notifs.length > 0) {
        const hasMatch = notifs.some((n) => (f.notifTypes as string[]).includes(n.type));
        if (!hasMatch) return true;
      }

      // Daily move
      const move = live?.dailyMove ?? 0;
      if (f.dailyMove.min !== null && move < f.dailyMove.min) return true;
      if (f.dailyMove.max !== null && move > f.dailyMove.max) return true;

      // Price
      const price = live?.price ?? 0;
      if (f.price.min !== null && price < f.price.min) return true;
      if (f.price.max !== null && price > f.price.max) return true;

      // Market cap tier (only applied when not all tiers are selected)
      if (f.marketCapTiers.length < ALL_CAP_TIERS.length) {
        const cap = fund?.marketCap ?? null;
        if (cap !== null) {
          const tier = cap >= 200e9 ? "mega" : cap >= 10e9 ? "large" : cap >= 2e9 ? "mid" : "small";
          if (!f.marketCapTiers.includes(tier)) return true;
        }
      }

      // Trailing P/E
      const pe = fund?.trailingPE ?? null;
      if (f.trailingPE.min !== null && (pe === null || pe < f.trailingPE.min)) return true;
      if (f.trailingPE.max !== null && (pe === null || pe > f.trailingPE.max)) return true;

      // Beta
      const beta = fund?.beta ?? null;
      if (f.beta.min !== null && (beta === null || beta < f.beta.min)) return true;
      if (f.beta.max !== null && (beta === null || beta > f.beta.max)) return true;

      // Average volume
      const avgVol = fund?.averageVolume ?? null;
      if (f.avgVolumeMin !== null && (avgVol === null || avgVol < f.avgVolumeMin)) return true;

      // 52-week position
      if (f.fiftyTwoWeekPos.length < ALL_52W_POS.length) {
        const hi = fund?.fiftyTwoWeekHigh ?? null;
        const lo = fund?.fiftyTwoWeekLow  ?? null;
        const p  = live?.price ?? null;
        if (hi !== null && lo !== null && p !== null) {
          const pos52 = p / lo <= 1.10 ? "low" : p / hi >= 0.90 ? "high" : "mid";
          if (!f.fiftyTwoWeekPos.includes(pos52)) return true;
        }
      }

      // Relative volume
      if (f.relVolumeMin !== null) {
        const vol  = fund?.volume ?? null;
        const avgV = fund?.averageVolume ?? null;
        if (vol !== null && avgV !== null && avgV > 0) {
          if (vol / avgV < f.relVolumeMin) return true;
        }
      }

      // Streak
      if (f.streak !== "any") {
        const m = live?.dailyMove ?? 0;
        if (f.streak === "up"   && m <= 0) return true;
        if (f.streak === "down" && m >= 0) return true;
      }

      return false;
    }

    // Node radius respecting the nodeSize filter toggle
    function effectiveRadius(node: GNode): number {
      if (node.kind === "sector") return 44;
      if (activeFiltersRef.current.nodeSize === "marketcap") {
        const cap = fundamentalsRef.current[node.ticker]?.marketCap ?? null;
        if (cap !== null) {
          if (cap >= 200e9) return 28;
          if (cap >= 10e9)  return 22;
          if (cap >= 2e9)   return 16;
          return 11;
        }
      }
      return nodeRadius(node);
    }

    // ── Draw loop ────────────────────────────────────────────────────────────

    function draw() {
      const W   = canvas.clientWidth;
      const H   = canvas.clientHeight;
      const t   = animTRef.current;
      const hid = hoveredIdRef.current;
      const gd  = graphDataRef.current;
      const hovNeighbors = hid ? (gd.adjacency.get(hid) ?? null) : null;
      const cam = cameraRef.current;
      const d   = dpr();

      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // Edges
      for (const edge of gd.edges) {
        const src = gd.nodeById.get(edge.source);
        const tgt = gd.nodeById.get(edge.target);
        if (!src || !tgt) continue;
        const sp  = worldPos(src, t);
        const tp  = worldPos(tgt, t);

        const edgeFiltered = isNodeFiltered(src) || isNodeFiltered(tgt);
        let alpha = edgeFiltered ? 0.018 : 0.11;
        let lineW = edgeFiltered ? 0.4 : 0.8;
        if (!edgeFiltered && hid) {
          const lit = edge.source === hid || edge.target === hid;
          alpha = lit ? 0.55 : 0.018;
          lineW = lit ? 1.6 : 0.5;
        }

        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
        ctx.lineWidth   = lineW;
        ctx.stroke();
      }

      // Nodes
      for (const node of gd.nodes) {
        const pos        = worldPos(node, t);
        const r          = effectiveRadius(node);
        // Sector nodes are keyed in the API response by their ETF ticker, not by node.id
        const liveKey  = node.kind === "sector" ? node.etf : node.id;
        const live     = liveDataRef.current[liveKey];
        // rawMove is forced to 0 (grey) until live data is ready, preventing placeholder colour flashes
        const rawMove  = liveDataReadyRef.current ? (live?.dailyMove ?? node.dailyMove) : 0;
        const col      = moveColor(rawMove);
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

        ctx.save();
        ctx.globalAlpha = globalAlpha;
        ctx.translate(pos.x, pos.y);
        ctx.scale(scale, scale);

        if (node.kind === "sector") {
          drawSectorNode(ctx, node, r, col, t, rawMove);
        } else {
          drawStockNode(ctx, node, r, col, fillCol);
        }

        // Notification dots — use live news data if available, fall back to placeholder
        const liveNotifs = node.kind === "stock"
          ? (notificationsRef.current[node.ticker] ?? node.notifications)
          : node.notifications;
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
        });

        ctx.restore();
      }

      ctx.restore();

      animTRef.current += 0.008;
      raf = requestAnimationFrame(draw);
    }

    // ── Node draw helpers ────────────────────────────────────────────────────

    // Converts "rgb(r,g,b)" → "rgba(r,g,b,alpha)" for canvas colour operations
    function withOpacity(col: string, alpha: number): string {
      return col.startsWith("rgb(")
        ? col.replace("rgb(", "rgba(").replace(")", `, ${alpha})`)
        : col;
    }

    function drawSectorNode(
      c: CanvasRenderingContext2D,
      node: SectorNode,
      r: number,
      col: string,
      t: number,
      move: number
    ) {
      const pulse = 1 + Math.sin(t * 0.7 + node.x * 0.012) * 0.03;

      c.beginPath();
      c.arc(0, 0, r * pulse, 0, Math.PI * 2);
      c.strokeStyle = col;
      c.lineWidth   = 2.5;
      c.stroke();

      c.beginPath();
      c.arc(0, 0, r * 0.55 * pulse, 0, Math.PI * 2);
      c.strokeStyle = withOpacity(col, 0.25);
      c.lineWidth   = 1;
      c.stroke();

      c.fillStyle    = col;
      c.font         = `500 11px "DM Sans", sans-serif`;
      c.textAlign    = "center";
      c.textBaseline = "top";
      c.fillText(node.name, 0, r + 10);

      const sign = move >= 0 ? "+" : "";
      c.fillStyle = withOpacity(col, 0.73);
      c.font      = `300 9px "DM Sans", sans-serif`;
      c.fillText(`${node.etf}  ${sign}${move.toFixed(1)}%`, 0, r + 23);
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

      c.fillStyle    = "rgba(241,245,249,0.45)";
      c.font         = `300 9px "DM Sans", sans-serif`;
      c.textBaseline = "top";
      c.fillText(node.ticker, 0, r + 5);
    }

    // ── Event handlers ───────────────────────────────────────────────────────

    function setHover(node: GNode | null) {
      if (node) {
        const liveKey   = node.kind === "sector" ? node.etf : node.id;
        const live      = liveDataRef.current[liveKey];
        const liveNotifs = node.kind === "stock"
          ? (notificationsRef.current[node.ticker] ?? node.notifications)
          : node.notifications;
        const merged: GNode = {
          ...node,
          ...(live ? { price: live.price, dailyMove: live.dailyMove } : {}),
          notifications: liveNotifs,
        };
        setHoverNode(merged);
        onHoverRef.current?.(merged);
      } else {
        setHoverNode(null);
        onHoverRef.current?.(null);
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;

      if (panningRef.current) {
        cameraRef.current.x += mx - lastMouseRef.current.x;
        cameraRef.current.y += my - lastMouseRef.current.y;
        lastMouseRef.current = { x: mx, y: my };
        return;
      }

      const hit   = hitTest(mx, my);
      const newId = hit?.id ?? null;
      if (newId !== hoveredIdRef.current) {
        hoveredIdRef.current  = newId;
        canvas.style.cursor   = hit ? "pointer" : "grab";
        setHover(hit);
      }
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      panningRef.current    = true;
      lastMouseRef.current  = { x: mx, y: my };
      mouseDownPosRef.current = { x: mx, y: my };
      canvas.style.cursor   = "grabbing";
    }

    function onMouseUp(e: MouseEvent) {
      panningRef.current  = false;
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab";
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dx = mx - mouseDownPosRef.current.x;
      const dy = my - mouseDownPosRef.current.y;
      if (dx * dx + dy * dy < 25) {
        const hit = hitTest(mx, my);
        if (hit?.kind === "stock")  routerRef.current.push(`/stock/${hit.ticker}`);
        if (hit?.kind === "sector") routerRef.current.push(`/sector/${hit.id.replace("sec-", "")}`);
      }
    }

    function onWindowMouseUp() {
      panningRef.current  = false;
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab";
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect      = canvas.getBoundingClientRect();
      const mx        = e.clientX - rect.left;
      const my        = e.clientY - rect.top;
      const factor    = e.deltaY < 0 ? 1.032 : 0.968;
      const cam       = cameraRef.current;
      const newScale  = Math.max(0.15, Math.min(5, cam.scale * factor));
      const ratio     = newScale / cam.scale;
      cameraRef.current = {
        scale: newScale,
        x: mx - (mx - cam.x) * ratio,
        y: my - (my - cam.y) * ratio,
      };
    }

    function onMouseLeave() {
      if (!panningRef.current) {
        hoveredIdRef.current = null;
        setHover(null);
      }
    }

    // ── Setup ────────────────────────────────────────────────────────────────

    canvas.addEventListener("mousemove",  onMouseMove);
    canvas.addEventListener("mousedown",  onMouseDown);
    canvas.addEventListener("mouseup",    onMouseUp);
    canvas.addEventListener("wheel",      onWheel, { passive: false });
    canvas.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mouseup",    onWindowMouseUp);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove",  onMouseMove);
      canvas.removeEventListener("mousedown",  onMouseDown);
      canvas.removeEventListener("mouseup",    onMouseUp);
      canvas.removeEventListener("wheel",      onWheel);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mouseup",    onWindowMouseUp);
      ro.disconnect();
    };
  }, []);

  // Keep local hoverNode in sync for the draw loop adjacency highlight
  void hoverNode;

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
    />
  );
}
