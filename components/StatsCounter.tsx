"use client";

import { useEffect, useRef, useState } from "react";

const DM    = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF = 'var(--font-dm-serif), serif';

export default function StatsCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const [started,     setStarted]     = useState(false);
  const [stocks,      setStocks]      = useState(0);
  const [connections, setConnections] = useState(0);
  const [industries,  setIndustries]  = useState(0);

  // Targets loaded from DB
  const [targets, setTargets] = useState({ stocks: 1300, connections: 18000, industries: 120 });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setTargets(d); })
      .catch(() => {});
  }, []);

  // Start animation when section enters viewport
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Count-up once started — step sizes match the rounding units
  useEffect(() => {
    if (!started) return;
    const INTERVAL = 28;

    let s = 0;
    const t1 = setInterval(() => {
      s = Math.min(s + 100, targets.stocks);
      setStocks(s);
      if (s >= targets.stocks) clearInterval(t1);
    }, INTERVAL);

    let c = 0;
    const t2 = setInterval(() => {
      c = Math.min(c + 1000, targets.connections);
      setConnections(c);
      if (c >= targets.connections) clearInterval(t2);
    }, INTERVAL);

    let i = 0;
    const t3 = setInterval(() => {
      i = Math.min(i + 10, targets.industries);
      setIndustries(i);
      if (i >= targets.industries) clearInterval(t3);
    }, INTERVAL);

    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); };
  }, [started, targets]);

  const fmt = (n: number) => n === 0 ? "0" : n.toLocaleString();

  return (
    <div ref={ref} style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, overflow: "hidden",
      }}>

        {/* ── Animated number counters ── */}
        {[
          { value: fmt(connections) + "+", label: "connections",  sub: "to explore"   },
          { value: fmt(stocks)      + "+", label: "stocks",       sub: "to discover"  },
          { value: fmt(industries)  + "+", label: "industries",   sub: "mapped"       },
        ].map(({ value, label, sub }) => (
          <div key={label} style={{
            background: "var(--bg2)", padding: "28px 16px", textAlign: "center",
          }}>
            <div style={{
              fontFamily: SERIF, fontSize: "clamp(24px, 3vw, 36px)",
              fontWeight: 400, color: "var(--text)", lineHeight: 1, marginBottom: 6,
            }}>
              {value}
            </div>
            <div style={{ fontFamily: DM, fontSize: 13, color: "var(--text-dim)", fontWeight: 500, marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontFamily: DM, fontSize: 11, color: "var(--text-muted)", fontWeight: 300, letterSpacing: "0.04em" }}>
              {sub}
            </div>
          </div>
        ))}

        {/* ── Feature highlight blocks ── */}
        {[
          {
            title: "Live market data",
            body:  "Real-time prices sourced from Polygon, refreshed throughout every trading session.",
          },
          {
            title: "AI-generated analysis",
            body:  "Business model, margins, and guidance summarised on demand for any stock.",
          },
          {
            title: "Catalyst alerts",
            body:  "Earnings, analyst moves, and corporate events delivered to your watchlist.",
          },
        ].map(({ title, body }) => (
          <div key={title} style={{
            background: "rgba(255,255,255,0.015)",
            padding: "24px 20px", textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}>
            <p style={{ fontFamily: DM, fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 6 }}>
              {title}
            </p>
            <p style={{ fontFamily: DM, fontSize: 12, fontWeight: 300, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
              {body}
            </p>
          </div>
        ))}

      </div>
    </div>
  );
}
