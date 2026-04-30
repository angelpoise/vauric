"use client";

import { adminFetch } from "@/lib/adminFetch";

import { useState, useEffect } from "react";

const NOTIF_TYPES = ["news", "analyst", "squeeze", "delisting", "split", "earnings", "ipo"];
const NOTIF_COLORS: Record<string, string> = {
  news: "#facc15", analyst: "#f97316", squeeze: "#ef4444",
  delisting: "#a855f7", split: "#3b82f6", earnings: "#ffffff", ipo: "#22c55e",
};
const GRAPH_TICKERS = ["NVDA","MSFT","PLTR","AMD","ARM","SMCI","XOM","CVX","FANG","SLB","LLY","HIMS","RXRX","MRNA","SOFI","AFRM","PYPL","COIN","HOOD"];

const CARD: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN: React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const TH: React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left" };
const TD: React.CSSProperties = { padding: "10px 16px 10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0", verticalAlign: "middle" };

interface ManualNotif { id: number; ticker: string; notification_type: string; note: string | null; created_at: string; }

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<ManualNotif[]>([]);
  const [ticker, setTicker] = useState("NVDA");
  const [type, setType] = useState("analyst");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await adminFetch("/api/admin/notifications");
    if (r.ok) setNotifs(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setErr(null);
    const r = await adminFetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, notification_type: type, note: note || null }),
    });
    if (!r.ok) { setErr((await r.json()).error); return; }
    setNote("");
    load();
  }

  async function del(id: number) {
    if (!confirm("Remove this notification?")) return;
    await adminFetch("/api/admin/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  // Group by ticker for display
  const byTicker: Record<string, ManualNotif[]> = {};
  for (const n of notifs) {
    (byTicker[n.ticker] ??= []).push(n);
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Manual Notifications</h1>

      {/* Add form */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add manual notification</div>
        <div style={{ display: "grid", gridTemplateColumns: "160px 160px 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Ticker</div>
            <select style={{ ...INPUT, width: "100%" }} value={ticker} onChange={e => setTicker(e.target.value)}>
              {GRAPH_TICKERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Type</div>
            <select style={{ ...INPUT, width: "100%" }} value={type} onChange={e => setType(e.target.value)}>
              {NOTIF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 5 }}>Note (optional)</div>
            <input style={{ ...INPUT, width: "100%" }} placeholder="Reason or context…" value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <button style={BTN} onClick={add}>Add</button>
        </div>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Grouped list */}
      {Object.keys(byTicker).length === 0 ? (
        <div style={{ ...CARD, color: "#334155", fontSize: 13 }}>No manual notifications yet.</div>
      ) : (
        Object.entries(byTicker).sort(([a], [b]) => a.localeCompare(b)).map(([t, items]) => (
          <div key={t} style={{ ...CARD, marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", marginBottom: 12 }}>{t}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Type", "Note", "Created", ""].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {items.map(n => (
                  <tr key={n.id}>
                    <td style={TD}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: (NOTIF_COLORS[n.notification_type] ?? "#64748b") + "18", border: `1px solid ${(NOTIF_COLORS[n.notification_type] ?? "#64748b")}35`, borderRadius: 20, padding: "2px 10px 2px 7px" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: NOTIF_COLORS[n.notification_type] ?? "#64748b" }} />
                        <span style={{ fontSize: 11, color: NOTIF_COLORS[n.notification_type] ?? "#64748b" }}>{n.notification_type}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, color: "#475569", fontWeight: 300 }}>{n.note ?? "—"}</td>
                    <td style={{ ...TD, color: "#334155", fontSize: 11 }}>{new Date(n.created_at).toLocaleString()}</td>
                    <td style={TD}><button style={BTN_D} onClick={() => del(n.id)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
