"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface ContextMenuInfo {
  type: "node" | "edge";
  id: string; // ticker for node, "AAAA---BBBB" for edge
  clientX: number;
  clientY: number;
}

interface Props {
  editMode: boolean;
  pendingCount: number;
  knownTickers: string[];
  contextMenu: ContextMenuInfo | null;
  showConnectionPrompt: boolean;
  connectionPromptPreset?: string;
  saving: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onContextMenuClose: () => void;
  onDeleteNode: (ticker: string) => Promise<void>;
  onDeleteEdge: (tickerA: string, tickerB: string) => Promise<void>;
  onAddConnection: (tickerA: string, tickerB: string) => Promise<void>;
  onConnectionPromptOpen: (preset?: string) => void;
  onConnectionPromptClose: () => void;
}

export default function GraphEditOverlay({
  editMode, pendingCount, knownTickers,
  contextMenu, showConnectionPrompt, connectionPromptPreset, saving,
  onToggleEdit, onSave, onContextMenuClose,
  onDeleteNode, onDeleteEdge, onAddConnection,
  onConnectionPromptOpen, onConnectionPromptClose,
}: Props) {
  const router = useRouter();
  const [connA, setConnA] = useState(knownTickers[0] ?? "");
  const [connB, setConnB] = useState(knownTickers[1] ?? "");

  // Pre-fill first dropdown when opened from a node context menu
  useEffect(() => {
    if (showConnectionPrompt) {
      setConnA(connectionPromptPreset ?? knownTickers[0] ?? "");
      setConnB(knownTickers.find((t) => t !== (connectionPromptPreset ?? knownTickers[0])) ?? "");
    }
  }, [showConnectionPrompt, connectionPromptPreset]); // eslint-disable-line

  const [edgeA, edgeB] = contextMenu?.type === "edge"
    ? contextMenu.id.split("---")
    : [null, null];

  return (
    <>
      {/* Edit mode toggle + save — top-right of screen */}
      <div style={{
        position: "fixed", top: 12, right: 16, zIndex: 25,
        display: "flex", gap: 8, alignItems: "center",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        pointerEvents: "auto",
      }}>
        {editMode && pendingCount > 0 && (
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              background: "#22c55e", border: "none", borderRadius: 6,
              color: "#fff", fontSize: 12, fontWeight: 500,
              padding: "5px 14px", cursor: saving ? "wait" : "pointer",
              fontFamily: "inherit", opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : `Save ${pendingCount} change${pendingCount !== 1 ? "s" : ""}`}
          </button>
        )}
        <button
          onClick={onToggleEdit}
          style={{
            background: editMode ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
            border: editMode ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.12)",
            borderRadius: 6,
            color: editMode ? "#3b82f6" : "#64748b",
            fontSize: 11, fontWeight: 500,
            padding: "5px 12px", cursor: "pointer",
            fontFamily: "inherit", letterSpacing: "0.03em",
          }}
        >
          {editMode ? "✏ Edit mode" : "Edit mode"}
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div onClick={onContextMenuClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "fixed",
            left: Math.min(contextMenu.clientX, window.innerWidth - 200),
            top:  Math.min(contextMenu.clientY, window.innerHeight - 160),
            zIndex: 41,
            background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8, padding: "4px 0",
            minWidth: 190,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
          }}>
            {contextMenu.type === "node" && (
              <>
                <CtxItem onClick={() => { onContextMenuClose(); router.push("/admin/nodes"); }}>
                  Edit stock details
                </CtxItem>
                <CtxItem onClick={() => { onConnectionPromptOpen(contextMenu.id); onContextMenuClose(); }}>
                  Add connection
                </CtxItem>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                <CtxItem danger onClick={async () => { await onDeleteNode(contextMenu.id); onContextMenuClose(); }}>
                  Delete node
                </CtxItem>
              </>
            )}
            {contextMenu.type === "edge" && edgeA && edgeB && (
              <CtxItem danger onClick={async () => { await onDeleteEdge(edgeA, edgeB); onContextMenuClose(); }}>
                Delete connection
              </CtxItem>
            )}
          </div>
        </>
      )}

      {/* Connection prompt modal */}
      {showConnectionPrompt && (
        <>
          <div
            onClick={onConnectionPromptClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50 }}
          />
          <div style={{
            position: "fixed", top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
            zIndex: 51, background: "#0d1117",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10, padding: "24px", width: 320,
            fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", marginBottom: 18 }}>
              Connect which two stocks?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Stock A", val: connA, set: setConnA },
                { label: "Stock B", val: connB, set: setConnB },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 5 }}>
                    {label}
                  </label>
                  <select
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    style={{
                      width: "100%", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                      color: "#f1f5f9", fontSize: 13, padding: "7px 10px",
                      fontFamily: "inherit", outline: "none",
                    }}
                  >
                    {knownTickers.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={onConnectionPromptClose}
                style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, color: "#64748b", fontSize: 12,
                  padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => { await onAddConnection(connA, connB); onConnectionPromptClose(); }}
                disabled={connA === connB || !connA || !connB}
                style={{
                  background: "#3b82f6", border: "none", borderRadius: 6,
                  color: "#fff", fontSize: 12, fontWeight: 500,
                  padding: "6px 14px", fontFamily: "inherit",
                  cursor: connA !== connB ? "pointer" : "not-allowed",
                  opacity: connA !== connB ? 1 : 0.45,
                }}
              >
                Add connection
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function CtxItem({
  children, onClick, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "8px 14px",
        background: hov ? (danger ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)") : "none",
        border: "none", textAlign: "left", cursor: "pointer",
        color: danger ? (hov ? "#ef4444" : "#f87171") : (hov ? "#f1f5f9" : "#94a3b8"),
        fontSize: 13, fontFamily: "inherit", display: "block",
        transition: "background 0.1s, color 0.1s",
      }}
    >
      {children}
    </button>
  );
}
