"use client";

import { useState } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import SideMenu, { MENU_COLLAPSED_W, MENU_EXPANDED_W } from "@/components/SideMenu";
import HoverBar from "@/components/HoverBar";
import WatchlistPanel from "@/components/WatchlistPanel";
import type { GNode } from "@/lib/graphTypes";

export default function GraphLayout() {
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);

  const menuW = menuExpanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#07090f", overflow: "hidden" }}>
      <SideMenu
        expanded={menuExpanded}
        onToggle={() => setMenuExpanded((e) => !e)}
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
        <GraphCanvas onHover={setHoveredNode} />
      </div>

      <HoverBar node={hoveredNode} leftOffset={menuW} />

      <WatchlistPanel />
    </div>
  );
}
