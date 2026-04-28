"use client";

import { useEffect, useRef, useState } from "react";
import {
  type GNode,
  type StockNode,
  type SectorNode,
  NOTIF,
  moveColor,
} from "@/lib/graphTypes";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onHover?: (node: GNode | null) => void;
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

const NODES: GNode[] = [
  // Sectors
  { id: "sec-tech",    kind: "sector", name: "Technology", etf: "XLK", price: 224.18, dailyMove:  1.2, x:  500, y: 420, notifications: [] },
  { id: "sec-energy",  kind: "sector", name: "Energy",     etf: "XLE", price:  93.42, dailyMove: -0.8, x: 1100, y: 360, notifications: [] },
  { id: "sec-health",  kind: "sector", name: "Healthcare", etf: "XLV", price: 143.76, dailyMove:  0.3, x:  440, y: 750, notifications: [] },
  { id: "sec-finance", kind: "sector", name: "Finance",    etf: "XLF", price:  45.21, dailyMove:  0.7, x: 1155, y: 710, notifications: [] },

  // Technology
  { id: "NVDA", kind: "stock", ticker: "NVDA", name: "NVIDIA",             price:  875.40, dailyMove:  5.2, sectorId: "sec-tech",    x:  305, y: 245, notifications: [{ type: "earnings" }] },
  { id: "MSFT", kind: "stock", ticker: "MSFT", name: "Microsoft",          price:  415.26, dailyMove:  0.9, sectorId: "sec-tech",    x:  475, y: 200, notifications: [] },
  { id: "PLTR", kind: "stock", ticker: "PLTR", name: "Palantir",           price:   24.38, dailyMove:  3.1, sectorId: "sec-tech",    x:  635, y: 260, notifications: [{ type: "news" }] },
  { id: "AMD",  kind: "stock", ticker: "AMD",  name: "AMD",                price:  172.84, dailyMove:  2.4, sectorId: "sec-tech",    x:  360, y: 510, notifications: [] },
  { id: "ARM",  kind: "stock", ticker: "ARM",  name: "Arm Holdings",       price:  118.62, dailyMove:  4.8, sectorId: "sec-tech",    x:  645, y: 495, notifications: [{ type: "earnings" }] },

  // Energy
  { id: "XOM",  kind: "stock", ticker: "XOM",  name: "ExxonMobil",         price:  118.24, dailyMove: -1.2, sectorId: "sec-energy",  x:  920, y: 258, notifications: [{ type: "analyst" }] },
  { id: "CVX",  kind: "stock", ticker: "CVX",  name: "Chevron",            price:  158.90, dailyMove: -0.9, sectorId: "sec-energy",  x: 1082, y: 200, notifications: [] },
  { id: "FANG", kind: "stock", ticker: "FANG", name: "Diamondback Energy", price:  194.52, dailyMove:  2.1, sectorId: "sec-energy",  x: 1275, y: 278, notifications: [] },
  { id: "SLB",  kind: "stock", ticker: "SLB",  name: "SLB",                price:   44.18, dailyMove: -1.8, sectorId: "sec-energy",  x: 1215, y: 178, notifications: [{ type: "squeeze" }] },

  // Healthcare
  { id: "HIMS", kind: "stock", ticker: "HIMS", name: "Hims & Hers",        price:   21.44, dailyMove: 12.3, sectorId: "sec-health",  x:  258, y: 710, notifications: [{ type: "news" }, { type: "analyst" }] },
  { id: "RXRX", kind: "stock", ticker: "RXRX", name: "Recursion Pharma",   price:    5.82, dailyMove:  4.1, sectorId: "sec-health",  x:  308, y: 858, notifications: [{ type: "analyst" }] },
  { id: "LLY",  kind: "stock", ticker: "LLY",  name: "Eli Lilly",          price:  803.28, dailyMove: -0.6, sectorId: "sec-health",  x:  592, y: 832, notifications: [] },
  { id: "MRNA", kind: "stock", ticker: "MRNA", name: "Moderna",            price:   75.60, dailyMove: -2.3, sectorId: "sec-health",  x:  502, y: 682, notifications: [] },

  // Finance
  { id: "SOFI", kind: "stock", ticker: "SOFI", name: "SoFi Technologies",  price:    8.42, dailyMove:  4.2, sectorId: "sec-finance", x:  978, y: 682, notifications: [{ type: "news" }] },
  { id: "AFRM", kind: "stock", ticker: "AFRM", name: "Affirm",             price:   35.18, dailyMove:  3.8, sectorId: "sec-finance", x: 1312, y: 622, notifications: [] },
  { id: "PYPL", kind: "stock", ticker: "PYPL", name: "PayPal",             price:   63.44, dailyMove: -0.8, sectorId: "sec-finance", x: 1362, y: 782, notifications: [] },
  { id: "COIN", kind: "stock", ticker: "COIN", name: "Coinbase",           price:  215.80, dailyMove:  6.1, sectorId: "sec-finance", x: 1082, y: 828, notifications: [{ type: "split" }] },
  { id: "HOOD", kind: "stock", ticker: "HOOD", name: "Robinhood",          price:   22.36, dailyMove:  5.4, sectorId: "sec-finance", x: 1228, y: 868, notifications: [] },
];

const STOCK_NODES = NODES.filter((n): n is StockNode => n.kind === "stock");

interface Edge { source: string; target: string; }

