import Logo from "@/components/Logo";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import WaitlistForm from "@/components/WaitlistForm";

const DM     = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF  = 'var(--font-dm-serif), serif';

// ─── Icon components ──────────────────────────────────────────────────────────

function IconDiscover() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="#3b82f6" strokeWidth="1.5" />
      <path d="M12 12l4 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.5 7.5h4M7.5 5.5v4" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function IconConnect() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9"   cy="9"   r="2.8"  stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="2.5" cy="3"   r="1.8"  stroke="#3b82f6" strokeWidth="1.1" />
      <circle cx="15.5" cy="3"  r="1.8"  stroke="#3b82f6" strokeWidth="1.1" />
      <circle cx="2.5" cy="15"  r="1.8"  stroke="#3b82f6" strokeWidth="1.1" />
      <circle cx="15.5" cy="15" r="1.8"  stroke="#3b82f6" strokeWidth="1.1" />
      <line x1="6.4"  y1="7.2" x2="4.2"  y2="4.7" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
      <line x1="11.6" y1="7.2" x2="13.8" y2="4.7" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
      <line x1="6.4"  y1="10.8" x2="4.2" y2="13.3" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
      <line x1="11.6" y1="10.8" x2="13.8" y2="13.3" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M9 2a5 5 0 00-5 5v2.5L2.5 12h13L14 9.5V7a5 5 0 00-5-5z"
        stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M7 12v.5a2 2 0 004 0V12" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ─── Value prop card ──────────────────────────────────────────────────────────

function ValueCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="hp-card" style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "28px 26px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
    }}>
      <div style={{
        width: 38, height: 38,
        borderRadius: 10,
        background: "var(--blue-glow)",
        border: "1px solid var(--blue-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 18,
      }}>
        {icon}
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8, fontFamily: DM }}>
        {title}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.68, fontWeight: 300, fontFamily: DM }}>
        {desc}
      </p>
    </div>
  );
}

// ─── How-it-works step ───────────────────────────────────────────────────────

function Step({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      padding: "28px 26px",
    }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8, fontFamily: DM }}>
        {title}
      </p>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.68, fontWeight: 300, fontFamily: DM }}>
        {desc}
      </p>
    </div>
  );
}

// ─── Single downward arrow between sections ───────────────────────────────────

function SectionArrow() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
      <svg
        width="14" height="60" viewBox="0 0 14 60"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        <line x1="7" y1="0" x2="7" y2="50"
          stroke="rgba(59,130,246,0.28)" strokeWidth="1.5" />
        <polyline points="2,44 7,52 12,44"
          fill="none" stroke="rgba(59,130,246,0.5)" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Converging connector (3 cards → 1 section) ───────────────────────────────

