"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import UpgradeButton from "@/components/UpgradeButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "profile" | "notifications" | "alerts" | "theses" | "danger";

interface Prefs {
  email_news: boolean;
  email_analyst: boolean;
  email_delisting: boolean;
  email_split: boolean;
  email_earnings: boolean;
  email_ipo: boolean;
  digest_frequency: "daily" | "weekly" | "none";
}

const DEFAULT_PREFS: Prefs = {
  email_news: true,
  email_analyst: true,
  email_delisting: true,
  email_split: true,
  email_earnings: true,
  email_ipo: true,
  digest_frequency: "weekly",
};

const NOTIF_FIELDS: { field: keyof Omit<Prefs, "digest_frequency">; label: string; color: string }[] = [
  { field: "email_news",      label: "News",                   color: "#facc15" },
  { field: "email_analyst",   label: "Analyst action",         color: "#f97316" },
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
    { id: "alerts",        label: "Alert history" },
    { id: "theses",        label: "Theses" },
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
        {tab === "alerts"        && <AlertHistoryTab userId={user.id} isPro={isPro} />}
        {tab === "theses"        && <ThesesTab userId={user.id} isPro={isPro} />}
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
  const { getToken } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) =>
      fetch(`/api/account/preferences?userId=${encodeURIComponent(userId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    )
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data) setPrefs({ ...DEFAULT_PREFS, ...data }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    setSaving(true);
    try {
      const token = await getToken();
      await fetch("/api/account/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, ...next }),
      });
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  function toggle(field: keyof Omit<Prefs, "digest_frequency">) {
    savePrefs({ ...prefs, [field]: !prefs[field] });
  }

  function setFrequency(freq: Prefs["digest_frequency"]) {
    savePrefs({ ...prefs, digest_frequency: freq });
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

      {/* Digest frequency */}
      <Card>
        <Label>Market close digest</Label>
        <p style={{ fontSize: 12, color: "#475569", margin: "0 0 12px", lineHeight: 1.5 }}>
          Summary of your portfolio moves and price alerts at market close (4pm ET).
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {(["daily", "weekly", "none"] as const).map((opt) => {
            const active = prefs.digest_frequency === opt;
            return (
              <button
                key={opt}
                onClick={() => !saving && setFrequency(opt)}
                disabled={saving}
                style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  cursor: saving ? "default" : "pointer", fontFamily: "inherit",
                  border: active ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
                  color: active ? "#60a5fa" : "#475569",
                  textTransform: "capitalize",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ─── Danger zone tab ──────────────────────────────────────────────────────────

function DangerTab({ userId, onDeleted }: { userId: string; onDeleted: () => void }) {
  const { getToken } = useAuth();
  const [input, setInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (input !== "DELETE") return;
    setDeleting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

// ─── Alert history tab ────────────────────────────────────────────────────────

interface TriggeredAlert {
  id: string;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  triggered_at: string | null;
  created_at: string;
}

function AlertHistoryTab({ userId, isPro }: { userId: string; isPro: boolean }) {
  const { getToken } = useAuth();
  const [alerts, setAlerts]   = useState<TriggeredAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices]   = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isPro) { setLoading(false); return; }
    let cancelled = false;
    getToken().then((token) =>
      fetch(`/api/alerts?userId=${encodeURIComponent(userId)}&history=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    )
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { if (!cancelled) setAlerts(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    fetch("/api/market-data")
      .then((r) => r.ok ? r.json() : null)
      .then((md) => {
        if (!md || cancelled) return;
        const p: Record<string, number> = {};
        for (const [t, v] of Object.entries(md)) p[t] = (v as { price: number }).price;
        setPrices(p);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [userId, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function deleteAlert(id: string) {
    const token = await getToken();
    await fetch(`/api/alerts?id=${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  if (!isPro) {
    return (
      <Card>
        <Label>Alert history</Label>
        <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
          Price alerts are a Pro feature.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <Label>Alert history</Label>
      {loading ? (
        <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Loading…</p>
      ) : alerts.length === 0 ? (
        <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>No triggered alerts yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {alerts.map((a) => {
            const isAbove = a.direction === "above";
            const date = a.triggered_at
              ? new Date(a.triggered_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
              : "—";
            const currentPrice = prices[a.ticker];
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "10px 14px", gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em" }}>
                      {a.ticker}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 500, borderRadius: 4, padding: "1px 6px",
                      background: isAbove ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${isAbove ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                      color: isAbove ? "#22c55e" : "#ef4444",
                    }}>
                      {isAbove ? "▲" : "▼"} ${a.target_price.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#334155", display: "flex", gap: 12 }}>
                    <span>Triggered {date}</span>
                    {currentPrice != null && (
                      <span>Now <span style={{ color: "#475569" }}>${currentPrice.toFixed(2)}</span></span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteAlert(a.id)}
                  style={{
                    background: "none", border: "none", color: "#334155",
                    fontSize: 18, cursor: "pointer", padding: "0 2px", fontFamily: "inherit",
                  }}
                  title="Clear"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Theses tab ───────────────────────────────────────────────────────────────

const SCENARIO_COLOR: Record<string, string> = {
  bull: "#22c55e", base: "#64748b", bear: "#ef4444",
};

interface ThesisEntry { id: string; ticker: string; scenario: string; created_at: string; }

function ThesesTab({ userId, isPro }: { userId: string; isPro: boolean }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [theses, setTheses]   = useState<ThesisEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPro) { setLoading(false); return; }
    let cancelled = false;
    getToken().then(token =>
      fetch(`/api/thesis-tracking?userId=${encodeURIComponent(userId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    )
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setTheses(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, isPro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(id: string) {
    const token = await getToken();
    await fetch(`/api/thesis-tracking?id=${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setTheses(prev => prev.filter(t => t.id !== id));
  }

  if (!isPro) {
    return (
      <Card>
        <Label>Thesis tracking</Label>
        <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>Thesis tracking is a Pro feature.</p>
      </Card>
    );
  }

  return (
    <Card>
      <Label>Tracked theses</Label>
      {loading ? (
        <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>Loading…</p>
      ) : theses.length === 0 ? (
        <p style={{ fontSize: 13, color: "#334155", margin: 0 }}>
          No tracked theses. Open any stock page, generate scenarios, and click &ldquo;Track thesis&rdquo;.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {theses.map(t => {
            const color = SCENARIO_COLOR[t.scenario] ?? "#64748b";
            return (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8, padding: "10px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => router.push(`/stock/${t.ticker}`)}
                    style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", letterSpacing: "0.04em", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                  >
                    {t.ticker}
                  </button>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 4,
                    color, background: color + "18", border: `1px solid ${color}35`,
                  }}>
                    {t.scenario.charAt(0).toUpperCase() + t.scenario.slice(1)}
                  </span>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  style={{ background: "none", border: "none", color: "#334155", fontSize: 18, cursor: "pointer", padding: "0 2px", fontFamily: "inherit" }}
                  title="Remove thesis"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
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
