"use client";

import { adminFetch } from "@/lib/adminFetch";

import { useState, useEffect } from "react";

const CARD: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN: React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH: React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left" };
const TD: React.CSSProperties = { padding: "11px 16px 11px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0" };

interface Connection { id: number; source_id: string; target_id: string; }

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await adminFetch("/api/admin/connections");
    if (r.ok) setConnections(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setErr(null);
    if (!sourceId || !targetId) { setErr("Both nodes are required."); return; }
    const r = await adminFetch("/api/admin/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_id: sourceId, target_id: targetId }) });
    if (!r.ok) { setErr((await r.json()).error); return; }
    setSourceId(""); setTargetId("");
    load();
  }

  async function del(id: number) {
    if (!confirm("Remove this connection?")) return;
    await adminFetch(`/api/admin/connections/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Connections</h1>

      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add connection</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Node A (ticker or sector ID)</div>
            <input style={INPUT} placeholder="e.g. NVDA or sec-tech" value={sourceId} onChange={e => setSourceId(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Node B</div>
            <input style={INPUT} placeholder="e.g. AMD" value={targetId} onChange={e => setTargetId(e.target.value)} />
          </div>
          <button style={BTN} onClick={add}>Add</button>
        </div>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      <div style={CARD}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Source", "Target", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {connections.length === 0 && (
              <tr><td colSpan={3} style={{ ...TD, color: "#334155" }}>No connections yet.</td></tr>
            )}
            {connections.map(c => (
              <tr key={c.id}>
                <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.source_id}</code></td>
                <td style={TD}><code style={{ color: "#94a3b8", fontSize: 12 }}>{c.target_id}</code></td>
                <td style={TD}><button style={BTN_D} onClick={() => del(c.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
