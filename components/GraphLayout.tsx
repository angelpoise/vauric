"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import GraphCanvas, { type GraphCanvasHandle } from "@/components/GraphCanvas";
import SideMenu, { MENU_COLLAPSED_W, MENU_EXPANDED_W } from "@/components/SideMenu";
import HoverBar from "@/components/HoverBar";
import WatchlistPanel from "@/components/WatchlistPanel";
import AlertsPanel from "@/components/AlertsPanel";
import SearchPanel from "@/components/SearchPanel";
import FiltersPanel from "@/components/FiltersPanel";
import GraphSettingsPanel from "@/components/GraphSettingsPanel";
import GraphEditOverlay, { type ContextMenuInfo } from "@/components/GraphEditOverlay";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { type ActiveFilters, DEFAULT_FILTERS } from "@/lib/filtersTypes";
import {
  type GraphSettings,
  DEFAULT_GRAPH_SETTINGS,
  loadGraphSettings,
  saveGraphSettings,
} from "@/lib/graphSettingsTypes";
import type { GNode, SectorNode } from "@/lib/graphTypes";
import { adminFetch } from "@/lib/adminFetch";

// ─── Sector localStorage helpers ──────────────────────────────────────────────

const BUILT_IN_SECTORS: Array<Omit<SectorNode, "colour">> = [
  { id: "sec-tech",    kind: "sector", name: "Technology", etf: "XLK", price: 224.18, dailyMove:  1.2, x:  500, y: 420, notifications: [] },
  { id: "sec-energy",  kind: "sector", name: "Energy",     etf: "XLE", price:  93.42, dailyMove: -0.8, x: 1100, y: 360, notifications: [] },
  { id: "sec-health",  kind: "sector", name: "Healthcare", etf: "XLV", price: 143.76, dailyMove:  0.3, x:  440, y: 750, notifications: [] },
  { id: "sec-finance", kind: "sector", name: "Finance",    etf: "XLF", price:  45.21, dailyMove:  0.7, x: 1155, y: 710, notifications: [] },
];

type SectorPositions = Record<string, { x: number; y: number }>;
type SectorMeta = Record<string, { name: string; etf: string; colour: string; isCustom?: boolean }>;

function readSectorStorage(): { positions: SectorPositions; meta: SectorMeta } {
  try {
    return {
      positions: JSON.parse(localStorage.getItem("vauric_sector_positions") ?? "{}"),
      meta:      JSON.parse(localStorage.getItem("vauric_sector_meta")      ?? "{}"),
    };
  } catch {
    return { positions: {}, meta: {} };
  }
}

function loadSectors(): SectorNode[] {
  const { positions, meta } = readSectorStorage();

  const builtIn: SectorNode[] = BUILT_IN_SECTORS.map((s) => {
    const m = meta[s.id];
    return {
      ...s,
      ...(m ? { name: m.name, etf: m.etf, colour: m.colour } : {}),
      x: positions[s.id]?.x ?? s.x,
      y: positions[s.id]?.y ?? s.y,
    };
  });

  const custom: SectorNode[] = Object.entries(meta)
    .filter(([, v]) => v.isCustom)
    .map(([id, v]) => ({
      id,
      kind:  "sector" as const,
      name:  v.name,
      etf:   v.etf,
      colour: v.colour,
      price:  0,
      dailyMove: 0,
      x: positions[id]?.x ?? 800,
      y: positions[id]?.y ?? 550,
      notifications: [],
    }));

  return [...builtIn, ...custom];
}

function writeSectorPositions(pending: Record<string, { x: number; y: number }>) {
  try {
    const stored: SectorPositions = JSON.parse(
      localStorage.getItem("vauric_sector_positions") ?? "{}"
    );
    for (const [id, pos] of Object.entries(pending)) {
      if (id.startsWith("sec-")) stored[id] = pos;
    }
    localStorage.setItem("vauric_sector_positions", JSON.stringify(stored));
  } catch { /* ignore */ }
}

