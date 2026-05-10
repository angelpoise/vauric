"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  type ActiveFilters,
  type FilterRange,
  DEFAULT_FILTERS,
  ALL_SECTORS,
  ALL_CAP_TIERS,
  ALL_52W_POS,
  countActiveFilters,
} from "@/lib/filtersTypes";
import { MENU_COLLAPSED_W } from "@/components/SideMenu";
import UpgradeButton from "@/components/UpgradeButton";

const PANEL_W = 280;

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function CollapsibleSection({
  title, children, defaultOpen = true,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", padding: "11px 16px", cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 500, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {title}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
          <path d="M2 4L6 8L10 4" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div style={{ padding: "2px 16px 16px" }}>{children}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#e2e8f0",
  fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box",
};

function NumInput({ value, onChange, placeholder, min, max, step }: {
  value: number | null; onChange: (v: number | null) => void;
  placeholder?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <input
      type="number" value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
      placeholder={placeholder ?? "—"} min={min} max={max} step={step}
      style={inputStyle}
    />
  );
}

function RangeRow({ range, onChange, minPh, maxPh, step }: {
  range: FilterRange; onChange: (r: FilterRange) => void;
  minPh?: string; maxPh?: string; step?: number;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <NumInput value={range.min} onChange={(v) => onChange({ ...range, min: v })} placeholder={minPh ?? "Min"} step={step} />
      <span style={{ color: "#334155", fontSize: 12, flexShrink: 0 }}>–</span>
      <NumInput value={range.max} onChange={(v) => onChange({ ...range, max: v })} placeholder={maxPh ?? "Max"} step={step} />
    </div>
  );
}

function CheckRow({ checked, onChange, label, dot, disabled, disabledHint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; dot?: string;
  disabled?: boolean; disabledHint?: string;
}) {
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      cursor: disabled ? "default" : "pointer",
      padding: "4px 0", userSelect: "none",
      opacity: disabled ? 0.45 : 1,
    }}>
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        style={{ accentColor: "#3b82f6", width: 13, height: 13, cursor: disabled ? "default" : "pointer", flexShrink: 0, marginTop: 1 }}
      />
      {dot && <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, marginTop: 3 }} />}
      <span>
        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 300, display: "block" }}>{label}</span>
        {disabledHint && (
          <span style={{ fontSize: 10, color: "#334155", display: "block", marginTop: 1 }}>{disabledHint}</span>
        )}
      </span>
    </label>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 10px", cursor: "pointer", borderRadius: 6, fontFamily: "inherit",
      fontSize: 11, fontWeight: active ? 500 : 400, whiteSpace: "nowrap",
      background: active ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
      border: active ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.07)",
      color: active ? "#3b82f6" : "#64748b", transition: "all 0.12s",
    }}>
      {children}
    </button>
  );
}

function RadioRow({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 0", userSelect: "none" }}>
      <input type="radio" checked={checked} onChange={onChange}
        style={{ accentColor: "#3b82f6", width: 13, height: 13, cursor: "pointer", flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 300 }}>{label}</span>
    </label>
  );
}

