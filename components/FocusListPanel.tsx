"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import type { ConnectionView } from "@/components/GraphCanvas";

const PANEL_W = 260;

interface FocusList {
  id: string;
  name: string;
  tickers: string[];
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isPro: boolean;
  connectionView: ConnectionView;
  onConnectionViewChange: (v: ConnectionView) => void;
}

export default function FocusListPanel({ open, onClose, isPro, connectionView, onConnectionViewChange }: Props) {
  const { getToken } = useAuth();
  const [lists, setLists] = useState<FocusList[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchLists = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch("/api/focus-lists", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setLists(await r.json());
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (open && isPro) fetchLists();
  }, [open, isPro, fetchLists]);

  async function handleSave() {
    if (!saveName.trim() || connectionView.focusTickers.length === 0) return;
    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }
    const r = await fetch("/api/focus-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: saveName.trim(), tickers: connectionView.focusTickers }),
    });
    if (r.ok) {
      setSaveName("");
      await fetchLists();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const token = await getToken();
    if (!token) return;
    setLists((prev) => prev.filter((l) => l.id !== id));
    await fetch(`/api/focus-lists/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  function handleLoad(list: FocusList) {
    onConnectionViewChange({ ...connectionView, focusTickers: list.tickers });
    onClose();
  }

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, zIndex: 34 }}
        />
      )}
      <div style={{
        position: "fixed", top: 0, right: 0,
        width: PANEL_W, height: "100vh", zIndex: 35,
        background: "#0d1117",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        transform: open ? "translateX(0)" : `translateX(${PANEL_W}px)`,
        transition: "transform 0.22s ease",
        display: "flex", flexDirection: "column",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        pointerEvents: open ? "auto" : "none",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 14px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Focus Lists</div>
            <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>Saved ticker focus sets</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Save current focus section */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {connectionView.focusTickers.length > 0 ? (
            <>
              <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>
                Save current: {connectionView.focusTickers.join(", ")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="List name…"
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5,
                    color: "#f1f5f9", fontSize: 11, padding: "5px 8px",
                    fontFamily: "inherit", outline: "none",
                  }}
                />
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || saving}
                  style={{
                    background: saveName.trim() ? "#3b82f6" : "rgba(59,130,246,0.3)",
                    border: "none", borderRadius: 5,
                    color: "#fff", fontSize: 10, padding: "5px 10px",
                    cursor: saveName.trim() ? "pointer" : "default",
                    fontFamily: "inherit", whiteSpace: "nowrap",
                  }}
                >
                  {saving ? "…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: "#334155" }}>
              Add tickers to the Focus bar to save a list.
            </div>
          )}
        </div>

        {/* List of saved focus sets */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "20px 14px", fontSize: 11, color: "#334155", textAlign: "center" }}>
              Loading…
            </div>
          ) : lists.length === 0 ? (
            <div style={{ padding: "20px 14px", fontSize: 11, color: "#334155", textAlign: "center" }}>
              No saved lists yet.
            </div>
          ) : (
            lists.map((list) => (
              <div
                key={list.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#cbd5e1", lineHeight: 1.3 }}>
                    {list.name}
                  </span>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={() => handleLoad(list)}
                      style={{
                        background: "rgba(59,130,246,0.12)",
                        border: "1px solid rgba(59,130,246,0.25)",
                        borderRadius: 4, color: "#3b82f6",
                        fontSize: 9, padding: "2px 8px",
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(list.id)}
                      style={{
                        background: "none", border: "none",
                        color: "#334155", cursor: "pointer",
                        fontSize: 12, padding: "0 2px", lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {list.tickers.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 9, color: "#64748b",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 3, padding: "1px 5px",
                        fontFamily: "monospace",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
