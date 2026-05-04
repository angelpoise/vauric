"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";

const NAV = [
  { href: "/admin",               label: "Dashboard"     },
  { href: "/admin/nodes",         label: "Nodes"         },
  { href: "/admin/connections",   label: "Connections"   },
  { href: "/admin/pipeline",      label: "Pipeline"      },
  { href: "/admin/notifications", label: "Notifications" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav
      style={{
        background: "#0d1117",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        gap: 4,
        height: 52,
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
      }}
    >
      <Link href="/graph" style={{ textDecoration: "none", marginRight: 20, flexShrink: 0 }}>
        <Logo variant="default" />
      </Link>
      {NAV.map(({ href, label }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            style={{
              fontSize: 13,
              color: active ? "#f1f5f9" : "#475569",
              textDecoration: "none",
              fontWeight: active ? 500 : 400,
              padding: "4px 12px",
              borderRadius: 6,
              background: active ? "rgba(255,255,255,0.05)" : "transparent",
            }}
          >
            {label}
          </Link>
        );
      })}

      <div style={{ marginLeft: "auto" }}>
        <Link
          href="/graph"
          style={{ fontSize: 12, color: "#334155", textDecoration: "none" }}
        >
          ← Back to app
        </Link>
      </div>
    </nav>
  );
}
