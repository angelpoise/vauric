"use client";

export default function SectorError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", background: "#07090f", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#475569", marginBottom: 16 }}>
          {error.message?.includes("not found") ? "Sector not found." : "Something went wrong loading this sector."}
        </div>
        <button onClick={reset} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#64748b", fontSize: 12, padding: "6px 14px", cursor: "pointer" }}>
          Try again
        </button>
      </div>
    </div>
  );
}
