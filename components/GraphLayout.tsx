"use client";

import { useState, useEffect } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import SideMenu, { MENU_COLLAPSED_W, MENU_EXPANDED_W } from "@/components/SideMenu";
import HoverBar from "@/components/HoverBar";
import WatchlistPanel from "@/components/WatchlistPanel";
import SearchPanel from "@/components/SearchPanel";
import FiltersPanel from "@/components/FiltersPanel";
import { type ActiveFilters, DEFAULT_FILTERS } from "@/lib/filtersTypes";
import type { GNode } from "@/lib/graphTypes";

export default function GraphLayout() {
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(DEFAULT_FILTERS);

  const menuW = menuExpanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

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

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07090f", overflow: "hidden" }}>
      <SideMenu
        expanded={menuExpanded}
        onToggle={() => setMenuExpanded((e) => !e)}
        onSearchOpen={() => setIsSearchOpen(true)}
        onFiltersOpen={() => setIsFiltersOpen((o) => !o)}
      />

      {/* Canvas container shifts right to clear the menu */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: menuW,
          right: 0,
          bottom: 0,
          transition: "left 0.22s ease",
        }}
      >
        <GraphCanvas onHover={setHoveredNode} activeFilters={activeFilters} />
      </div>

      <HoverBar node={isFiltersOpen ? null : hoveredNode} leftOffset={menuW} />

      <FiltersPanel
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={activeFilters}
        onFiltersChange={setActiveFilters}
      />

      <WatchlistPanel />

      {isSearchOpen && <SearchPanel onClose={() => setIsSearchOpen(false)} />}
    </div>
  );
}
