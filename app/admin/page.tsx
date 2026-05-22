"use client";

import { adminFetch } from "@/lib/adminFetch";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const CARD: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "18px 20px" };
const BTN: React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" };
const BTN_SEC: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#94a3b8", fontSize: 12, padding: "7px 16px", cursor: "pointer", fontFamily: "inherit" };
const LABEL: React.CSSProperties = { fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 2 };

interface Overview {
  nodes: { stock: number; sector: number; subsector: number; subsubsector: number };
  connections: { t1: number; t2: number; t3: number; stocksNoT1: number };
  news: { articles: number; pipelineEnabled: boolean | null; lastRunAt: string | null };
  analysis: { withCache: number; total: number };
  users: { total: number; pro: number; plus: number; free: number };
  focusLists: number;
  polygonConfigured: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusDot({ ok }: { ok: boolean | null }) {
  const colour = ok === null ? "#475569" : ok ? "#22c55e" : "#ef4444";
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: colour, marginRight: 7, flexShrink: 0, marginTop: 1 }} />;
}

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div style={CARD}>
      <div style={{ fontSize: 30, fontWeight: 700, color: "#f1f5f9", lineHeight: 1, marginBottom: 4 }}>
        {value === -1 ? "—" : typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div style={LABEL}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "#334155", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function StatusCard({ title, status, ok, rows }: {
  title: string;
  status: string;
  ok: boolean | null;
  rows: { label: string; value: string | number; highlight?: string }[];
}) {
  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          <StatusDot ok={ok} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>{title}</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: ok === null ? "rgba(71,85,105,0.15)" : ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          color: ok === null ? "#475569" : ok ? "#22c55e" : "#ef4444",
          border: `1px solid ${ok === null ? "rgba(71,85,105,0.2)" : ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {status}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#475569" }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: r.highlight ?? "#94a3b8", fontVariantNumeric: "tabular-nums" }}>
              {typeof r.value === "number" ? r.value.toLocaleString() : r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [togglingPipeline, setTogglingPipeline] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch("/api/admin/overview");
    if (r.ok) setOverview(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runPipeline() {
    setRunning(true); setRunResult(null);
    const res = await adminFetch("/api/admin/pipeline", { method: "POST" });
    const json = await res.json();
    setRunResult(`Processed ${json.processed ?? "?"} · Inserted ${json.inserted ?? "?"} · Skipped ${json.skipped ?? "?"}`);
    setRunning(false);
    load();
  }

  const pipelineOk = overview?.news.pipelineEnabled ?? null;
  const connOk = overview ? overview.connections.stocksNoT1 < 10 : null;
  const usersOk = overview ? overview.users.total >= 0 : null;
  const analysisOk = overview ? overview.analysis.withCache > 0 : null;
  const analysisPct = overview ? Math.round((overview.analysis.withCache / Math.max(overview.analysis.total, 1)) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Dashboard</h1>
        <button style={{ ...BTN_SEC, fontSize: 11 }} onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard value={overview?.nodes.stock ?? "—"} label="Stocks" />
        <StatCard value={overview?.nodes.sector ?? "—"} label="Sectors" />
        <StatCard value={overview?.nodes.subsector ?? "—"} label="Sub-sectors" />
        <StatCard value={overview?.nodes.subsubsector ?? "—"} label="Industries" />
        <StatCard value={overview?.nodes ? overview.nodes.stock + overview.nodes.sector + overview.nodes.subsector + overview.nodes.subsubsector : "—"} label="Total nodes" />
      </div>

      {/* System status cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>

        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              <StatusDot ok={pipelineOk} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>News Pipeline</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                background: pipelineOk === null ? "rgba(71,85,105,0.15)" : pipelineOk ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color: pipelineOk === null ? "#475569" : pipelineOk ? "#22c55e" : "#ef4444",
                border: `1px solid ${pipelineOk === null ? "rgba(71,85,105,0.2)" : pipelineOk ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}>{pipelineOk === null ? "Loading" : pipelineOk ? "Enabled" : "Disabled"}</span>
              {overview !== null && (
                <button
                  style={{ ...BTN_SEC, fontSize: 11, padding: "3px 10px" }}
                  disabled={togglingPipeline}
                  onClick={async () => {
                    setTogglingPipeline(true);
                    await adminFetch("/api/admin/pipeline-config", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ news_pipeline_enabled: !overview.news.pipelineEnabled }),
                    });
                    await load();
                    setTogglingPipeline(false);
                  }}
                >
                  {togglingPipeline ? "…" : pipelineOk ? "Disable" : "Enable"}
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Articles indexed", value: overview?.news.articles ?? "—" },
              { label: "Last run",         value: timeAgo(overview?.news.lastRunAt ?? null) },
              { label: "Polygon API",      value: overview?.polygonConfigured ? "Configured" : "Missing key", highlight: overview?.polygonConfigured ? "#22c55e" : "#ef4444" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "#475569" }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: (r as { highlight?: string }).highlight ?? "#94a3b8" }}>
                  {typeof r.value === "number" ? r.value.toLocaleString() : r.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <StatusCard
          title="Connection Coverage"
          status={connOk === null ? "Loading" : connOk ? "Good" : "Gaps"}
          ok={connOk}
          rows={[
            { label: "T1 exposure", value: overview?.connections.t1 ?? "—" },
            { label: "T2 peer", value: overview?.connections.t2 ?? "—" },
            { label: "T3 impact", value: overview?.connections.t3 ?? "—" },
            { label: "Stocks missing T1", value: overview?.connections.stocksNoT1 ?? "—", highlight: (overview?.connections.stocksNoT1 ?? 0) > 0 ? "#f59e0b" : "#22c55e" },
          ]}
        />

        <StatusCard
          title="Users"
          status={usersOk === null ? "Loading" : overview!.users.total < 0 ? "API Error" : `${overview!.users.total} total`}
          ok={usersOk && (overview?.users.total ?? -1) >= 0 ? true : usersOk}
          rows={[
            { label: "Pro", value: overview?.users.pro ?? "—", highlight: "#a855f7" },
            { label: "Plus", value: overview?.users.plus ?? "—", highlight: "#3b82f6" },
            { label: "Free", value: overview?.users.free === -1 ? "—" : overview?.users.free ?? "—" },
            { label: "Focus lists saved", value: overview?.focusLists ?? "—" },
          ]}
        />

        <StatusCard
          title="AI Analysis Cache"
          status={analysisOk === null ? "Loading" : `${analysisPct}% coverage`}
          ok={analysisPct > 50 ? true : analysisPct > 0 ? null : false}
          rows={[
            { label: "Stocks with cache", value: overview?.analysis.withCache ?? "—" },
            { label: "Total stocks", value: overview?.analysis.total ?? "—" },
            { label: "Coverage", value: overview ? `${analysisPct}%` : "—", highlight: analysisPct > 80 ? "#22c55e" : analysisPct > 40 ? "#f59e0b" : "#ef4444" },
          ]}
        />
      </div>

      {/* Actions */}
      <div style={{ ...CARD, marginBottom: 0 }}>
        <div style={{ ...LABEL, marginBottom: 12 }}>Actions</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={BTN} onClick={runPipeline} disabled={running}>
            {running ? "Running…" : "Run pipeline"}
          </button>
          <button style={BTN_SEC} onClick={async () => { await fetch("/api/news?nocache=1"); setRunResult("Cache cleared."); }}>
            Clear news cache
          </button>
          <button style={BTN_SEC} onClick={() => router.push("/admin/nodes")}>Manage nodes</button>
          <button style={BTN_SEC} onClick={() => router.push("/admin/connections")}>Manage connections</button>
          <button style={BTN_SEC} onClick={() => router.push("/admin/pipeline")}>Pipeline config</button>
          <button style={BTN_SEC} onClick={async () => {
            const r = await adminFetch("/api/admin/digest", { method: "POST" });
            const d = await r.json();
            setRunResult(r.ok ? `Digest sent to ${d.sent}/${d.total} subscribers` : d.error);
          }}>Send digest now</button>
          <button style={BTN_SEC} onClick={() => router.push("/graph")}>Go to graph</button>
        </div>
        {runResult && <div style={{ fontSize: 12, color: "#22c55e", marginTop: 12 }}>{runResult}</div>}
      </div>
    </div>
  );
}
