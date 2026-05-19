"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { type ConnectionView, type ConnectionMode } from "@/components/GraphCanvas";

const SECTOR_OPTIONS = [
  { etf: "XLK",  name: "Information Technology" },
  { etf: "XLE",  name: "Energy" },
  { etf: "XLV",  name: "Healthcare" },
  { etf: "XLF",  name: "Financials" },
  { etf: "XLI",  name: "Industrials" },
  { etf: "XLP",  name: "Consumer Staples" },
  { etf: "XLY",  name: "Consumer Discr." },
  { etf: "XLC",  name: "Communication" },
  { etf: "XLB",  name: "Materials" },
  { etf: "XLRE", name: "Real Estate" },
  { etf: "XLU",  name: "Utilities" },
];

export interface ContextMenuInfo {
  type: "node" | "edge" | "sector";
  id: string; // ticker for node, "AAAA---BBBB" for edge, sector id for sector
  clientX: number;
  clientY: number;
}

interface Props {
  isAdmin?: boolean;
  editMode: boolean;
  adminView: boolean;
  onAdminViewChange: (v: boolean) => void;
  connectionView: ConnectionView;
  onConnectionViewChange: (v: ConnectionView) => void;
  isPro: boolean;
  saveFailures: string[];
  pendingCount: number;
  knownTickers: string[];
  contextMenu: ContextMenuInfo | null;
  showConnectionPrompt: boolean;
  connectionPromptPreset?: string;
  saving: boolean;
  // Toggle: called directly when no pending changes; shows confirm internally when there are
  onToggleEdit: () => void;
  // Called when user confirms exit with unsaved changes
  onExitConfirmed: () => void;
  onSave: () => void;
  onContextMenuClose: () => void;
  onDeleteNode: (ticker: string) => Promise<void>;
  onDeleteEdge: (tickerA: string, tickerB: string) => Promise<void>;
  onAddConnection: (tickerA: string, tickerB: string) => Promise<void>;
  onConnectionPromptOpen: (preset?: string) => void;
  onConnectionPromptClose: () => void;
  // Sector management
  onEditSector: (sectorId: string) => void;
  onAddSectorOpen: () => void;
  showSectorForm: boolean;
  sectorFormMode: "add" | "edit";
  editingSector: { id: string; name: string; etf: string; colour: string } | null;
  onSectorFormClose: () => void;
  onSectorFormSubmit: (name: string, etf: string, colour: string) => void;
  // Focus list panel
  onFocusListOpen?: () => void;
}