function MergeConnector() {
  const stroke = "rgba(59,130,246,0.28)";
  const tip    = "rgba(59,130,246,0.5)";
  const sw     = 1.5;
  const [l, c, r] = [137, 426, 715];
  const jY = 30, dY = 56;
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
      <svg
        width="100%" height="64" viewBox="0 0 852 64"
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        <line x1={l} y1={0}  x2={l} y2={jY} stroke={stroke} strokeWidth={sw} />
        <line x1={c} y1={0}  x2={c} y2={jY} stroke={stroke} strokeWidth={sw} />
        <line x1={r} y1={0}  x2={r} y2={jY} stroke={stroke} strokeWidth={sw} />
        <line x1={l} y1={jY} x2={r} y2={jY} stroke={stroke} strokeWidth={sw} />
        <line x1={c} y1={jY} x2={c} y2={dY} stroke={stroke} strokeWidth={sw} />
        <polyline
          points={`${c - 5},${dY - 7} ${c},${dY} ${c + 5},${dY - 7}`}
          fill="none" stroke={tip} strokeWidth={sw}
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── Flowchart connector ──────────────────────────────────────────────────────
// viewBox matches the 852px content width (900px max − 48px padding).
// preserveAspectRatio="none" scales the X axis proportionally with the
// container while keeping the 64px height fixed, so the branch tips stay
// aligned with the three grid columns at any width.

function FlowConnector() {
  const stroke = "rgba(59,130,246,0.28)";
  const tip    = "rgba(59,130,246,0.5)";
  const sw     = 1.5;
  // column centres in a 852px container with 3 equal cols + 16px gaps
  const [l, c, r] = [137, 426, 715];
  const jY = 28; // y of horizontal crossbar
  const dY = 58; // y where branch meets card top

  return (
    <svg
      width="100%"
      height="64"
      viewBox="0 0 852 64"
      preserveAspectRatio="none"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {/* Vertical stem from "How it works" label */}
      <line x1={c} y1={0}  x2={c} y2={jY} stroke={stroke} strokeWidth={sw} />
      {/* Horizontal crossbar */}
      <line x1={l} y1={jY} x2={r} y2={jY} stroke={stroke} strokeWidth={sw} />
      {/* Three vertical drops */}
      <line x1={l} y1={jY} x2={l} y2={dY} stroke={stroke} strokeWidth={sw} />
      <line x1={c} y1={jY} x2={c} y2={dY} stroke={stroke} strokeWidth={sw} />
      <line x1={r} y1={jY} x2={r} y2={dY} stroke={stroke} strokeWidth={sw} />
      {/* Arrowhead chevrons */}
      {[l, c, r].map((x) => (
        <polyline
          key={x}
          points={`${x - 5},${dY - 7} ${x},${dY} ${x + 5},${dY - 7}`}
          fill="none"
          stroke={tip}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      {/* Page-scoped styles for hover effects and the scroll-indicator animation */}
      <style>{`
        .hp-cta {
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 0 0 0 rgba(59,130,246,0);
        }
        .hp-cta:hover {
          background: var(--blue-dim) !important;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.18);
        }
        .hp-cta:active { transform: scale(0.98); }
        .hp-card { transition: border-color 0.2s; }
        .hp-card:hover { border-color: rgba(59,130,246,0.28) !important; }
        @keyframes scrollBounce {
          0%,100% { transform: translateX(-50%) translateY(0);  opacity: 0.45; }
          50%      { transform: translateX(-50%) translateY(7px); opacity: 0.9; }
        }
        .hp-scroll { animation: scrollBounce 2s ease-in-out infinite; }
      `}</style>

      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <main style={{ position: "relative", zIndex: 1 }}>

        {/* ══════════════════════════════════════════════════
            Section 1 — Hero
        ══════════════════════════════════════════════════ */}
        <section style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "72px 24px 0",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Logo */}
          <div style={{
            marginBottom: 64,
            transform: "scale(2.4)",
            transformOrigin: "center center",
          }}>
            <Logo variant="default" />
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: SERIF,
            fontSize: "clamp(36px, 5.8vw, 70px)",
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.015em",
            color: "var(--text)",
            margin: "0 0 22px",
            maxWidth: 800,
          }}>
            The market is bigger than{" "}
            <em style={{ fontStyle: "italic", color: "var(--blue)" }}>30 tickers.</em>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontFamily: DM,
            fontSize: "clamp(15px, 2vw, 18px)",
            fontWeight: 300,
            color: "var(--text-dim)",
            lineHeight: 1.72,
            maxWidth: 510,
            margin: "0 0 30px",
          }}>
            Vauric is a living knowledge graph of the market. Discover stocks
            before the move is over — not after.
          </p>

          {/* Launch badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.22)",
            borderRadius: 100,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 400,
            fontFamily: DM,
            color: "var(--blue)",
            letterSpacing: "0.05em",
            marginBottom: 38,
          }}>
            <span className="eyebrow-dot" />
            Expected launch: mid June 2026
          </div>

          {/* CTA */}
          <a
            href="#waitlist"
            className="hp-cta"
            style={{
              display: "inline-block",
              background: "var(--blue)",
              color: "#fff",
              fontFamily: DM,
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: "0.01em",
              padding: "14px 44px",
              borderRadius: 10,
              textDecoration: "none",
              marginBottom: 64,
            }}
          >
            Join the waitlist
          </a>

          {/* Graph preview */}
          <div style={{
            width: "100%",
            maxWidth: 900,
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "16px 16px 0 0",
            overflow: "hidden",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 60,
              background: "linear-gradient(to bottom, var(--bg2), transparent)",
              zIndex: 2, pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 90,
              background: "linear-gradient(to top, var(--bg2), transparent)",
              zIndex: 2, pointerEvents: "none",
            }} />
            <p style={{
              position: "absolute",
              top: 16, left: "50%", transform: "translateX(-50%)",
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--text-muted)", fontFamily: DM,
              zIndex: 3, whiteSpace: "nowrap",
            }}>
              Live market knowledge graph — preview
            </p>
            <KnowledgeGraph />
          </div>

          {/* Scroll indicator */}
          <div className="hp-scroll" style={{
            position: "absolute",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path
                d="M5 8l6 6 6-6"
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            Section 2 — Three value props
        ══════════════════════════════════════════════════ */}
        <SectionArrow />
        <section style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 24px 0",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}>
            <ValueCard
              icon={<IconDiscover />}
              title="Discover"
              desc="Find stocks beyond the 30 everyone talks about. Spot sector trends and capital rotations earlier — while the opportunity is still forming."
            />
            <ValueCard
              icon={<IconConnect />}
              title="Connect"
              desc="Every stock linked to its sector, rivals, and partners. See the relationships others miss."
            />
            <ValueCard
              icon={<IconBell />}
              title="Stay ahead"
              desc="AI-powered notifications for earnings, analyst actions, short squeezes, and more — delivered to your watchlist."
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            Section 3 — How it works
        ══════════════════════════════════════════════════ */}
        <SectionArrow />
        <section style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 24px 0",
        }}>
          {/* Section label */}
          <div style={{ textAlign: "center", marginBottom: 0 }}>
            <h2 style={{
              fontFamily: SERIF,
              fontSize: "clamp(26px, 4vw, 42px)",
              fontWeight: 400,
              color: "var(--text)",
              lineHeight: 1.2,
              marginBottom: 14,
            }}>
              Built for the way <u>you</u> actually trade
            </h2>
            <p style={{
              fontFamily: DM,
              fontSize: 14,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--blue)",
              fontWeight: 500,
              marginBottom: 0,
            }}>
              How it works
            </p>
          </div>

          {/* Flowchart connector */}
          <FlowConnector />

          {/* Steps */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}>
            <Step
              title="Explore the graph"
              desc="Navigate the live knowledge graph, hover nodes to see real-time data, and discover stocks you hadn't considered."
            />
            <Step
              title="Build your watchlist"
              desc="Save stocks you're tracking, set notification preferences for what matters to you."
            />
            <Step
              title="Never miss a move"
              desc="Get alerted when something significant happens to your stocks — before the crowd reacts."
            />
          </div>
        </section>

        {/* ══════════════════════════════════════════════════
            Section 4 — Waitlist
        ══════════════════════════════════════════════════ */}
        <MergeConnector />
        <section
          id="waitlist"
          style={{
            padding: "48px 24px 96px",
            textAlign: "center",
          }}
        >
          <h2 style={{
            fontFamily: SERIF,
            fontSize: "clamp(28px, 4vw, 46px)",
            fontWeight: 400,
            color: "var(--text)",
            marginBottom: 14,
          }}>
            Get early access
          </h2>
          <p style={{
            fontFamily: DM,
            fontSize: "clamp(14px, 2vw, 16px)",
            color: "var(--text-dim)",
            fontWeight: 300,
            lineHeight: 1.72,
            maxWidth: 420,
            margin: "0 auto 36px",
          }}>
            Join the waitlist for launch in mid June 2026. Early members receive
            a lifetime discount on Pro.
          </p>

          <WaitlistForm />
        </section>

        {/* ══════════════════════════════════════════════════
            Section 5 — Footer
        ══════════════════════════════════════════════════ */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "28px 24px",
          textAlign: "center",
          fontFamily: DM,
          fontSize: 12,
          color: "var(--text-muted)",
        }}>
          <p>
            © 2026 Vauric &nbsp;·&nbsp;{" "}
            <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              Privacy policy
            </a>
            &nbsp;·&nbsp;{" "}
            <a href="#" style={{ color: "var(--text-muted)", textDecoration: "none" }}>
              Terms
            </a>
          </p>
          <p style={{ marginTop: 6 }}>
            Nothing on this site constitutes financial advice.
          </p>
        </footer>

      </main>
    </>
  );
}
