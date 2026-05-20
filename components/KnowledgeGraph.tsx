"use client";
import { useEffect, useRef } from "react";

interface Sector {
  label: string;
  etf:   string;
  pct:   number;
  nx:    number; // normalized 0-1
  ny:    number;
  n:     number; // number of sub-nodes
  subN:  number[]; // sub-sub-node count per sub-node
}

const SECTORS: Sector[] = [
  { label: "Industrials",            etf: "XLI",  pct: -1.2, nx: 0.19, ny: 0.37, n: 8, subN: [2,3,1,2,2,1,2,3] },
  { label: "Materials",              etf: "XLB",  pct: -2.4, nx: 0.37, ny: 0.30, n: 6, subN: [2,2,3,1,2,2]     },
  { label: "Energy",                 etf: "XLE",  pct: +1.2, nx: 0.47, ny: 0.23, n: 7, subN: [3,2,1,2,2,1,3]   },
  { label: "Utilities",              etf: "XLU",  pct: +0.9, nx: 0.57, ny: 0.26, n: 6, subN: [2,1,2,2,1,2]     },
  { label: "Real Estate",            etf: "XLRE", pct: +0.4, nx: 0.69, ny: 0.34, n: 7, subN: [2,2,3,1,2,2,2]   },
  { label: "Communication Services", etf: "XLC",  pct: -1.0, nx: 0.82, ny: 0.40, n: 8, subN: [2,3,2,1,2,1,2,2] },
  { label: "Consumer Discretionary", etf: "XLY",  pct: -1.1, nx: 0.23, ny: 0.55, n: 9, subN: [2,3,2,2,1,2,3,1,2] },
  { label: "Consumer Staples",       etf: "XLP",  pct: +0.2, nx: 0.39, ny: 0.62, n: 7, subN: [2,2,1,2,3,2,1]   },
  { label: "Healthcare",             etf: "XLV",  pct: +1.1, nx: 0.54, ny: 0.69, n: 8, subN: [3,2,1,2,2,3,2,1] },
  { label: "Information Technology", etf: "XLK",  pct: -0.6, nx: 0.79, ny: 0.57, n: 9, subN: [2,3,2,2,1,3,2,2,1] },
  { label: "Financials",             etf: "XLF",  pct: -1.2, nx: 0.68, ny: 0.75, n: 8, subN: [2,2,3,1,2,2,3,2] },
];

interface SubNode { dx: number; dy: number; subsubs: { dx: number; dy: number }[] }

// Pre-compute layout in logical pixels (before DPR) — stable each render
const LAYOUT: SubNode[][] = SECTORS.map((sec, si) => {
  return Array.from({ length: sec.n }, (_, i) => {
    const angle = (i / sec.n) * Math.PI * 2 + si * 0.97;
    const dist  = 72 + ((i * 7 + si * 3) % 20);
    const dx    = Math.cos(angle) * dist;
    const dy    = Math.sin(angle) * dist;
    const count = sec.subN[i] ?? 0;
    const subsubs = Array.from({ length: count }, (_, j) => {
      const sa = angle + ((j / Math.max(count, 1)) - 0.5) * 1.1;
      const sd = 36 + (j * 5 % 10);
      return { dx: Math.cos(sa) * sd, dy: Math.sin(sa) * sd };
    });
    return { dx, dy, subsubs };
  });
});