export default function GraphEditOverlay({
  isAdmin, editMode, adminView, onAdminViewChange,
  connectionView, onConnectionViewChange, isPro, saveFailures, pendingCount, knownTickers,
  contextMenu, showConnectionPrompt, connectionPromptPreset, saving,
  onToggleEdit, onExitConfirmed, onSave, onContextMenuClose,
  onDeleteNode, onDeleteEdge, onAddConnection,
  onConnectionPromptOpen, onConnectionPromptClose,
  onEditSector, onAddSectorOpen,
  showSectorForm, sectorFormMode, editingSector,
  onSectorFormClose, onSectorFormSubmit,
  onFocusListOpen,
}: Props) {
  const router = useRouter();
  const [connA, setConnA] = useState(knownTickers[0] ?? "");
  const [connB, setConnB] = useState(knownTickers[1] ?? "");
  const [focusInput, setFocusInput] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Sector dropdown
  const [sectorDropdownOpen, setSectorDropdownOpen] = useState(false);
  const sectorDropdownRef = useRef<HTMLDivElement>(null);

  // Ticker autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (showConnectionPrompt) {
      setConnA(connectionPromptPreset ?? knownTickers[0] ?? "");
      setConnB(knownTickers.find((t) => t !== (connectionPromptPreset ?? knownTickers[0])) ?? "");
    }
  }, [showConnectionPrompt, connectionPromptPreset]); // eslint-disable-line

  // Close sector dropdown on outside click
  useEffect(() => {
    if (!sectorDropdownOpen) return;
    function handler(e: MouseEvent) {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(e.target as Node)) {
        setSectorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sectorDropdownOpen]);

  // Update autocomplete suggestions as focus input changes
  useEffect(() => {
    if (!focusInput) { setSuggestions([]); setShowSuggestions(false); return; }
    const upper = focusInput.toUpperCase();
    const current = connectionView.focusTickers;
    const matches = knownTickers
      .filter((t) => t.includes(upper) && !current.includes(t))
      .sort((a, b) => (b.startsWith(upper) ? 1 : 0) - (a.startsWith(upper) ? 1 : 0))
      .slice(0, 8);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [focusInput, knownTickers, connectionView.focusTickers]);

  const [edgeA, edgeB] = contextMenu?.type === "edge"
    ? contextMenu.id.split("---")
    : [null, null];

  function handleToggleClick() {
    if (editMode && pendingCount > 0) {
      setShowExitConfirm(true);
    } else {
      onToggleEdit();
    }
  }

  function handleConfirmExit() {
    setShowExitConfirm(false);
    onExitConfirmed();
  }

  function handleSectorToggle(etf: string) {
    const current = connectionView.focusSectors;
    if (current.includes(etf)) {
      onConnectionViewChange({ ...connectionView, focusSectors: current.filter((s) => s !== etf) });
    } else {
      const next = isPro ? [...current, etf] : [etf];
      onConnectionViewChange({ ...connectionView, focusSectors: next });
    }
  }

  const maxTickers = isPro ? 20 : 3;
  const tickers = connectionView.focusTickers;

  function addTicker(ticker?: string) {
    const t = (ticker ?? focusInput).trim().toUpperCase();
    if (!t || tickers.includes(t) || tickers.length >= maxTickers) return;
    onConnectionViewChange({ ...connectionView, focusTickers: [...tickers, t] });
    setFocusInput("");
    setShowSuggestions(false);
  }

  return (
    <>
      {/* Connection view controls + admin controls — top-right of screen */}
      <div style={{
        position: "fixed", top: 12, right: 16, zIndex: 25,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        pointerEvents: "auto",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

          {/* Connection mode multi-select */}
          <div style={{
            display: "flex", alignItems: "center", gap: 1,
            background: "rgba(7,9,15,0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7, padding: "2px",
            backdropFilter: "blur(8px)",
          }}>
            <span style={{
              fontSize: 9, color: "#334155", fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase",
              padding: "0 7px 0 5px", userSelect: "none",
            }}>
              Connections
            </span>
            {([
              ["structural", "Structure", "Sector / subsector links"],
              ["exposure",   "Exposure",  "T1 — stock to industry"],
              ["peer",       "Peer",      "T2 — direct competitors"],
              ["impact",     "Impact",    "T3 — indirect relationships"],
            ] as [ConnectionMode, string, string][]).map(([mode, label, desc]) => {
              const active = connectionView.modes.includes(mode);
              return (
                <button
                  key={mode}
                  title={desc}
                  onClick={() => {
                    const current = connectionView.modes;
                    let next: ConnectionMode[];
                    if (active) {
                      next = current.filter((m) => m !== mode);
                    } else {
                      next = isPro ? [...current, mode] : [mode];
                    }
                    onConnectionViewChange({ ...connectionView, modes: next });
                  }}
                  style={{
                    background:   active ? "rgba(59,130,246,0.18)" : "transparent",
                    border:       active ? "1px solid rgba(59,130,246,0.38)" : "1px solid transparent",
                    borderRadius: 5, color: active ? "#3b82f6" : "#475569",
                    fontSize: 10, fontWeight: active ? 600 : 400,
                    padding: "3px 9px", cursor: "pointer",
                    fontFamily: "inherit", letterSpacing: "0.02em",
                    transition: "all 0.12s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Sector filter dropdown */}
          <div ref={sectorDropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setSectorDropdownOpen((o) => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: connectionView.focusSectors.length > 0
                  ? "rgba(168,85,247,0.15)" : "rgba(7,9,15,0.7)",
                border: connectionView.focusSectors.length > 0
                  ? "1px solid rgba(168,85,247,0.35)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 7, padding: "4px 10px",
                backdropFilter: "blur(8px)",
                color: connectionView.focusSectors.length > 0 ? "#a855f7" : "#475569",
                fontSize: 10, fontWeight: connectionView.focusSectors.length > 0 ? 600 : 400,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.12s",
              }}
            >
              {connectionView.focusSectors.length > 0
                ? `Sectors (${connectionView.focusSectors.length})`
                : "Sector"}
              <span style={{ fontSize: 8, opacity: 0.6 }}>▾</span>
            </button>

            {sectorDropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0,
                background: "#0d1117",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8, padding: "6px",
                minWidth: 200, zIndex: 100,
                boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              }}>
                {!isPro && connectionView.focusSectors.length === 0 && (
                  <div style={{ fontSize: 9, color: "#475569", padding: "2px 6px 6px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
                    Free: 1 sector · Pro: unlimited
                  </div>
                )}
                {connectionView.focusSectors.length > 0 && (
                  <button
                    onClick={() => onConnectionViewChange({ ...connectionView, focusSectors: [] })}
                    style={{
                      width: "100%", padding: "4px 8px", marginBottom: 4,
                      background: "none", border: "none", textAlign: "left",
                      color: "#475569", fontSize: 9, cursor: "pointer", fontFamily: "inherit",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    Clear all sectors
                  </button>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {SECTOR_OPTIONS.map(({ etf, name }) => {
                    const active = connectionView.focusSectors.includes(etf);
                    return (
                      <button
                        key={etf}
                        onClick={() => handleSectorToggle(etf)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "5px 8px", borderRadius: 5,
                          background: active ? "rgba(168,85,247,0.12)" : "transparent",
                          border: active ? "1px solid rgba(168,85,247,0.25)" : "1px solid transparent",
                          color: active ? "#a855f7" : "#94a3b8",
                          fontSize: 11, fontWeight: active ? 600 : 400,
                          cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
                          transition: "all 0.1s",
                        }}
                      >
                        <span style={{
                          fontSize: 9, fontFamily: "monospace",
                          color: active ? "#a855f7" : "#475569",
                          minWidth: 32,
                        }}>{etf}</span>
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Ticker focus input with autocomplete */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "rgba(7,9,15,0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 7, padding: "2px 6px",
            backdropFilter: "blur(8px)",
            position: "relative",
          }}>
            <span style={{ fontSize: 9, color: "#334155", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", userSelect: "none", lineHeight: 1 }}>
              Focus
            </span>
            {tickers.map((t) => (
              <span key={t} style={{ fontSize: 10, color: "#3b82f6", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 4, padding: "1px 6px", display: "flex", alignItems: "center", gap: 4 }}>
                {t}
                <button
                  onClick={() => onConnectionViewChange({ ...connectionView, focusTickers: tickers.filter((x) => x !== t) })}
                  style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 0, fontSize: 10, lineHeight: 1 }}
                >×</button>
              </span>
            ))}
            {tickers.length < maxTickers && (
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value.toUpperCase())}
                  onFocus={() => focusInput && setShowSuggestions(suggestions.length > 0)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTicker();
                    if (e.key === "Escape") { setShowSuggestions(false); setFocusInput(""); }
                    if (e.key === "ArrowDown" && suggestions.length > 0) {
                      e.preventDefault();
                      addTicker(suggestions[0]);
                    }
                  }}
                  placeholder={tickers.length === 0 ? "ticker…" : "+"}
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    color: "#94a3b8", fontSize: 10, fontFamily: "monospace",
                    width: tickers.length === 0 ? 52 : 28,
                    padding: 0, lineHeight: 1,
                  }}
                />
                {showSuggestions && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0,
                    background: "#0d1117",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 7, overflow: "hidden",
                    minWidth: 100, zIndex: 200,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  }}>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onMouseDown={() => addTicker(s)}
                        style={{
                          display: "block", width: "100%",
                          padding: "5px 10px", textAlign: "left",
                          background: "none", border: "none",
                          color: "#94a3b8", fontSize: 10,
                          fontFamily: "monospace", cursor: "pointer",
                          transition: "background 0.08s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(59,130,246,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#3b82f6"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isPro && tickers.length === 0 && (
              <span style={{ fontSize: 9, color: "#334155" }}>max {maxTickers}</span>
            )}
            {tickers.length > 0 && (
              <button
                onClick={() => onConnectionViewChange({ ...connectionView, focusTickers: [] })}
                style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 9, padding: 0, fontFamily: "inherit" }}
              >clear</button>
            )}
            {/* Saved focus lists — Pro only */}
            {isPro && onFocusListOpen && (
              <button
                onClick={onFocusListOpen}
                title="Saved focus lists"
                style={{
                  background: "none", border: "none",
                  color: "#475569", cursor: "pointer",
                  fontSize: 11, padding: "0 2px",
                  fontFamily: "inherit",
                  transition: "color 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#a855f7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#475569"; }}
              >
                ☆
              </button>
            )}
          </div>

          {/* Admin-only controls */}
          {isAdmin && editMode && (
            <button
              onClick={onAddSectorOpen}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6, color: "#94a3b8",
                fontSize: 11, fontWeight: 500,
                padding: "5px 12px", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + Add sector
            </button>
          )}
          {isAdmin && saveFailures.length > 0 && (
            <div style={{
              background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 6, color: "#ef4444", fontSize: 11, padding: "4px 10px",
              maxWidth: 240, lineHeight: 1.4,
            }}>
              ⚠ {saveFailures.length} node{saveFailures.length !== 1 ? "s" : ""} failed to save:
              {" "}{saveFailures.join(", ")}
            </div>
          )}
          {isAdmin && editMode && pendingCount > 0 && (
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
          {isAdmin && (
            <button
              onClick={handleToggleClick}
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
          )}
        </div>

        {/* Admin view toggle */}
        {isAdmin && (
          <button
            onClick={() => onAdminViewChange(!adminView)}
            style={{
              background: adminView ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
              border: adminView ? "1px solid rgba(168,85,247,0.4)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 6,
              color: adminView ? "#a855f7" : "#475569",
              fontSize: 10, fontWeight: 500,
              padding: "4px 10px", cursor: "pointer",
              fontFamily: "inherit", letterSpacing: "0.04em",
            }}
          >
            {adminView ? "◉ Admin view" : "Admin view"}
          </button>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div onClick={onContextMenuClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "fixed",
            left: Math.min(contextMenu.clientX, window.innerWidth - 200),
            top:  Math.min(contextMenu.clientY, window.innerHeight - 200),
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
            {contextMenu.type === "sector" && (
              <>
                <CtxItem onClick={() => { onEditSector(contextMenu.id); onContextMenuClose(); }}>
                  Edit sector
                </CtxItem>
                <CtxItem onClick={() => { onContextMenuClose(); }}>
                  Move sector (drag to reposition)
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

      {/* Exit confirm dialog */}
      {showExitConfirm && (
        <>
          <div
            onClick={() => setShowExitConfirm(false)}
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
            <div style={{ fontSize: 14, fontWeight: 500, color: "#f1f5f9", marginBottom: 10 }}>
              Unsaved changes
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              You have unsaved changes. Exit without saving?
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  background: "none", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6, color: "#64748b", fontSize: 12,
                  padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExit}
                style={{
                  background: "#ef4444", border: "none", borderRadius: 6,
                  color: "#fff", fontSize: 12, fontWeight: 500,
                  padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Exit
              </button>
            </div>
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

      {/* Sector add / edit form modal */}
      {showSectorForm && (
        <SectorFormModal
          mode={sectorFormMode}
          initial={editingSector}
          onClose={onSectorFormClose}
          onSubmit={onSectorFormSubmit}
        />
      )}
    </>
  );
}

// ─── Sector form modal ────────────────────────────────────────────────────────

function SectorFormModal({
  mode, initial, onClose, onSubmit,
}: {
  mode: "add" | "edit";
  initial: { id: string; name: string; etf: string; colour: string } | null;
  onClose: () => void;
  onSubmit: (name: string, etf: string, colour: string) => void;
}) {
  const [name,   setName]   = useState(initial?.name   ?? "");
  const [etf,    setEtf]    = useState(initial?.etf    ?? "");
  const [colour, setColour] = useState(initial?.colour ?? "#64748b");

  const valid = name.trim().length > 0 && etf.trim().length > 0;

  return (
    <>
      <div
        onClick={onClose}
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
          {mode === "add" ? "Add sector" : "Edit sector"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          {[
            { label: "Sector name", val: name, set: setName, placeholder: "e.g. Consumer" },
            { label: "ETF ticker",  val: etf,  set: setEtf,  placeholder: "e.g. XLY" },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 5 }}>
                {label}
              </label>
              <input
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                  color: "#f1f5f9", fontSize: 13, padding: "7px 10px",
                  fontFamily: "inherit", outline: "none",
                }}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 5 }}>
              Colour
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                style={{
                  width: 36, height: 36, padding: 2, borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "none", cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
                {colour}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6, color: "#64748b", fontSize: 12,
              padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (valid) onSubmit(name.trim(), etf.trim().toUpperCase(), colour); }}
            disabled={!valid}
            style={{
              background: "#3b82f6", border: "none", borderRadius: 6,
              color: "#fff", fontSize: 12, fontWeight: 500,
              padding: "6px 14px", fontFamily: "inherit",
              cursor: valid ? "pointer" : "not-allowed",
              opacity: valid ? 1 : 0.45,
            }}
          >
            {mode === "add" ? "Add sector" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Context menu item ────────────────────────────────────────────────────────

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