function hint(text: string) {
  return <div style={{ marginTop: 7, fontSize: 10, color: "#334155", lineHeight: 1.5 }}>{text}</div>;
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// ─── Preset types, constants and storage ─────────────────────────────────────

interface Preset {
  name: string;
  filters: ActiveFilters;
  isBuiltIn?: boolean;
}

const MAX_USER_PRESETS = 5;
const PRESETS_KEY = "vauric_filter_presets";

const BUILT_IN_PRESETS: Preset[] = [
  {
    name: "Big movers",
    isBuiltIn: true,
    filters: { ...DEFAULT_FILTERS, dailyMove: { min: 5, max: null } },
  },
  {
    name: "Large caps",
    isBuiltIn: true,
    filters: { ...DEFAULT_FILTERS, marketCapTiers: ["mega", "large"] },
  },
];

function loadUserPresets(): Preset[] {
  try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? "[]"); }
  catch { return []; }
}
function saveUserPresets(presets: Preset[]): void {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// ─── Presets section ──────────────────────────────────────────────────────────

function PresetsSection({
  userPresets, activePresetName, isPro, showSaveInput, saveInputValue,
  onApply, onDelete, onSaveCurrent, onToggleSaveInput, onSaveInputChange,
}: {
  userPresets: Preset[];
  activePresetName: string | null;
  isPro: boolean;
  showSaveInput: boolean;
  saveInputValue: string;
  onApply: (p: Preset) => void;
  onDelete: (name: string) => void;
  onSaveCurrent: () => void;
  onToggleSaveInput: () => void;
  onSaveInputChange: (v: string) => void;
}) {
  const allPresets = [...BUILT_IN_PRESETS, ...userPresets];
  const atMax = userPresets.length >= MAX_USER_PRESETS;
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <div style={{
      padding: "10px 16px 12px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      flexShrink: 0,
    }}>
      {/* Label */}
      <div style={{ fontSize: 10, fontWeight: 500, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        Presets
      </div>

      {/* Pill row */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
        {allPresets.map((preset) => {
          const isActive = activePresetName === preset.name;
          return (
            <div key={preset.name} style={{
              display: "inline-flex", alignItems: "center",
              background: isActive ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${isActive ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.07)"}`,
              borderRadius: 6, overflow: "hidden",
              transition: "all 0.12s",
            }}>
              <button
                onClick={() => onApply(preset)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: isActive ? 500 : 400,
                  color: isActive ? "#3b82f6" : "#64748b",
                  padding: preset.isBuiltIn ? "5px 10px" : "5px 6px 5px 10px",
                  fontFamily: "inherit", whiteSpace: "nowrap",
                }}
              >
                {preset.name}
              </button>
              {!preset.isBuiltIn && (
                <button
                  onClick={() => onDelete(preset.name)}
                  title={`Delete "${preset.name}"`}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#334155", padding: "5px 8px 5px 2px",
                    fontSize: 13, lineHeight: 1, fontFamily: "inherit",
                    display: "flex", alignItems: "center",
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {userPresets.length === 0 && (
          <span style={{ fontSize: 11, color: "#334155", alignSelf: "center" }}>No saved presets</span>
        )}
      </div>

      {/* Save current — Pro only */}
      {showUpgrade ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <UpgradeButton label="Upgrade to save presets" />
          <button onClick={() => setShowUpgrade(false)} style={{ background: "none", border: "none", color: "#334155", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
      ) : showSaveInput ? (
        <div style={{ display: "flex", gap: 5 }}>
          <input
            autoFocus
            value={saveInputValue}
            onChange={(e) => onSaveInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveCurrent();
              if (e.key === "Escape") onToggleSaveInput();
            }}
            placeholder="Preset name…"
            style={inputStyle}
          />
          <button
            onClick={onSaveCurrent}
            disabled={!saveInputValue.trim()}
            style={{
              background: "#3b82f6", border: "none", borderRadius: 6,
              color: "#fff", fontSize: 11, padding: "5px 10px", cursor: "pointer",
              fontFamily: "inherit", flexShrink: 0,
              opacity: saveInputValue.trim() ? 1 : 0.45,
            }}
          >
            Save
          </button>
          <button
            onClick={onToggleSaveInput}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6,
              color: "#475569", fontSize: 12, padding: "5px 8px",
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            if (!isPro) { setShowUpgrade(true); return; }
            if (atMax) return;
            onToggleSaveInput();
          }}
          disabled={isPro && atMax}
          title={isPro && atMax ? `Maximum ${MAX_USER_PRESETS} presets` : undefined}
          style={{
            background: "none", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6,
            color: "#475569", fontSize: 11, padding: "4px 10px",
            cursor: isPro && atMax ? "not-allowed" : "pointer",
            fontFamily: "inherit", opacity: isPro && atMax ? 0.45 : 1,
          }}
        >
          {isPro && atMax ? `Max presets (${MAX_USER_PRESETS})` : "+ Save current"}
        </button>
      )}
    </div>
  );
}

function ResetButton({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#3b82f6" : "transparent",
        border: "1px solid #3b82f6",
        borderRadius: 6,
        color: hov ? "#fff" : "#3b82f6",
        fontSize: 12,
        padding: "4px 10px",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      Reset all
    </button>
  );
}

// ─── Static label maps ────────────────────────────────────────────────────────

const SECTOR_LABELS: Record<string, string> = {
  tech: "Information Technology", energy: "Energy", health: "Healthcare",
  finance: "Financials", consumer: "Consumer",
};

const CAP_LABELS: Record<string, string> = {
  mega: "Mega (>$200B)", large: "Large ($10B–$200B)",
  mid: "Mid ($2B–$10B)", small: "Small (<$2B)",
};

const W52_LABELS: Record<string, string> = {
  low: "Near 52W low (≤10%)", mid: "Mid range", high: "Near 52W high (≤10%)",
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  filters: ActiveFilters;
  onFiltersChange: (f: ActiveFilters) => void;
}

export default function FiltersPanel({ open, onClose, filters, onFiltersChange }: Props) {
  const activeCount = countActiveFilters(filters);
  const set = (partial: Partial<ActiveFilters>) => onFiltersChange({ ...filters, ...partial });

  const { user, isLoaded } = useUser();
  const isPro = isLoaded ? user?.publicMetadata?.isPro === true : false;

  // ── Preset state ────────────────────────────────────────────────────────────
  const [userPresets, setUserPresets]       = useState<Preset[]>([]);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [showSaveInput, setShowSaveInput]   = useState(false);
  const [saveInputValue, setSaveInputValue] = useState("");

  // Load user presets when the panel opens
  useEffect(() => {
    if (open) setUserPresets(loadUserPresets());
  }, [open]);

  // Clear active preset indicator when the current filters diverge from it
  useEffect(() => {
    if (!activePresetName) return;
    const all = [...BUILT_IN_PRESETS, ...userPresets];
    const preset = all.find((p) => p.name === activePresetName);
    if (!preset || JSON.stringify(preset.filters) !== JSON.stringify(filters)) {
      setActivePresetName(null);
    }
  }, [filters, activePresetName, userPresets]);

  function applyPreset(preset: Preset) {
    onFiltersChange(preset.filters);
    setActivePresetName(preset.name);
    setShowSaveInput(false);
  }

  function deletePreset(name: string) {
    const updated = userPresets.filter((p) => p.name !== name);
    setUserPresets(updated);
    saveUserPresets(updated);
    if (activePresetName === name) setActivePresetName(null);
  }

  function saveCurrentPreset() {
    const name = saveInputValue.trim();
    if (!name) return;
    // Replace if same name already exists, else append; cap at MAX_USER_PRESETS
    const without = userPresets.filter((p) => p.name !== name);
    const updated = [...without, { name, filters }].slice(-MAX_USER_PRESETS);
    setUserPresets(updated);
    saveUserPresets(updated);
    setActivePresetName(name);
    setShowSaveInput(false);
    setSaveInputValue("");
  }

  return (
    <>
      {/* Backdrop — only covers the graph area to the right of the panel */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            left: MENU_COLLAPSED_W + PANEL_W,
            top: 0, right: 0, bottom: 0,
            zIndex: 29,
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: "fixed", left: 0, top: 0,
        width: PANEL_W, height: "100vh", zIndex: 30,
        background: "#0d1117", borderRight: "1px solid rgba(255,255,255,0.07)",
        display: "flex", flexDirection: "column",
        transform: open ? `translateX(${MENU_COLLAPSED_W}px)` : `translateX(-${PANEL_W}px)`,
        transition: "transform 0.25s ease",
        fontFamily: 'var(--font-dm-sans), "DM Sans", sans-serif',
        overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#f1f5f9" }}>Filters</span>
            {activeCount > 0 && (
              <span style={{
                fontSize: 10, color: "#3b82f6",
                background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)",
                borderRadius: 10, padding: "1px 7px", fontWeight: 500,
              }}>
                {activeCount} active
              </span>
            )}
          </div>
          <ResetButton onClick={() => { onFiltersChange(DEFAULT_FILTERS); setActivePresetName(null); }} />
        </div>

        {/* Presets */}
        <PresetsSection
          userPresets={userPresets}
          activePresetName={activePresetName}
          isPro={isPro}
          showSaveInput={showSaveInput}
          saveInputValue={saveInputValue}
          onApply={applyPreset}
          onDelete={deletePreset}
          onSaveCurrent={saveCurrentPreset}
          onToggleSaveInput={() => { setShowSaveInput((v) => !v); setSaveInputValue(""); }}
          onSaveInputChange={setSaveInputValue}
        />

        {/* Scrollable filter sections */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* 1 · Daily Move */}
          <CollapsibleSection title="Daily Move">
            <RangeRow range={filters.dailyMove} onChange={(v) => set({ dailyMove: v })} minPh="Min %" maxPh="Max %" step={0.1} />
          </CollapsibleSection>

          {/* 2 · Sector */}
          <CollapsibleSection title="Sector">
            {ALL_SECTORS.map((id) => (
              <CheckRow
                key={id} label={SECTOR_LABELS[id]}
                checked={filters.sectors.includes(id)}
                onChange={(on) => set({ sectors: on ? [...filters.sectors, id] : filters.sectors.filter((s) => s !== id) })}
              />
            ))}
          </CollapsibleSection>

          {/* 3 · Market Cap */}
          <CollapsibleSection title="Market Cap">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ALL_CAP_TIERS.map((tier) => (
                <Chip key={tier} active={filters.marketCapTiers.includes(tier)}
                  onClick={() => set({ marketCapTiers: toggle(filters.marketCapTiers, tier) })}>
                  {CAP_LABELS[tier]}
                </Chip>
              ))}
            </div>
            {hint("Uses real market cap data from /api/fundamentals")}
          </CollapsibleSection>

          {/* 5 · Price */}
          <CollapsibleSection title="Price" defaultOpen={false}>
            <RangeRow range={filters.price} onChange={(v) => set({ price: v })} minPh="Min $" maxPh="Max $" step={0.01} />
          </CollapsibleSection>

          {/* 6 · P/E Ratio */}
          <CollapsibleSection title="P/E Ratio (Trailing)" defaultOpen={false}>
            <RangeRow range={filters.trailingPE} onChange={(v) => set({ trailingPE: v })} minPh="Min" maxPh="Max" step={0.1} />
          </CollapsibleSection>

          {/* 7 · Beta */}
          <CollapsibleSection title="Beta" defaultOpen={false}>
            <RangeRow range={filters.beta} onChange={(v) => set({ beta: v })} minPh="Min" maxPh="Max" step={0.01} />
            {hint("Beta > 1 = more volatile than market")}
          </CollapsibleSection>

          {/* 8 · Volume */}
          <CollapsibleSection title="Avg Volume (Min)" defaultOpen={false}>
            <NumInput value={filters.avgVolumeMin} onChange={(v) => set({ avgVolumeMin: v })}
              placeholder="e.g. 1000000" min={0} step={100000} />
            {hint("Minimum average daily volume")}
          </CollapsibleSection>

          {/* 9 · 52-Week Position */}
          <CollapsibleSection title="52-Week Position" defaultOpen={false}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ALL_52W_POS.map((pos) => (
                <Chip key={pos} active={filters.fiftyTwoWeekPos.includes(pos)}
                  onClick={() => set({ fiftyTwoWeekPos: toggle(filters.fiftyTwoWeekPos, pos) })}>
                  {W52_LABELS[pos]}
                </Chip>
              ))}
            </div>
          </CollapsibleSection>

          {/* 10 · Relative Volume */}
          <CollapsibleSection title="Relative Volume (Min)" defaultOpen={false}>
            <NumInput value={filters.relVolumeMin} onChange={(v) => set({ relVolumeMin: v })}
              placeholder="e.g. 1.5" min={0} step={0.1} />
            {hint("Today’s volume ÷ average volume")}
          </CollapsibleSection>

          {/* 11 · Streak */}
          <CollapsibleSection title="Streak" defaultOpen={false}>
            <RadioRow checked={filters.streak === "any"}  onChange={() => set({ streak: "any" })}  label="Any" />
            <RadioRow checked={filters.streak === "up"}   onChange={() => set({ streak: "up" })}   label="Up days only" />
            <RadioRow checked={filters.streak === "down"} onChange={() => set({ streak: "down" })} label="Down days only" />
          </CollapsibleSection>

          {/* 12 · Node Size */}
          <CollapsibleSection title="Node Size" defaultOpen={false}>
            <RadioRow checked={filters.nodeSize === "connections"} onChange={() => set({ nodeSize: "connections" })} label="Size by connections" />
            <RadioRow checked={filters.nodeSize === "marketcap"}   onChange={() => set({ nodeSize: "marketcap" })}   label="Size by market cap" />
          </CollapsibleSection>

          {/* 13 · Sentiment */}
          <CollapsibleSection title="Sentiment (Min % Bullish)" defaultOpen={false}>
            <NumInput value={filters.sentimentMin} onChange={(v) => set({ sentimentMin: v })}
              placeholder="e.g. 60" min={0} max={100} step={1} />
          </CollapsibleSection>

        </div>
      </div>
    </>
  );
}