const CANVAS_H = 520;

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, t = 0, raf = 0;
    const dpr = () => window.devicePixelRatio || 1;

    function resize() {
      const d = dpr();
      const rect = canvas!.parentElement!.getBoundingClientRect();
      W = canvas!.width  = rect.width * d;
      H = canvas!.height = CANVAS_H * d;
      canvas!.style.width  = rect.width + "px";
      canvas!.style.height = CANVAS_H + "px";
    }

    function hubPos(sec: Sector, d: number) {
      return {
        x: sec.nx * W + Math.sin(t * 0.35 + SECTORS.indexOf(sec) * 1.3) * 2.5 * d,
        y: sec.ny * H + Math.cos(t * 0.28 + SECTORS.indexOf(sec) * 1.7) * 2.5 * d,
      };
    }

    function draw() {
      const d = dpr();
      ctx!.clearRect(0, 0, W, H);
      t += 0.007;

      const hubR    = 13 * d;
      const subR    =  6 * d;
      const subsubR =  3.5 * d;

      SECTORS.forEach((sec, si) => {
        const { x: hx, y: hy } = hubPos(sec, d);
        const color = sec.pct >= 0 ? "#22c55e" : "#ef4444";
        const subs  = LAYOUT[si];

        // hub → sub lines
        subs.forEach((sub) => {
          const sx = hx + sub.dx * d, sy = hy + sub.dy * d;
          ctx!.beginPath();
          ctx!.moveTo(hx, hy);
          ctx!.lineTo(sx, sy);
          ctx!.strokeStyle = "rgba(255,255,255,0.09)";
          ctx!.lineWidth   = 0.7 * d;
          ctx!.stroke();

          // sub → subsub lines
          sub.subsubs.forEach((ss) => {
            const ssx = sx + ss.dx * d, ssy = sy + ss.dy * d;
            ctx!.beginPath();
            ctx!.moveTo(sx, sy);
            ctx!.lineTo(ssx, ssy);
            ctx!.strokeStyle = "rgba(255,255,255,0.06)";
            ctx!.lineWidth   = 0.5 * d;
            ctx!.stroke();
          });
        });

        // sub-sub circles
        subs.forEach((sub) => {
          const sx = hx + sub.dx * d, sy = hy + sub.dy * d;
          sub.subsubs.forEach((ss) => {
            const ssx = sx + ss.dx * d, ssy = sy + ss.dy * d;
            ctx!.beginPath();
            ctx!.arc(ssx, ssy, subsubR, 0, Math.PI * 2);
            ctx!.strokeStyle = "rgba(255,255,255,0.18)";
            ctx!.lineWidth   = 0.6 * d;
            ctx!.stroke();
          });
        });

        // sub circles
        subs.forEach((sub) => {
          const sx = hx + sub.dx * d, sy = hy + sub.dy * d;
          ctx!.beginPath();
          ctx!.arc(sx, sy, subR, 0, Math.PI * 2);
          ctx!.strokeStyle = "rgba(255,255,255,0.22)";
          ctx!.lineWidth   = 0.8 * d;
          ctx!.stroke();
        });

        // hub circle
        ctx!.beginPath();
        ctx!.arc(hx, hy, hubR, 0, Math.PI * 2);
        ctx!.strokeStyle = color;
        ctx!.lineWidth   = 1.2 * d;
        ctx!.stroke();

        // label
        const labelRight = sec.nx <= 0.65;
        const labelX = labelRight ? hx + hubR + 8 * d : hx - hubR - 8 * d;
        ctx!.textAlign    = labelRight ? "left" : "right";
        ctx!.fillStyle    = color;
        ctx!.font         = `500 ${Math.round(13 * d)}px "DM Sans", sans-serif`;
        ctx!.textBaseline = "bottom";
        ctx!.fillText(sec.label, labelX, hy + 1 * d);

        const pctStr = `${sec.etf}  ${sec.pct >= 0 ? "+" : ""}${sec.pct.toFixed(1)}%`;
        ctx!.font      = `300 ${Math.round(10 * d)}px "DM Sans", sans-serif`;
        ctx!.fillStyle = color + "cc";
        ctx!.textBaseline = "top";
        ctx!.fillText(pctStr, labelX, hy + 2 * d);
      });

      raf = requestAnimationFrame(draw);
    }

    function handleResize() {
      cancelAnimationFrame(raf);
      resize();
      draw();
    }

    window.addEventListener("resize", handleResize);
    resize();
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} id="graph" />;
}