function writeSectorMeta(id: string, name: string, etf: string, colour: string, isCustom?: boolean) {
  try {
    const stored: SectorMeta = JSON.parse(localStorage.getItem("vauric_sector_meta") ?? "{}");
    stored[id] = { name, etf, colour, ...(isCustom ? { isCustom: true } : {}) };
    localStorage.setItem("vauric_sector_meta", JSON.stringify(stored));
  } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphLayout() {
  const { user } = useUser();

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
  const isAdmin = adminEmail !== "" &&
    user?.primaryEmailAddress?.emailAddress === adminEmail;

  const canvasRef = useRef<GraphCanvasHandle>(null);

  const [menuExpanded, setMenuExpanded]     = useState(false);
  const [hoveredNode, setHoveredNode]       = useState<GNode | null>(null);
  const [isSearchOpen, setIsSearchOpen]     = useState(false);
  const [isFiltersOpen, setIsFiltersOpen]   = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeFilters, setActiveFilters]   = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [graphSettings, setGraphSettings]   = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);
  const [alertsOpen, setAlertsOpen]         = useState(false);

  // Edit mode state
  const [editMode, setEditMode]                   = useState(false);
  const [pendingPositions, setPendingPositions]   = useState<Record<string, { x: number; y: number }>>({});
  const [saving, setSaving]                       = useState(false);
  const [contextMenu, setContextMenu]             = useState<ContextMenuInfo | null>(null);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false);
  const [connectionPromptPreset, setConnectionPromptPreset] = useState<string | undefined>();
  const [knownTickers, setKnownTickers]           = useState<string[]>([]);

  // Sector state (loaded from localStorage on first render)
  const [sectors, setSectors] = useState<SectorNode[]>(() => {
    if (typeof window === "undefined") return BUILT_IN_SECTORS as SectorNode[];
    return loadSectors();
  });

  // Sector form state
  const [showSectorForm, setShowSectorForm] = useState(false);
  const [sectorFormMode, setSectorFormMode] = useState<"add" | "edit">("add");
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);

  const editingSector = editingSectorId
    ? (sectors.find((s) => s.id === editingSectorId) ?? null)
    : null;

  const menuW = menuExpanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

  // Load persisted graph settings on mount
  useEffect(() => {
    const s = loadGraphSettings();
    setGraphSettings(s);
    setActiveFilters((prev) => ({ ...prev, nodeSize: s.nodeSize }));
  }, []);

  // "/" shortcut opens search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      setIsSearchOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSettingsChange(s: GraphSettings) {
    setGraphSettings(s);
    saveGraphSettings(s);
    setActiveFilters((prev) => ({ ...prev, nodeSize: s.nodeSize }));
  }

  function handleSettingsOpen() {
    setIsSettingsOpen((o) => { if (!o) setIsFiltersOpen(false); return !o; });
  }

  function handleFiltersOpen() {
    setIsFiltersOpen((o) => { if (!o) setIsSettingsOpen(false); return !o; });
  }

  // ── Edit mode handlers ──────────────────────────────────────────────────────

  const handleNodeDragEnd = useCallback((nodeId: string, x: number, y: number) => {
    setPendingPositions((prev) => ({ ...prev, [nodeId]: { x, y } }));
  }, []);

  const handleContextMenu = useCallback((info: ContextMenuInfo) => {
    setContextMenu(info);
  }, []);

  const handleShiftEmptyClick = useCallback(() => {
    setConnectionPromptPreset(undefined);
    setShowConnectionPrompt(true);
  }, []);

  const handleGraphLoaded = useCallback((tickers: string[]) => {
    setKnownTickers(tickers);
  }, []);

  // Enter edit mode: take a position snapshot so we can restore on discard
  function handleToggleEdit() {
    if (!editMode) {
      canvasRef.current?.snapshotPositions();
      setEditMode(true);
      setContextMenu(null);
    } else {
      // No pending changes — safe to exit directly
      canvasRef.current?.restorePositions();
      setPendingPositions({});
      setEditMode(false);
      setContextMenu(null);
    }
  }

  // Called when the user confirms "Exit without saving" from the overlay dialog
  function handleExitConfirmed() {
    canvasRef.current?.restorePositions();
    setPendingPositions({});
    setEditMode(false);
    setContextMenu(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const stockEntries = Object.entries(pendingPositions).filter(([id]) => !id.startsWith("sec-"));
      const sectorEntries = Object.entries(pendingPositions).filter(([id]) => id.startsWith("sec-"));

      await Promise.all(
        stockEntries.map(([ticker, { x, y }]) =>
          adminFetch(`/api/admin/stocks/${ticker}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              x_position: x / 1600,
              y_position: y / 1100,
            }),
          })
        )
      );

      if (sectorEntries.length > 0) {
        const pending: Record<string, { x: number; y: number }> = {};
        for (const [id, pos] of sectorEntries) pending[id] = pos;
        writeSectorPositions(pending);
        // Update sectors state so positions are reflected
        setSectors((prev) => prev.map((s) => {
          const p = pending[s.id];
          return p ? { ...s, x: p.x, y: p.y } : s;
        }));
      }

      setPendingPositions({});
      // Update snapshot so any further drags revert to the newly saved positions
      canvasRef.current?.snapshotPositions();
      // Invalidate the /api/graph Next.js cache so the next page load
      // fetches fresh positions from the database rather than the stale cache.
      adminFetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNode(ticker: string) {
    await adminFetch(`/api/admin/stocks/${ticker}`, { method: "DELETE" });
    setPendingPositions((prev) => {
      const next = { ...prev };
      delete next[ticker];
      return next;
    });
  }

  async function handleDeleteEdge(tickerA: string, tickerB: string) {
    await adminFetch("/api/admin/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker_a: tickerA, ticker_b: tickerB }),
    });
  }

  async function handleAddConnection(tickerA: string, tickerB: string) {
    await adminFetch("/api/admin/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker_a: tickerA, ticker_b: tickerB }),
    });
  }

  // ── Sector management ───────────────────────────────────────────────────────

  const handleEditSector = useCallback((sectorId: string) => {
    setEditingSectorId(sectorId);
    setSectorFormMode("edit");
    setShowSectorForm(true);
  }, []);

  const handleAddSectorOpen = useCallback(() => {
    setEditingSectorId(null);
    setSectorFormMode("add");
    setShowSectorForm(true);
  }, []);

  const handleSectorFormClose = useCallback(() => {
    setShowSectorForm(false);
    setEditingSectorId(null);
  }, []);

  function handleSectorFormSubmit(name: string, etf: string, colour: string) {
    if (sectorFormMode === "add") {
      const id = `sec-custom-${Date.now()}`;
      writeSectorMeta(id, name, etf, colour, true);
      const newSector: SectorNode = {
        id, kind: "sector", name, etf, colour,
        price: 0, dailyMove: 0,
        x: 800, y: 550,
        notifications: [],
      };
      setSectors((prev) => [...prev, newSector]);
    } else if (editingSectorId) {
      writeSectorMeta(editingSectorId, name, etf, colour,
        !BUILT_IN_SECTORS.some((s) => s.id === editingSectorId));
      setSectors((prev) => prev.map((s) =>
        s.id === editingSectorId ? { ...s, name, etf, colour } : s
      ));
    }
    handleSectorFormClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07090f", overflow: "hidden" }}>
      <SideMenu
        expanded={menuExpanded}
        onToggle={() => setMenuExpanded((e) => !e)}
        onSearchOpen={() => setIsSearchOpen(true)}
        onFiltersOpen={handleFiltersOpen}
        onSettingsOpen={handleSettingsOpen}
      />

      {/* Canvas container */}
      <div
        style={{
          position: "absolute",
          top: 0, left: menuW, right: 0, bottom: 0,
          clipPath: disclaimerVisible ? "inset(0 0 44px 0)" : "inset(0 0 0px 0)",
          transition: "left 0.22s ease, clip-path 0.3s ease",
        }}
      >
        <GraphCanvas
          ref={canvasRef}
          onHover={setHoveredNode}
          activeFilters={activeFilters}
          graphSettings={graphSettings}
          editMode={editMode}
          sectorNodes={sectors}
          onNodeDragEnd={handleNodeDragEnd}
          onContextMenu={handleContextMenu}
          onShiftEmptyClick={handleShiftEmptyClick}
          onGraphLoaded={handleGraphLoaded}
        />
      </div>

      <HoverBar node={isFiltersOpen || isSettingsOpen || editMode ? null : hoveredNode} leftOffset={menuW} />

      <FiltersPanel
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={activeFilters}
        onFiltersChange={setActiveFilters}
      />

      <GraphSettingsPanel
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={graphSettings}
        onSettingsChange={handleSettingsChange}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />

      {isAdmin && (
        <GraphEditOverlay
          editMode={editMode}
          pendingCount={Object.keys(pendingPositions).length}
          knownTickers={knownTickers}
          contextMenu={contextMenu}
          showConnectionPrompt={showConnectionPrompt}
          connectionPromptPreset={connectionPromptPreset}
          saving={saving}
          onToggleEdit={handleToggleEdit}
          onExitConfirmed={handleExitConfirmed}
          onSave={handleSave}
          onContextMenuClose={() => setContextMenu(null)}
          onDeleteNode={handleDeleteNode}
          onDeleteEdge={handleDeleteEdge}
          onAddConnection={handleAddConnection}
          onConnectionPromptOpen={(preset) => {
            setConnectionPromptPreset(preset);
            setShowConnectionPrompt(true);
          }}
          onConnectionPromptClose={() => setShowConnectionPrompt(false)}
          onEditSector={handleEditSector}
          onAddSectorOpen={handleAddSectorOpen}
          showSectorForm={showSectorForm}
          sectorFormMode={sectorFormMode}
          editingSector={editingSector ? {
            id:     editingSector.id,
            name:   editingSector.name,
            etf:    editingSector.etf,
            colour: editingSector.colour ?? "#64748b",
          } : null}
          onSectorFormClose={handleSectorFormClose}
          onSectorFormSubmit={handleSectorFormSubmit}
        />
      )}

      <AlertsPanel onOpenChange={setAlertsOpen} />
      <WatchlistPanel isAlertsOpen={alertsOpen} />

      {isSearchOpen && <SearchPanel onClose={() => setIsSearchOpen(false)} />}

      <DisclaimerBanner onVisibilityChange={setDisclaimerVisible} leftOffset={menuW} />
    </div>
  );
}
