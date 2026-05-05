"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import GraphCanvas from "@/components/GraphCanvas";
import SideMenu, { MENU_COLLAPSED_W, MENU_EXPANDED_W } from "@/components/SideMenu";
import HoverBar from "@/components/HoverBar";
import WatchlistPanel from "@/components/WatchlistPanel";
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
import type { GNode } from "@/lib/graphTypes";
import { adminFetch } from "@/lib/adminFetch";

export default function GraphLayout() {
  const { user } = useUser();

  // Admin check — client-side, uses the NEXT_PUBLIC_ env var
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";
  const isAdmin = adminEmail !== "" &&
    user?.primaryEmailAddress?.emailAddress === adminEmail;

  const [menuExpanded, setMenuExpanded]     = useState(false);
  const [hoveredNode, setHoveredNode]       = useState<GNode | null>(null);
  const [isSearchOpen, setIsSearchOpen]     = useState(false);
  const [isFiltersOpen, setIsFiltersOpen]   = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeFilters, setActiveFilters]   = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [graphSettings, setGraphSettings]   = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  // Edit mode state
  const [editMode, setEditMode]                   = useState(false);
  const [pendingPositions, setPendingPositions]   = useState<Record<string, { x: number; y: number }>>({});
  const [saving, setSaving]                       = useState(false);
  const [contextMenu, setContextMenu]             = useState<ContextMenuInfo | null>(null);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false);
  const [connectionPromptPreset, setConnectionPromptPreset] = useState<string | undefined>();
  const [knownTickers, setKnownTickers]           = useState<string[]>([]);

  const menuW = menuExpanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

  // Load persisted graph settings on mount; sync nodeSize into activeFilters
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

  const handleNodeDragEnd = useCallback((ticker: string, x: number, y: number) => {
    setPendingPositions((prev) => ({ ...prev, [ticker]: { x, y } }));
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

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(pendingPositions).map(([ticker, { x, y }]) =>
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
      setPendingPositions({});
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNode(ticker: string) {
    await adminFetch(`/api/admin/stocks/${ticker}`, { method: "DELETE" });
    // Remove from pending positions if present
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
          onHover={setHoveredNode}
          activeFilters={activeFilters}
          graphSettings={graphSettings}
          editMode={editMode}
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
          onToggleEdit={() => {
            setEditMode((m) => !m);
            setContextMenu(null);
            setPendingPositions({});
          }}
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
        />
      )}

      <WatchlistPanel />

      {isSearchOpen && <SearchPanel onClose={() => setIsSearchOpen(false)} />}

      <DisclaimerBanner onVisibilityChange={setDisclaimerVisible} leftOffset={menuW} />
    </div>
  );
}
