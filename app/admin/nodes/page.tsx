"use client";

import { useState, useEffect } from "react";

const SECTORS = [
  { id: "sec-tech",    name: "Technology" },
  { id: "sec-energy",  name: "Energy"     },
  { id: "sec-health",  name: "Healthcare" },
  { id: "sec-finance", name: "Finance"    },
];

const CARD: React.CSSProperties = { background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "20px 24px" };
const BTN: React.CSSProperties = { background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, fontWeight: 500, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" };
const BTN_D: React.CSSProperties = { background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, color: "#ef4444", fontSize: 12, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" };
const INPUT: React.CSSProperties = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#f1f5f9", fontSize: 13, padding: "7px 10px", fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const TH: React.CSSProperties = { fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", padding: "0 16px 10px 0", textAlign: "left" };
const TD: React.CSSProperties = { padding: "11px 16px 11px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13, color: "#e2e8f0" };

interface Stock { id: number; ticker: string; name: string; sector_id: string; x: number; y: number; }
type EditMap = Record<number, Partial<Stock>>;

const blank = { ticker: "", name: "", sector_id: "sec-tech", x: 500, y: 500 };

export default function NodesPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [form, setForm] = useState(blank);
  const [edits, setEdits] = useState<EditMap>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/stocks");
    if (r.ok) setStocks(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function add() {
    setErr(null);
    const r = await fetch("/api/admin/stocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!r.ok) { setErr((await r.json()).error); return; }
    setForm(blank);
    load();
  }

  async function save(id: number) {
    const r = await fetch(`/api/admin/stocks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edits[id]) });
    if (r.ok) { setEditingId(null); setEdits({}); load(); }
  }

  async function del(id: number) {
    if (!confirm("Remove this stock?")) return;
    await fetch(`/api/admin/stocks/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Graph Nodes</h1>

      {/* Add form */}
      <div style={{ ...CARD, marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: "#475569", fontWeight: 500, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 16 }}>Add stock node</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 80px 80px", gap: 10, marginBottom: 12 }}>
          <input style={INPUT} placeholder="Ticker" value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })} />
          <input style={INPUT} placeholder="Company name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <select style={{ ...INPUT }} value={form.sector_id} onChange={e => setForm({ ...form, sector_id: e.target.value })}>
            {SECTORS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input style={INPUT} placeholder="X" type="number" value={form.x} onChange={e => setForm({ ...form, x: +e.target.value })} />
          <input style={INPUT} placeholder="Y" type="number" value={form.y} onChange={e => setForm({ ...form, y: +e.target.value })} />
        </div>
        <button style={BTN} onClick={add}>Add node</button>
        {err && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 8 }}>{err}</div>}
      </div>

      {/* Table */}
      <div style={CARD}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Ticker", "Name", "Sector", "X", "Y", ""].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 && (
              <tr><td colSpan={6} style={{ ...TD, color: "#334155" }}>No stocks in admin_stocks table yet.</td></tr>
            )}
            {stocks.map(s => {
              const editing = editingId === s.id;
              const e = edits[s.id] ?? s;
              return (
                <tr key={s.id}>
                  <td style={TD}><span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{s.ticker}</span></td>
                  <td style={TD}>
                    {editing ? <input style={{ ...INPUT, width: 180 }} value={e.name ?? s.name} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, name: ev.target.value } })} /> : s.name}
                  </td>
                  <td style={TD}>
                    {editing
                      ? <select style={{ ...INPUT, width: 130 }} value={e.sector_id ?? s.sector_id} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, sector_id: ev.target.value } })}>
                          {SECTORS.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
                        </select>
                      : SECTORS.find(sec => sec.id === s.sector_id)?.name ?? s.sector_id}
                  </td>
                  <td style={TD}>
                    {editing ? <input style={{ ...INPUT, width: 70 }} type="number" value={e.x ?? s.x} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, x: +ev.target.value } })} /> : s.x}
                  </td>
                  <td style={TD}>
                    {editing ? <input style={{ ...INPUT, width: 70 }} type="number" value={e.y ?? s.y} onChange={ev => setEdits({ ...edits, [s.id]: { ...e, y: +ev.target.value } })} /> : s.y}
                  </td>
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 8 }}>
                      {editing
                        ? <><button style={BTN} onClick={() => save(s.id)}>Save</button><button style={{ ...BTN_D, background: "none", border: "none", color: "#475569" }} onClick={() => { setEditingId(null); setEdits({}); }}>Cancel</button></>
                        : <><button style={{ ...BTN, background: "rgba(255,255,255,0.05)", color: "#94a3b8" }} onClick={() => setEditingId(s.id)}>Edit</button><button style={BTN_D} onClick={() => del(s.id)}>Remove</button></>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
