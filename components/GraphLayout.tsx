"use client";

import { useState, useEffect } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import SideMenu, { MENU_COLLAPSED_W, MENU_EXPANDED_W } from "@/components/SideMenu";
import HoverBar from "@/components/HoverBar";
import WatchlistPanel from "@/components/WatchlistPanel";
import SearchPanel from "@/components/SearchPanel";
import FiltersPanel from "@/components/FiltersPanel";
import GraphSettingsPanel from "@/components/GraphSettingsPanel";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { type ActiveFilters, DEFAULT_FILTERS } from "@/lib/filtersTypes";
import {
  type GraphSettings,
  DEFAULT_GRAPH_SETTINGS,
  loadGraphSettings,
  saveGraphSettings,
} from "@/lib/graphSettingsTypes";
import type { GNode } from "@/lib/graphTypes";

export default function GraphLayout() {
  const [menuExpanded, setMenuExpanded]     = useState(false);
  const [hoveredNode, setHoveredNode]       = useState<GNode | null>(null);
  const [isSearchOpen, setIsSearchOpen]     = useState(false);
  const [isFiltersOpen, setIsFiltersOpen]   = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeFilters, setActiveFilters]   = useState<ActiveFilters>(DEFAULT_FILTERS);
  const [graphSettings, setGraphSettings]   = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [disclaimerVisible, setDisclaimerVisible] = useState(false);

  const menuW = menuExpanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

  // Load persisted graph settings on mount; sync nodeSize into activeFilters
  useEffect(() => {
    const s = loadGraphSettings();
    setGraphSettings(s);
    setActiveFilters((prev) => ({ ...prev, nodeSize: s.nodeSize }));
  }, []);

  // "/" shortcut opens search when not typing in an input
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
    // Keep activeFilters.nodeSize in sync so GraphCanvas reads correctly via activeFiltersRef
    setActiveFilters((prev) => ({ ...prev, nodeSize: s.nodeSize }));
  }

  function handleSettingsOpen() {
    setIsSettingsOpen((o) => {
      if (!o) setIsFiltersOpen(false); // close filters when opening settings
      return !o;
    });
  }

  function handleFiltersOpen() {
    setIsFiltersOpen((o) => {
      if (!o) setIsSettingsOpen(false); // close settings when opening filters
      return !o;
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

      {/* Canvas container shifts right to clear the menu */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: menuW,
          right: 0,
          bottom: 0,
          clipPath: disclaimerVisible ? "inset(0 0 44px 0)" : "inset(0 0 0px 0)",
          transition: "left 0.22s ease, clip-path 0.3s ease",
        }}
      >
        <GraphCanvas
          onHover={setHoveredNode}
          activeFilters={activeFilters}
          graphSettings={graphSettings}
        />
      </div>

      <HoverBar node={isFiltersOpen || isSettingsOpen ? null : hoveredNode} leftOffset={menuW} />

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

      <WatchlistPanel />

      {isSearchOpen && <SearchPanel onClose={() => setIsSearchOpen(false)} />}

      <DisclaimerBanner onVisibilityChange={setDisclaimerVisible} leftOffset={menuW} />
    </div>
  );
}
