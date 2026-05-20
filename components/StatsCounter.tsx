"use client";

import { useEffect, useRef, useState } from "react";

const DM    = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF = 'var(--font-dm-serif), serif';

interface StatBlockProps {
  value: string;
  label: string;
  sublabel: string;
}

function StatBlock({ value, label, sublabel }: StatBlockProps) {
  return (
    <div style={{ textAlign: "center", padding: "28px 16px" }}>
      <div style={{
        fontFamily: SERIF, fontSize: "clamp(26px, 3vw, 38px)",
        fontWeight: 400, color: "var(--text)", lineHeight: 1, marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: DM, fontSize: 14, color: "var(--text-dim)",
        fontWeight: 500, marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: DM, fontSize: 11, color: "var(--text-muted)",
        fontWeight: 300, letterSpacing: "0.04em",
      }}>
        {sublabel}
      </div>
    </div>
  );
}

export default function StatsCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [stocks, setStocks]           = useState(0);
  const [connections, setConnections] = useState(0);

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

  // Count-up: stocks in steps of 100, connections in steps of 1000
  useEffect(() => {
    if (!started) return;

    const INTERVAL = 28; // ms between ticks

    let s = 0;
    const t1 = setInterval(() => {
      s = Math.min(s + 100, 1300);
      setStocks(s);
      if (s >= 1300) clearInterval(t1);
    }, INTERVAL);

    let c = 0;
    const t2 = setInterval(() => {
      c = Math.min(c + 1000, 18000);
      setConnections(c);
      if (c >= 18000) clearInterval(t2);
    }, INTERVAL);

    return () => { clearInterval(t1); clearInterval(t2); };
  }, [started]);

  const fmt = (n: number, suffix: string) =>
    n === 0 ? `0${suffix}` : `${n.toLocaleString()}${suffix}`;

  return (
    <div ref={ref} style={{
      maxWidth: 920, margin: "0 auto", padding: "0 24px 80px",
    }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, overflow: "hidden",
      }}>
        {[
          {
            value: fmt(connections, "+"),
            label: "connections",
            sublabel: "to explore",
          },
          {
            value: fmt(stocks, "+"),
            label: "stocks",
            sublabel: "to discover",
          },
          {
            value: "200+",
            label: "industries",
            sublabel: "mapped",
          },
          {
            value: "74",
            label: "sub-sectors",
            sublabel: "organised",
          },
          {
            value: "3",
            label: "relationship tiers",
            sublabel: "Exposure · Peer · Impact",
          },
        ].map(({ value, label, sublabel }) => (
          <div key={label} style={{ background: "var(--bg2)" }}>
            <StatBlock value={value} label={label} sublabel={sublabel} />
          </div>
        ))}
      </div>
    </div>
  );
}
