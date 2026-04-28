"use client";

import { useEffect, useRef } from "react";

interface Sector {
  label: string;
  x: number;
  y: number;
  r: number;
  col: string;
}

interface Stock {
  t: string;
  x: number;
  y: number;
  m: number;
  s: number;
  c: number;
  n: boolean;
}

const SECTORS: Sector[] = [
  { label: "Technology", x: 0.32, y: 0.3,  r: 22, col: "#3b82f6" },
  { label: "Energy",     x: 0.7,  y: 0.28, r: 20, col: "#f59e0b" },
  { label: "Healthcare", x: 0.2,  y: 0.68, r: 19, col: "#10b981" },
  { label: "Finance",    x: 0.78, y: 0.68, r: 21, col: "#8b5cf6" },
  { label: "Consumer",   x: 0.5,  y: 0.52, r: 17, col: "#ec4899" },
];

const STOCKS: Stock[] = [
  { t: "NVDA", x: 0.22, y: 0.14, m: +8.4,  s: 0, c: 5, n: true  },
  { t: "SMCI", x: 0.4,  y: 0.11, m: +12.1, s: 0, c: 3, n: true  },
  { t: "PLTR", x: 0.15, y: 0.38, m: +4.2,  s: 0, c: 3, n: false },
  { t: "MSFT", x: 0.46, y: 0.22, m: +0.9,  s: 0, c: 4, n: false },
  { t: "ARM",  x: 0.28, y: 0.08, m: +6.3,  s: 0, c: 3, n: true  },
  { t: "FANG", x: 0.64, y: 0.14, m: +7.2,  s: 1, c: 3, n: true  },
  { t: "MPC",  x: 0.8,  y: 0.18, m: +5.5,  s: 1, c: 3, n: false },
  { t: "SLB",  x: 0.76, y: 0.38, m: -2.4,  s: 1, c: 2, n: false },
  { t: "HIMS", x: 0.1,  y: 0.6,  m: +18.3, s: 2, c: 3, n: true  },
  { t: "RXRX", x: 0.22, y: 0.8,  m: +9.1,  s: 2, c: 2, n: true  },
  { t: "INMD", x: 0.34, y: 0.76, m: -4.8,  s: 2, c: 2, n: false },
  { t: "SOFI", x: 0.7,  y: 0.6,  m: +6.8,  s: 3, c: 3, n: true  },
  { t: "AFRM", x: 0.88, y: 0.56, m: +8.2,  s: 3, c: 3, n: true  },
  { t: "PYPL", x: 0.84, y: 0.78, m: -1.4,  s: 3, c: 2, n: false },
  { t: "WING", x: 0.52, y: 0.38, m: +11.2, s: 4, c: 2, n: true  },
  { t: "CELH", x: 0.42, y: 0.62, m: +7.6,  s: 4, c: 2, n: false },
];

const LINKS = [
  [0,1],[0,4],[0,2],[0,3],[5,6],[5,7],[8,9],[11,12],[11,13],[14,15],[0,14],[8,15],[11,14],
];

export default function KnowledgeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c: CanvasRenderingContext2D = ctx;

    let W = 0, H = 0, t = 0, raf = 0;
    const dpr = () => window.devicePixelRatio || 1;

    function resize() {
      const rect = canvas.parentElement!.getBoundingClientRect();
      W = canvas.width = rect.width * dpr();
      H = canvas.height = 380 * dpr();
      canvas.style.width = rect.width + "px";
      canvas.style.height = "380px";
    }

    const nodeR  = (s: Stock)  => (8 + s.c * 2) * dpr();
    const sectorR = (s: Sector) => s.r * dpr();
    const nx = (n: Stock)  => n.x * W;
    const ny = (n: Stock)  => n.y * H + Math.sin(t * 0.5 + n.x * 8) * 3 * dpr();
    const sx = (s: Sector) => s.x * W;
    const sy = (s: Sector) => s.y * H + Math.sin(t * 0.3 + s.x * 5) * 4 * dpr();

    function draw() {
      c.clearRect(0, 0, W, H);
      t += 0.008;

      // sector → stock spokes
      STOCKS.forEach((st) => {
        const sec = SECTORS[st.s];
        c.beginPath();
        c.moveTo(sx(sec), sy(sec));
        c.lineTo(nx(st), ny(st));
        c.strokeStyle = "rgba(255,255,255,0.05)";
        c.lineWidth = 0.5 * dpr();
        c.stroke();
      });

      // stock-to-stock links
      LINKS.forEach(([a, b]) => {
        const na = STOCKS[a], nb = STOCKS[b];
        c.beginPath();
        c.moveTo(nx(na), ny(na));
        c.lineTo(nx(nb), ny(nb));
        c.strokeStyle = "rgba(255,255,255,0.08)";
        c.lineWidth = 0.5 * dpr();
        c.stroke();
      });

      // sectors
      SECTORS.forEach((sec) => {
        const x = sx(sec), y = sy(sec), r = sectorR(sec);
        const pulse = 1 + Math.sin(t + sec.x * 5) * 0.04;
        c.beginPath(); c.arc(x, y, r * pulse, 0, Math.PI * 2);
        c.strokeStyle = sec.col; c.lineWidth = 1.5 * dpr(); c.stroke();
        c.beginPath(); c.arc(x, y, r * 0.45 * pulse, 0, Math.PI * 2);
        c.fillStyle = sec.col + "22"; c.fill();
        c.fillStyle = "#fff";
        c.font = `500 ${10 * dpr()}px DM Sans, sans-serif`;
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(sec.label, x, y + r + 13 * dpr());
      });

      // stocks
      STOCKS.forEach((st) => {
        const x = nx(st), y = ny(st), r = nodeR(st);
        const col = st.m > 0.5 ? "#22c55e" : st.m < -0.5 ? "#ef4444" : "#64748b";
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = st.m > 0 ? "#0a2a14" : "#2a0a0a"; c.fill();
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.strokeStyle = col; c.lineWidth = 1 * dpr(); c.stroke();
        c.fillStyle = "#fff";
        c.font = `500 ${Math.max(8, r * 0.65)}px DM Sans, sans-serif`;
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(st.t, x, y);
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.font = `300 ${8 * dpr()}px DM Sans, sans-serif`;
        c.textBaseline = "top";
        c.fillText(st.t, x, y + r + 4 * dpr());
        if (st.n) {
          c.beginPath(); c.arc(x + r * 0.72, y - r * 0.72, 4 * dpr(), 0, Math.PI * 2);
          c.fillStyle = "#facc15"; c.fill();
        }
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
