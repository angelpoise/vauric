"use client";

import { useState } from "react";
import { useUser, useAuth } from "@clerk/nextjs";

interface Props {
  label?: string;
  couponCode?: string;
  variant?: "button" | "banner";
}

export default function UpgradeButton({
  label = "Upgrade to Pro",
  couponCode,
  variant = "button",
}: Props) {
  const { user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPro =
    (user?.publicMetadata as Record<string, unknown> | undefined)?.isPro === true;

  const isBanner = variant === "banner";

  async function handleClick() {
    setError(null);

    // Not signed in — send to Clerk sign-in, return here afterwards
    if (isLoaded && !user) {
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`;
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const endpoint = isPro ? "/api/stripe/portal" : "/api/stripe/checkout";
      const body = isPro
        ? {}
        : {
            userId: user!.id,
            userEmail: user!.primaryEmailAddress?.emailAddress ?? "",
            couponCode,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { /* empty 500 body */ }

      console.log("[UpgradeButton] response — status:", res.status, "data:", data);

      if (!res.ok || !data.url) {
        setError(data.error as string ?? "Something went wrong. Please try again.");
        return;
      }

      window.location.href = data.url as string;
    } catch (err) {
      console.error("[UpgradeButton] fetch error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: isBanner ? "block" : "inline-block" }}>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display: "inline-block",
          width: isBanner ? "100%" : undefined,
          padding: isBanner ? "7px 0" : "8px 20px",
          background: "#3b82f6",
          border: "none",
          borderRadius: isBanner ? 6 : 7,
          color: "#fff",
          fontSize: isBanner ? 12 : 13,
          fontWeight: 500,
          cursor: loading ? "wait" : "pointer",
          fontFamily: "inherit",
          opacity: loading ? 0.7 : 1,
          transition: "opacity 0.12s, background 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#2563eb";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#3b82f6";
        }}
      >
        {loading ? "…" : isPro ? "Manage subscription" : label}
      </button>
      {error && (
        <div style={{
          fontSize: 11,
          color: "#ef4444",
          marginTop: 6,
          textAlign: isBanner ? "center" : "left",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
