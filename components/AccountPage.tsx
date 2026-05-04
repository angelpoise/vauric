"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import UpgradeButton from "@/components/UpgradeButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "profile" | "notifications" | "danger";

interface Prefs {
  email_news: boolean;
  email_analyst: boolean;
  email_squeeze: boolean;
  email_delisting: boolean;
  email_split: boolean;
  email_earnings: boolean;
  email_ipo: boolean;
  daily_digest: boolean;
}

const DEFAULT_PREFS: Prefs = {
  email_news: true,
  email_analyst: true,
  email_squeeze: true,
  email_delisting: true,
  email_split: true,
  email_earnings: true,
  email_ipo: true,
  daily_digest: false,
};

const NOTIF_FIELDS: { field: keyof Omit<Prefs, "daily_digest">; label: string; color: string }[] = [
  { field: "email_news",      label: "News",                   color: "#facc15" },
  { field: "email_analyst",   label: "Analyst action",         color: "#f97316" },
  { field: "email_squeeze",   label: "Short squeeze",          color: "#ef4444" },
  { field: "email_delisting", label: "Delisting / Acquisition",color: "#a855f7" },
  { field: "email_split",     label: "Split / Offering",       color: "#3b82f6" },
  { field: "email_earnings",  label: "Earnings",               color: "#ffffff" },
  { field: "email_ipo",       label: "IPO",                    color: "#22c55e" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("profile");

  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>;
  const isPro = meta.isPro === true;

  if (!isLoaded) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#475569", fontSize: 13, padding: "80px 0", textAlign: "center" }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#475569", fontSize: 13, padding: "80px 0", textAlign: "center" }}>
          Please sign in to view your account.
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "profile",       label: "Profile" },
    { id: "notifications", label: "Notifications" },
    { id: "danger",        label: "Danger zone" },
  ];

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 80px" }}>

        <h1 style={{ fontSize: 28, fontWeight: 600, color: "#f1f5f9", margin: "0 0 24px" }}>
          Account
        </h1>

        {/* Tab bar */}
        <div style={{
          display: "flex", gap: 2, marginBottom: 32,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: "9px 16px", background: "none", border: "none",
                  cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                  fontWeight: active ? 500 : 400,
                  color: active ? (id === "danger" ? "#ef4444" : "#3b82f6") : "#475569",
                  borderBottom: active
                    ? `2px solid ${id === "danger" ? "#ef4444" : "#3b82f6"}`
                    : "2px solid transparent",
                  marginBottom: -1, transition: "color 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "profile"       && <ProfileTab user={user} isPro={isPro} />}
        {tab === "notifications" && <NotificationsTab userId={user.id} />}
        {tab === "danger"        && <DangerTab userId={user.id} onDeleted={() => router.push("/")} />}
      </div>
    </div>
  );
}

// ─── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab({ user, isPro }: { user: ReturnType<typeof useUser>["user"]; isPro: boolean }) {
  const email = user?.primaryEmailAddress?.emailAddress ?? "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Email */}
      <Card>
        <Label>Email address</Label>
        <p style={{ fontSize: 14, color: "#94a3b8", margin: 0 }}>{email}</p>
      </Card>

      {/* Subscription */}
      <Card>
        <Label>Subscription</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span
            style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 12, fontWeight: 500,
              background: isPro ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.05)",
              border: isPro ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.1)",
              color: isPro ? "#3b82f6" : "#475569",
            }}
          >
            {isPro ? "Pro" : "Free"}
          </span>
          {isPro && (
            <span style={{ fontSize: 12, color: "#334155" }}>Active subscription</span>
          )}
        </div>
        {!isPro && (
          <div style={{ marginBottom: 4 }}>
            <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px" }}>
              Upgrade to Pro for unlimited news, AI summaries, and unlimited watchlist.
            </p>
          </div>
        )}
        <UpgradeButton label="Upgrade to Pro" />
      </Card>
    </div>
  );
}

// ─── Notifications tab ────────────────────────────────────────────────────────

