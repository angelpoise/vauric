"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType =
  | "news"
  | "analyst"
  | "squeeze"
  | "delisting"
  | "split"
  | "earnings"
  | "ipo";

interface Notif {
  type: NotifType;
}

interface BaseNode {
  id: string;
  x: number;
  y: number;
  notifications: Notif[];
}

interface StockNode extends BaseNode {
  kind: "stock";
  ticker: string;
  name: string;
  dailyMove: number;
  sectorId: string;
}

interface SectorNode extends BaseNode {
  kind: "sector";
  name: string;
  etf: string;
  dailyMove: number;
}

type GNode = StockNode | SectorNode;
interface Edge {
  source: string;
  target: string;
}
interface Camera {
  x: number;
  y: number;
  scale: number;
}

// ─── Notification config ──────────────────────────────────────────────────────

const NOTIF: Record<NotifType, { color: string; label: string }> = {
  news:      { color: "#facc15", label: "News" },
  analyst:   { color: "#f97316", label: "Analyst action" },
  squeeze:   { color: "#ef4444", label: "Short squeeze" },
  delisting: { color: "#a855f7", label: "Delisting / Acquisition" },
  split:     { color: "#3b82f6", label: "Split / Offering" },
  earnings:  { color: "#ffffff", label: "Earnings" },
  ipo:       { color: "#22c55e", label: "IPO" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function moveColor(m: number) {
  return m > 0.5 ? "#22c55e" : m < -0.5 ? "#ef4444" : "#64748b";
}

function moveBg(m: number) {
  return m > 0.5
    ? "rgba(34,197,94,0.12)"
    : m < -0.5
    ? "rgba(239,68,68,0.12)"
    : "rgba(100,116,139,0.12)";
}

// ─── Placeholder data ─────────────────────────────────────────────────────────

const NODES: GNode[] = [
  // Sectors
  { id: "sec-tech",    kind: "sector", name: "Technology", etf: "XLK", dailyMove:  1.2, x:  500, y: 420, notifications: [] },
  { id: "sec-energy",  kind: "sector", name: "Energy",     etf: "XLE", dailyMove: -0.8, x: 1100, y: 360, notifications: [] },
  { id: "sec-health",  kind: "sector", name: "Healthcare", etf: "XLV", dailyMove:  0.3, x:  440, y: 750, notifications: [] },
  { id: "sec-finance", kind: "sector", name: "Finance",    etf: "XLF", dailyMove:  0.7, x: 1155, y: 710, notifications: [] },

  // Technology
  { id: "NVDA", kind: "stock", ticker: "NVDA", name: "NVIDIA",             dailyMove:  5.2, sectorId: "sec-tech",    x:  305, y: 245, notifications: [{ type: "earnings" }] },
  { id: "MSFT", kind: "stock", ticker: "MSFT", name: "Microsoft",          dailyMove:  0.9, sectorId: "sec-tech",    x:  475, y: 200, notifications: [] },
  { id: "PLTR", kind: "stock", ticker: "PLTR", name: "Palantir",           dailyMove:  3.1, sectorId: "sec-tech",    x:  635, y: 260, notifications: [{ type: "news" }] },
  { id: "AMD",  kind: "stock", ticker: "AMD",  name: "AMD",                dailyMove:  2.4, sectorId: "sec-tech",    x:  360, y: 510, notifications: [] },
  { id: "ARM",  kind: "stock", ticker: "ARM",  name: "Arm Holdings",       dailyMove:  4.8, sectorId: "sec-tech",    x:  645, y: 495, notifications: [{ type: "earnings" }] },

  // Energy
  { id: "XOM",  kind: "stock", ticker: "XOM",  name: "ExxonMobil",         dailyMove: -1.2, sectorId: "sec-energy",  x:  920, y: 258, notifications: [{ type: "analyst" }] },
  { id: "CVX",  kind: "stock", ticker: "CVX",  name: "Chevron",            dailyMove: -0.9, sectorId: "sec-energy",  x: 1082, y: 200, notifications: [] },
  { id: "FANG", kind: "stock", ticker: "FANG", name: "Diamondback Energy", dailyMove:  2.1, sectorId: "sec-energy",  x: 1275, y: 278, notifications: [] },
  { id: "SLB",  kind: "stock", ticker: "SLB",  name: "SLB",                dailyMove: -1.8, sectorId: "sec-energy",  x: 1215, y: 178, notifications: [{ type: "squeeze" }] },

  // Healthcare
  { id: "HIMS", kind: "stock", ticker: "HIMS", name: "Hims & Hers",        dailyMove: 12.3, sectorId: "sec-health",  x:  258, y: 710, notifications: [{ type: "news" }, { type: "analyst" }] },
  { id: "RXRX", kind: "stock", ticker: "RXRX", name: "Recursion Pharma",   dailyMove:  4.1, sectorId: "sec-health",  x:  308, y: 858, notifications: [{ type: "analyst" }] },
  { id: "LLY",  kind: "stock", ticker: "LLY",  name: "Eli Lilly",          dailyMove: -0.6, sectorId: "sec-health",  x:  592, y: 832, notifications: [] },
  { id: "MRNA", kind: "stock", ticker: "MRNA", name: "Moderna",            dailyMove: -2.3, sectorId: "sec-health",  x:  502, y: 682, notifications: [] },

  // Finance
  { id: "SOFI", kind: "stock", ticker: "SOFI", name: "SoFi Technologies",  dailyMove:  4.2, sectorId: "sec-finance", x:  978, y: 682, notifications: [{ type: "news" }] },
  { id: "AFRM", kind: "stock", ticker: "AFRM", name: "Affirm",             dailyMove:  3.8, sectorId: "sec-finance", x: 1312, y: 622, notifications: [] },
  { id: "PYPL", kind: "stock", ticker: "PYPL", name: "PayPal",             dailyMove: -0.8, sectorId: "sec-finance", x: 1362, y: 782, notifications: [] },
  { id: "COIN", kind: "stock", ticker: "COIN", name: "Coinbase",           dailyMove:  6.1, sectorId: "sec-finance", x: 1082, y: 828, notifications: [{ type: "split" }] },
  { id: "HOOD", kind: "stock", ticker: "HOOD", name: "Robinhood",          dailyMove:  5.4, sectorId: "sec-finance", x: 1228, y: 868, notifications: [] },
];

const STOCK_NODES = NODES.filter((n): n is StockNode => n.kind === "stock");

const EDGES: Edge[] = [
  // Each stock → its sector
  ...STOCK_NODES.map((n) => ({ source: n.id, target: n.sectorId })),
  // Cross-sector and intra-sector links
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

// ─── Precomputed lookups (module-level, computed once) ────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const hoveredIdRef = useRef<string | null>(null);
  const animTRef = useRef(0);
  const panningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);

  const [hoverNode, setHoverNode] = useState<GNode | null>(null);

  useEffect(() => {
    const canvas: HTMLCanvasElement = canvasRef.current!;
    const ctx: CanvasRenderingContext2D = canvas.getContext("2d")!;
    const dpr = () => window.devicePixelRatio || 1;
    let raf = 0;

    // ── Sizing ──────────────────────────────────────────────────────────────

    function resize() {
      canvas.width = canvas.clientWidth * dpr();
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
      // Reverse so topmost-drawn nodes win
      for (const node of [...NODES].reverse()) {
        const pos = worldPos(node, t);
        const r = nodeRadius(node) + 6;
        const dx = w.x - pos.x;
        const dy = w.y - pos.y;
        if (dx * dx + dy * dy <= r * r) return node;
      }
      return null;
    }

    // ── Draw loop ────────────────────────────────────────────────────────────

    function draw() {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const t = animTRef.current;
      const hid = hoveredIdRef.current;
      const hovNeighbors = hid ? adjacency.get(hid)! : null;
      const cam = cameraRef.current;
      const d = dpr();

      // Reset transform to device pixels, clear
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = "#07090f";
      ctx.fillRect(0, 0, W, H);

      // Apply camera (working in CSS/logical pixels)
      ctx.save();
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.scale, cam.scale);

      // ── Edges ──────────────────────────────────────────────────────────

      for (const edge of EDGES) {
        const src = nodeById.get(edge.source)!;
        const tgt = nodeById.get(edge.target)!;
        const sp = worldPos(src, t);
        const tp = worldPos(tgt, t);

        let alpha = 0.11;
        let lineW = 0.8;

        if (hid) {
          const isHighlighted =
            edge.source === hid || edge.target === hid;
          alpha = isHighlighted ? 0.55 : 0.018;
          lineW = isHighlighted ? 1.6 : 0.5;
        }

        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(tp.x, tp.y);
        ctx.strokeStyle = `rgba(148,163,184,${alpha})`;
        ctx.lineWidth = lineW;
        ctx.stroke();
      }

      // ── Nodes ──────────────────────────────────────────────────────────

      for (const node of NODES) {
        const pos = worldPos(node, t);
        const r = nodeRadius(node);
        const col = moveColor(node.dailyMove);
        const isHovered = node.id === hid;
        const isNeighbor = hovNeighbors?.has(node.id) ?? false;

        let globalAlpha = 1;
        let scale = 1;

        if (hid) {
          if (isHovered) {
            scale = 1.18;
          } else if (!isNeighbor) {
            globalAlpha = 0.07;
          }
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

        // Notification dots (stack vertically at top-right)
        node.notifications.forEach((notif, i) => {
          const dotR = 5.6;
          const dotX = r * 0.7;
          const dotY = -r * 0.7 - i * 10;
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = NOTIF[notif.type].color;
          ctx.fill();
          // White ring so dot reads on any background
          ctx.beginPath();
          ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(7,9,15,0.6)";
          ctx.lineWidth = 1;
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
      ctx: CanvasRenderingContext2D,
      node: SectorNode,
      r: number,
      col: string,
      t: number
    ) {
      const pulse = 1 + Math.sin(t * 0.7 + node.x * 0.012) * 0.03;

      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner ring (faint)
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = col + "40";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sector name below ring
      ctx.fillStyle = col;
      ctx.font = `500 11px "DM Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.name, 0, r + 10);

      // ETF + move
      const sign = node.dailyMove >= 0 ? "+" : "";
      ctx.fillStyle = col + "bb";
      ctx.font = `300 9px "DM Sans", sans-serif`;
      ctx.fillText(
        `${node.etf}  ${sign}${node.dailyMove.toFixed(1)}%`,
        0,
        r + 23
      );
    }

    function drawStockNode(
      ctx: CanvasRenderingContext2D,
      node: StockNode,
      r: number,
      col: string
    ) {
      // Background fill
      const bgAlpha = 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle =
        col === "#22c55e"
          ? `rgba(34,197,94,${bgAlpha})`
          : col === "#ef4444"
          ? `rgba(239,68,68,${bgAlpha})`
          : `rgba(100,116,139,${bgAlpha})`;
      ctx.fill();

      // Border ring
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ticker inside
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `500 ${Math.max(9, Math.round(r * 0.62))}px "DM Sans", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.ticker, 0, 0);

      // Ticker label below node (faint, for readability at small scale)
      ctx.fillStyle = "rgba(241,245,249,0.45)";
      ctx.font = `300 9px "DM Sans", sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(node.ticker, 0, r + 5);
    }

    // ── Event handlers ───────────────────────────────────────────────────────

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (panningRef.current) {
        cameraRef.current.x += mx - lastMouseRef.current.x;
        cameraRef.current.y += my - lastMouseRef.current.y;
        lastMouseRef.current = { x: mx, y: my };
        return;
      }

      const hit = hitTest(mx, my);
      const newId = hit?.id ?? null;
      if (newId !== hoveredIdRef.current) {
        hoveredIdRef.current = newId;
        setHoverNode(hit);
        canvas.style.cursor = hit ? "pointer" : "grab";
      }
    }

    function onMouseDown(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      panningRef.current = true;
      lastMouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      canvas.style.cursor = "grabbing";
    }

    function onMouseUp() {
      panningRef.current = false;
      canvas.style.cursor = hoveredIdRef.current ? "pointer" : "grab";
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.032 : 0.968;
      const cam = cameraRef.current;
      const newScale = Math.max(0.15, Math.min(5, cam.scale * factor));
      const ratio = newScale / cam.scale;
      cameraRef.current = {
        scale: newScale,
        x: mx - (mx - cam.x) * ratio,
        y: my - (my - cam.y) * ratio,
      };
    }

    function onMouseLeave() {
      if (!panningRef.current) {
        hoveredIdRef.current = null;
        setHoverNode(null);
      }
    }

    // ── Setup ────────────────────────────────────────────────────────────────

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mouseup", onMouseUp);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mouseup", onMouseUp);
      ro.disconnect();
    };
  }, []);

  // ── Hover bar ─────────────────────────────────────────────────────────────

  const connCount = hoverNode ? (adjacency.get(hoverNode.id)?.size ?? 0) : 0;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: "grab" }}
      />

      {hoverNode && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(7,9,15,0.88)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            gap: 28,
            fontFamily: '"DM Sans", var(--font-dm-sans), sans-serif',
            pointerEvents: "none",
          }}
        >
          {/* Identity */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "#f1f5f9",
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
            >
              {hoverNode.kind === "stock" ? hoverNode.ticker : hoverNode.name}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 300, marginTop: 2 }}>
              {hoverNode.kind === "stock"
                ? hoverNode.name
                : `Sector ETF: ${hoverNode.etf}`}
            </div>
          </div>

          {/* Daily move badge */}
          <div
            style={{
              background: moveBg(hoverNode.dailyMove),
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 14,
              fontWeight: 500,
              color: moveColor(hoverNode.dailyMove),
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {hoverNode.dailyMove >= 0 ? "+" : ""}
            {hoverNode.dailyMove.toFixed(2)}%
          </div>

          {/* Connection count */}
          <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>
            {connCount} connection{connCount !== 1 ? "s" : ""}
          </div>

          {/* Notifications */}
          {hoverNode.notifications.length > 0 && (
            <>
              <div
                style={{
                  width: 1,
                  height: 24,
                  background: "rgba(255,255,255,0.08)",
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {hoverNode.notifications.map((n, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: NOTIF[n.type].color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        fontWeight: 300,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {NOTIF[n.type].label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Hint */}
          <div
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "#334155",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            scroll to zoom · drag to pan
          </div>
        </div>
      )}
    </div>
  );
}
