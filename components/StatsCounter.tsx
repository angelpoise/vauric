"use client";

import { useEffect, useRef, useState } from "react";

const DM    = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF = 'var(--font-dm-serif), serif';

export default function StatsCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const [started,        setStarted]        = useState(false);
  const [targetsLoaded,  setTargetsLoaded]  = useState(false);
  const [connDone,       setConnDone]       = useState(false);
  const [stocksDone,     setStocksDone]     = useState(false);
  const [stocks,         setStocks]         = useState(0);
  const [connections,    setConnections]    = useState(0);
  const [industries,     setIndustries]     = useState(0);
  // Ref so updated values don't re-trigger count-up effects
  const targets = useRef({ stocks: 1300, connections: 18000, industries: 120 });

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) targets.current = d; })
      .catch(() => {})
      .finally(() => setTargetsLoaded(true));
  }, []);

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

  // Smooth RAF count-up with ease-out cubic.
  // onHalfway fires at 50% elapsed time so the next counter can start overlapping.
  function countUp(
    target: number,
    duration: number,
    setter: (v: number) => void,
    onDone: () => void,
    onHalfway?: () => void,
  ): () => void {
    const start = performance.now();
    let raf = 0;
    let halfwayFired = false;
    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setter(Math.round(target * eased));
      if (!halfwayFired && progress >= 0.5) {
        halfwayFired = true;
        onHalfway?.();
      }
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setter(target);
        onDone();
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }

  // 1. Connections — starts once scrolled into view AND real targets are loaded
  useEffect(() => {
    if (!started || !targetsLoaded) return;
    return countUp(targets.current.connections, 1600, setConnections, () => {}, () => setConnDone(true));
  }, [started, targetsLoaded]); // eslint-disable-line

  // 2. Stocks — starts halfway through connections, triggers industries at its halfway
  useEffect(() => {
    if (!connDone) return;
    return countUp(targets.current.stocks, 1400, setStocks, () => {}, () => setStocksDone(true));
  }, [connDone]); // eslint-disable-line

  // 3. Industries — starts halfway through stocks
  useEffect(() => {
    if (!stocksDone) return;
    return countUp(targets.current.industries, 1000, setIndustries, () => {});
  }, [stocksDone]); // eslint-disable-line

  const fmt = (n: number) => n === 0 ? "0" : n.toLocaleString();

  return (
    <div ref={ref} style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12, overflow: "hidden",
      }}>

        {/* Animated number blocks */}
        {[
          { value: fmt(connections) + "+", label: "connections",  sub: "to explore"  },
          { value: fmt(stocks)      + "+", label: "stocks",       sub: "to discover" },
          { value: fmt(industries)  + "+", label: "industries",   sub: "mapped"      },
        ].map(({ value, label, sub }) => (
          <div key={label} style={{ background: "var(--bg2)", padding: "28px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: SERIF, fontSize: "clamp(22px, 2.8vw, 34px)", fontWeight: 400, color: "var(--text)", lineHeight: 1, marginBottom: 6 }}>
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


      </div>
    </div>
  );
}
