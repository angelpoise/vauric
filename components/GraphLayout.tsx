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
import { type ConnectionView } from "@/components/GraphCanvas";

// ─── Sector localStorage helpers ──────────────────────────────────────────────

const BUILT_IN_SECTORS: Array<Omit<SectorNode, "colour">> = [
  { id: "XLK",  kind: "sector", name: "Information Technology", etf: "XLK",  price: 224.18, dailyMove:  1.2, x:  500, y: 420, notifications: [] },
  { id: "XLE",  kind: "sector", name: "Energy",             etf: "XLE",  price:  93.42, dailyMove: -0.8, x: 1100, y: 360, notifications: [] },
  { id: "XLV",  kind: "sector", name: "Healthcare",         etf: "XLV",  price: 143.76, dailyMove:  0.3, x:  440, y: 750, notifications: [] },
  { id: "XLF",  kind: "sector", name: "Financials",          etf: "XLF",  price:  45.21, dailyMove:  0.7, x: 1155, y: 710, notifications: [] },
  { id: "XLI",  kind: "sector", name: "Industrials",        etf: "XLI",  price:  62.00, dailyMove:  0.0, x:  800, y: 165, notifications: [] },
  { id: "XLP",  kind: "sector", name: "Consumer Staples",   etf: "XLP",  price:   0.00, dailyMove:  0.0, x:  640, y: 935, notifications: [] },
  { id: "XLY",  kind: "sector", name: "Consumer Discr.",    etf: "XLY",  price:  72.00, dailyMove:  0.0, x:  960, y: 935, notifications: [] },
  { id: "XLC",  kind: "sector", name: "Communication",      etf: "XLC",  price:  80.00, dailyMove:  0.0, x: 1360, y: 550, notifications: [] },
  { id: "XLB",  kind: "sector", name: "Materials",          etf: "XLB",  price:  85.00, dailyMove:  0.0, x:  240, y: 550, notifications: [] },
  { id: "XLRE", kind: "sector", name: "Real Estate",        etf: "XLRE", price:  42.00, dailyMove:  0.0, x:  320, y: 935, notifications: [] },
  { id: "XLU",  kind: "sector", name: "Utilities",          etf: "XLU",  price:  68.00, dailyMove:  0.0, x: 1280, y: 165, notifications: [] },
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

  const builtInIds = new Set(BUILT_IN_SECTORS.map((s) => s.id));
  const custom: SectorNode[] = Object.entries(meta)
    .filter(([id, v]) => v.isCustom && !builtInIds.has(id))
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

function writeHierarchyPositions(pending: Record<string, { x: number; y: number }>) {
  try {
    const stored: SectorPositions = JSON.parse(
      localStorage.getItem("vauric_sector_positions") ?? "{}"
    );
    for (const [id, pos] of Object.entries(pending)) stored[id] = pos;
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

  // Connection view
  const [connectionView, setConnectionView] = useState<ConnectionView>("primary");

  // Edit mode state
  const [editMode, setEditMode]                   = useState(false);
  const [pendingPositions, setPendingPositions]   = useState<Record<string, { x: number; y: number }>>({});
  const [saving, setSaving]                       = useState(false);
  const [saveFailures, setSaveFailures]           = useState<string[]>([]);
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
      // PATCH every pending position to the DB regardless of node type.
      // The PATCH handler resolves by: UUID → ticker → etf_ticker → company_name,
      // so stocks, sectors (XLK), subsectors (Semiconductors) and subsubsectors
      // all persist correctly. Previously hierarchy nodes only went to localStorage
      // and were overridden by DB positions on every refresh.
      const results = await Promise.allSettled(
        Object.entries(pendingPositions).map(([id, { x, y }]) =>
          adminFetch(`/api/admin/stocks/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ x_position: x / 1600, y_position: y / 1100 }),
          }).then(async (r) => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({}));
              console.error(`[graph/save] PATCH failed for ${id}: ${r.status}`, body);
            }
            return r;
          })
        )
      );

      // Count both network rejections and HTTP error responses as failures
      const failures: string[] = [];
      results.forEach((r, i) => {
        const id = Object.keys(pendingPositions)[i];
        if (r.status === "rejected") failures.push(id);
        else if (!r.value.ok)        failures.push(id);
      });
      if (failures.length > 0) {
        console.error(`[graph/save] failed to save positions for:`, failures);
        setSaveFailures(failures);
        setTimeout(() => setSaveFailures([]), 6000);
      }

      writeHierarchyPositions(pendingPositions);
      setPendingPositions({});
      canvasRef.current?.snapshotPositions();
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
          connectionView={connectionView}
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
          connectionView={connectionView}
          onConnectionViewChange={setConnectionView}
          saveFailures={saveFailures}
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

      {isSearchOpen && (
        <SearchPanel
          onClose={() => setIsSearchOpen(false)}
          onZoomToNode={(nodeId) => {
            canvasRef.current?.zoomToNode(nodeId);
            setIsSearchOpen(false);
          }}
        />
      )}

      <DisclaimerBanner onVisibilityChange={setDisclaimerVisible} leftOffset={menuW} />
    </div>
  );
}