const EDGES: Edge[] = [
  ...STOCK_NODES.map((n) => ({ source: n.id, target: n.sectorId })),
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

// ─── Precomputed lookups ──────────────────────────────────────────────────────

const nodeById = new Map<string, GNode>(NODES.map((n) => [n.id, n]));

const adjacency = new Map<string, Set<string>>();
NODES.forEach((n) => adjacency.set(n.id, new Set()));
EDGES.forEach((e) => {
  adjacency.get(e.source)!.add(e.target);
  adjacency.get(e.target)!.add(e.source);
});

function nodeRadius(n: GNode): number {
  if (n.kind === "sector") return 44;
  const conns = adjacency.get(n.id)?.size ?? 0;
  return Math.min(28, 12 + conns * 2.2);
}

// ─── Camera ───────────────────────────────────────────────────────────────────

interface Camera { x: number; y: number; scale: number; }

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphCanvas({ onHover }: Props) {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const cameraRef      = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const hoveredIdRef   = useRef<string | null>(null);
  const animTRef       = useRef(0);
  const panningRef     = useRef(false);
  const lastMouseRef   = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);
  const onHoverRef     = useRef(onHover);
  onHoverRef.current   = onHover;

  interface LiveEntry { price: number; dailyMove: number; dailyMoveDollar: number; }
  const liveDataRef = useRef<Record<string, LiveEntry>>({});

  const [hoverNode, setHoverNode] = useState<GNode | null>(null);

  // Fetch real market data; silently falls back to placeholder on failure
  useEffect(() => {
    fetch("/api/market-data")
      .then((r) => { if (r.ok) return r.json(); })
      .then((data) => { if (data) liveDataRef.current = data; })
      .catch(() => {});
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

    // ── Hit testing ──────────────────────────────────────────────────────────

    function hitTest(mx: number, my: number): GNode | null {
      const w = toWorld(mx, my);
      const t = animTRef.current;
      for (const node of [...NODES].reverse()) {
        const pos = worldPos(node, t);
        const r   = nodeRadius(node) + 6;
        const dx  = w.x - pos.x;
        const dy  = w.y - pos.y;
        if (dx * dx + dy * dy <= r * r) return node;
      }
      return null;
    }

    // ── Draw loop ────────────────────────────────────────────────────────────

    function draw() {
      const W   = canvas.clientWidth;
      const H   = canvas.clientHeight;
      const t   = animTRef.current;
      const hid = hoveredIdRef.current;
      const hovNeighbors = hid ? adjacency.get(hid)! : null;
      const cam = cameraRef.current;
      const d   = dpr();

      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // Edges
      for (const edge of EDGES) {
        const src = nodeById.get(edge.source)!;
        const tgt = nodeById.get(edge.target)!;
        const sp  = worldPos(src, t);
        const tp  = worldPos(tgt, t);

        let alpha = 0.11;
        let lineW = 0.8;
        if (hid) {
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
      for (const node of NODES) {
        const pos        = worldPos(node, t);
        const r          = nodeRadius(node);
        const live       = liveDataRef.current[node.id];
        const col        = moveColor(live?.dailyMove ?? node.dailyMove);
        const isHovered  = node.id === hid;
        const isNeighbor = hovNeighbors?.has(node.id) ?? false;

        let globalAlpha = 1;
        let scale       = 1;
        if (hid) {
          if (isHovered)      scale       = 1.18;
          else if (!isNeighbor) globalAlpha = 0.07;
        }

        ctx.save();
        ctx.globalAlpha = globalAlpha;
        ctx.translate(pos.x, pos.y);
        ctx.scale(scale, scale);

        if (node.kind === "sector") {
          drawSectorNode(ctx, node, r, col, t);
        } else {
          drawStockNode(ctx, node, r, col);
        }

        // Notification dots
        node.notifications.forEach((notif, i) => {
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

    function drawSectorNode(
      c: CanvasRenderingContext2D,
      node: SectorNode,
      r: number,
      col: string,
      t: number
    ) {
      const pulse = 1 + Math.sin(t * 0.7 + node.x * 0.012) * 0.03;

      c.beginPath();
      c.arc(0, 0, r * pulse, 0, Math.PI * 2);
      c.strokeStyle = col;
      c.lineWidth   = 2.5;
      c.stroke();

      c.beginPath();
      c.arc(0, 0, r * 0.55 * pulse, 0, Math.PI * 2);
      c.strokeStyle = col + "40";
      c.lineWidth   = 1;
      c.stroke();

      c.fillStyle    = col;
      c.font         = `500 11px "DM Sans", sans-serif`;
      c.textAlign    = "center";
      c.textBaseline = "top";
      c.fillText(node.name, 0, r + 10);

      const sign = node.dailyMove >= 0 ? "+" : "";
      c.fillStyle = col + "bb";
      c.font      = `300 9px "DM Sans", sans-serif`;
      c.fillText(`${node.etf}  ${sign}${node.dailyMove.toFixed(1)}%`, 0, r + 23);
    }

    function drawStockNode(
      c: CanvasRenderingContext2D,
      node: StockNode,
      r: number,
      col: string
    ) {
      const bgAlpha = 0.14;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fillStyle =
        col === "#22c55e"
          ? `rgba(34,197,94,${bgAlpha})`
          : col === "#ef4444"
          ? `rgba(239,68,68,${bgAlpha})`
          : `rgba(100,116,139,${bgAlpha})`;
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
        const live = liveDataRef.current[node.id];
        const merged: GNode = live
          ? { ...node, price: live.price, dailyMove: live.dailyMove }
          : node;
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
      panningRef.current   = true;
      lastMouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      canvas.style.cursor  = "grabbing";
    }

    function onMouseUp() {
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
    window.addEventListener("mouseup",    onMouseUp);

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
      window.removeEventListener("mouseup",    onMouseUp);
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
