"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SideMenu, { MENU_COLLAPSED_W, MENU_EXPANDED_W } from "@/components/SideMenu";

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const menuW = expanded ? MENU_EXPANDED_W : MENU_COLLAPSED_W;

  return (
    <>
      <SideMenu
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
        onSearchOpen={() => router.push("/graph")}
        onFiltersOpen={() => router.push("/graph")}
        onSettingsOpen={() => router.push("/graph")}
      />
      <div
        style={{
          marginLeft: menuW,
          transition: "margin-left 0.22s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
