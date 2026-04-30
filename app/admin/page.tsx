"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const CARD: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN: React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 500, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" };
const BTN_SEC: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 13, fontWeight: 400, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" };

interface Overview {
  stocks: number;
  sectors: number;
  articles: number;
  pipelineEnabled: boolean | null;
  lastRunAt: string | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setOverview(d); });
  }, []);

  async function runPipeline() {
    setRunning(true);
    setRunResult(null);
    const res = await fetch("/api/admin/pipeline", { method: "POST" });
    const json = await res.json();
    setRunResult(`Processed ${json.processed ?? "?"} · Inserted ${json.inserted ?? "?"} · Skipped ${json.skipped ?? "?"}`);
    setRunning(false);
  }

  async function clearCache() {
    await fetch("/api/news?nocache=1");
    setRunResult("Cache cleared.");
  }

  const statStyle: React.CSSProperties = { fontSize: 32, fontWeight: 700, color: "#f1f5f9", lineHeight: 1, marginBottom: 4 };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 500 };

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 28, color: "#f1f5f9" }}>Dashboard</h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {/* Stocks — hardcoded until graph is migrated to database-driven nodes */}
        <div style={CARD}>
          <div style={statStyle}>19</div>
          <div style={labelStyle}>Stocks</div>
          <div style={{ fontSize: 10, color: "#1e293b", marginTop: 6, lineHeight: 1.5 }}>
            Graph nodes are currently hardcoded — migrate to database to enable live counts
          </div>
        </div>

        {/* Sectors — 4 active (Consumer has no node yet) */}
        <div style={CARD}>
          <div style={statStyle}>4</div>
          <div style={labelStyle}>Sectors</div>
          <div style={{ fontSize: 10, color: "#1e293b", marginTop: 6, lineHeight: 1.5 }}>
            Graph nodes are currently hardcoded — migrate to database to enable live counts
          </div>
        </div>

        <div style={CARD}>
          <div style={statStyle}>{overview?.articles ?? "—"}</div>
          <div style={labelStyle}>News articles</div>
        </div>

        <div style={CARD}>
          <div style={{ ...statStyle, color: overview === null ? "#f1f5f9" : overview.pipelineEnabled ? "#22c55e" : "#ef4444" }}>
            {overview === null ? "—" : overview.pipelineEnabled ? "Enabled" : "Disabled"}
          </div>
          <div style={labelStyle}>Pipeline</div>
        </div>
      </div>

      {/* Last run */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={labelStyle}>Last pipeline run</div>
        <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 6 }}>
          {overview?.lastRunAt ? new Date(overview.lastRunAt).toLocaleString() : "Never"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button style={BTN} onClick={runPipeline} disabled={running}>
          {running ? "Running…" : "Run pipeline now"}
        </button>
        <button style={BTN_SEC} onClick={clearCache}>Clear news cache</button>
        <button style={BTN_SEC} onClick={() => router.push("/graph")}>Go to graph</button>
      </div>

      {runResult && (
        <div style={{ fontSize: 13, color: "#22c55e", marginTop: 8 }}>{runResult}</div>
      )}
    </div>
  );
}