function NotificationsTab({ userId }: { userId: string }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/account/preferences?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setPrefs({ ...DEFAULT_PREFS, ...data }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function toggle(field: keyof Prefs) {
    const next = { ...prefs, [field]: !prefs[field] };
    setPrefs(next);
    setSaving(true);
    try {
      await fetch("/api/account/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...next }),
      });
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  if (loading) {
    return <p style={{ color: "#475569", fontSize: 13 }}>Loading preferences…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Email alerts */}
      <Card>
        <Label>Email alerts</Label>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 16px" }}>
          Send me an email when a watchlisted stock has:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NOTIF_FIELDS.map(({ field, label, color }) => (
            <PrefRow
              key={field}
              label={label}
              dot={color}
              on={prefs[field]}
              onToggle={() => toggle(field)}
              disabled={saving}
            />
          ))}
        </div>
      </Card>

      {/* Daily digest */}
      <Card>
        <Label>Daily digest</Label>
        <PrefRow
          label="Send me a daily summary of watchlist activity at market close (4pm ET)"
          on={prefs.daily_digest}
          onToggle={() => toggle("daily_digest")}
          disabled={saving}
        />
      </Card>
    </div>
  );
}

// ─── Danger zone tab ──────────────────────────────────────────────────────────

function DangerTab({ userId, onDeleted }: { userId: string; onDeleted: () => void }) {
  const [input, setInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (input !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to delete account.");
        return;
      }
      onDeleted();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card style={{ borderColor: "rgba(239,68,68,0.2)" }}>
      <Label style={{ color: "#ef4444" }}>Delete account</Label>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px", lineHeight: 1.6 }}>
        This will permanently delete your account and all your data. This cannot be undone.
      </p>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "#475569", display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Type DELETE to confirm
        </label>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="DELETE"
          style={{
            background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 7, padding: "9px 12px", width: "100%",
            fontSize: 13, color: "#f1f5f9", fontFamily: "inherit",
            outline: "none",
          }}
        />
      </div>
      {error && (
        <p style={{ fontSize: 12, color: "#ef4444", margin: "0 0 12px" }}>{error}</p>
      )}
      <button
        onClick={handleDelete}
        disabled={input !== "DELETE" || deleting}
        style={{
          padding: "9px 20px", background: "#ef4444", border: "none",
          borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 500,
          cursor: input === "DELETE" && !deleting ? "pointer" : "not-allowed",
          fontFamily: "inherit", opacity: input === "DELETE" && !deleting ? 1 : 0.4,
          transition: "opacity 0.15s",
        }}
      >
        {deleting ? "Deleting…" : "Delete my account"}
      </button>
    </Card>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10, padding: "20px 20px 18px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "#475569",
        margin: "0 0 10px", ...style,
      }}
    >
      {children}
    </p>
  );
}

function PrefRow({
  label, dot, on, onToggle, disabled,
}: {
  label: string;
  dot?: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: "100%", padding: "8px 0",
        display: "flex", alignItems: "center", gap: 10,
        background: "none", border: "none", cursor: disabled ? "default" : "pointer",
        textAlign: "left", fontFamily: "inherit", opacity: disabled ? 0.6 : 1,
      }}
    >
      {dot && (
        <span
          style={{
            width: 10, height: 10, borderRadius: "50%",
            background: dot, flexShrink: 0,
            opacity: on ? 1 : 0.3, transition: "opacity 0.15s",
          }}
        />
      )}
      <span style={{ flex: 1, fontSize: 13, color: on ? "#e2e8f0" : "#475569", transition: "color 0.12s" }}>
        {label}
      </span>
      {/* Toggle pill */}
      <div
        style={{
          width: 32, height: 18, borderRadius: 9, flexShrink: 0,
          background: on ? "#3b82f6" : "rgba(255,255,255,0.1)",
          position: "relative", transition: "background 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute", top: 3,
            left: on ? 17 : 3,
            width: 12, height: 12, borderRadius: "50%",
            background: on ? "#fff" : "#475569",
            transition: "left 0.2s, background 0.2s",
          }}
        />
      </div>
    </button>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#07090f",
  fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
  color: "#f1f5f9",
};
