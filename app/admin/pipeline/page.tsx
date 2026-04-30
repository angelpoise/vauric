"use client";

import { adminFetch } from "@/lib/adminFetch";

import { useState, useEffect } from "react";

const CARD: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "24px" };
const BTN: React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 500, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" };
const BTN_SEC: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 13, padding: "8px 18px", cursor: "pointer", fontFamily: "inherit" };
const LABEL: React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 6 };

interface Config { news_pipeline_enabled: boolean; last_run_at: string | null; }

export default function PipelinePage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);

  async function loadConfig() {
    const r = await adminFetch("/api/admin/overview");
    if (r.ok) {
      const d = await r.json();
      setConfig({ news_pipeline_enabled: d.pipelineEnabled ?? true, last_run_at: d.lastRunAt });
    }
  }

  useEffect(() => { loadConfig(); }, []);

  async function toggle() {
    if (!config) return;
    setToggling(true);
    const next = !config.news_pipeline_enabled;
    await adminFetch("/api/admin/pipeline-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ news_pipeline_enabled: next }),
    });
    setConfig({ ...config, news_pipeline_enabled: next });
    setToggling(false);
  }

  async function run() {
    setRunning(true);
    setResult(null);
    const r = await adminFetch("/api/admin/pipeline", { method: "POST" });
    const json = await r.json();
    if (json.error) {
      setResult(`Error: ${json.error}`);
    } else {
      setResult(`✓ Processed ${json.processed} · Inserted ${json.inserted} · Skipped ${json.skipped}`);
    }
    setRunning(false);
    loadConfig();
  }

  const enabled = config?.news_pipeline_enabled ?? null;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Pipeline</h1>

      {/* Status card */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={LABEL}>Pipeline status</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: enabled === null ? "#475569" : enabled ? "#22c55e" : "#ef4444" }} />
              <span style={{ fontSize: 20, fontWeight: 600, color: "#f1f5f9" }}>
                {enabled === null ? "Loading…" : enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <button
            style={{ ...BTN_SEC, borderColor: enabled ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)", color: enabled ? "#ef4444" : "#22c55e" }}
            onClick={toggle}
            disabled={toggling || config === null}
          >
            {toggling ? "Saving…" : enabled ? "Disable pipeline" : "Enable pipeline"}
          </button>
        </div>
      </div>

      {/* Last run card */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div style={LABEL}>Last run</div>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>
          {config?.last_run_at ? new Date(config.last_run_at).toLocaleString() : "Never"}
        </div>
      </div>

      {/* Run now */}
      <div style={CARD}>
        <div style={LABEL}>Manual trigger</div>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 14, fontWeight: 300 }}>
          Fetches the latest news from Finnhub for all 19 tracked tickers and inserts new articles. Runs in batches to avoid rate limiting (~3s total).
        </div>
        <button style={BTN} onClick={run} disabled={running}>
          {running ? "Running…" : "Run pipeline now"}
        </button>
        {result && (
          <div style={{ marginTop: 12, fontSize: 13, color: result.startsWith("Error") ? "#ef4444" : "#22c55e" }}>
            {result}
          </div>
        )}
      </div>
    </div>
  );
}
