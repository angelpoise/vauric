import Link from "next/link";
import Logo from "@/components/Logo";
import KnowledgeGraph from "@/components/KnowledgeGraph";
import StatsCounter from "@/components/StatsCounter";

const DM    = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF = 'var(--font-dm-serif), serif';

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(8,11,18,0.92)",
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        padding: "0 24px",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo variant="default" />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/sign-in"
            className="hp-link"
            style={{
              fontFamily: DM, fontSize: 14, fontWeight: 400,
              color: "var(--text-dim)", textDecoration: "none",
              padding: "8px 14px", borderRadius: 7,
            }}
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="hp-cta-primary"
            style={{
              fontFamily: DM, fontSize: 14, fontWeight: 500,
              color: "#fff", textDecoration: "none",
              padding: "8px 18px", borderRadius: 7,
              background: "var(--blue)",
              display: "inline-block",
            }}
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Feature ─────────────────────────────────────────────────────────────────

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="hp-feature" style={{
      padding: "28px 30px",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      background: "var(--bg2)",
    }}>
      <p style={{
        fontFamily: DM, fontSize: 15, fontWeight: 600,
        color: "var(--text)", marginBottom: 10,
      }}>
        {title}
      </p>
      <p style={{
        fontFamily: DM, fontSize: 14, fontWeight: 300,
        color: "var(--text-muted)", lineHeight: 1.72,
      }}>
        {body}
      </p>
    </div>
  );
}

// ─── Pricing card ────────────────────────────────────────────────────────────

function PricingCard({
  tier, price, sub, items, cta, ctaHref, highlight,
}: {
  tier: string;
  price: string;
  sub: string;
  items: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    <div style={{
      flex: "1 1 280px", maxWidth: 420,
      border: highlight
        ? "1px solid rgba(59,130,246,0.4)"
        : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      background: highlight ? "rgba(59,130,246,0.05)" : "var(--bg2)",
      padding: "32px 30px",
      display: "flex", flexDirection: "column",
    }}>
      <p style={{
        fontFamily: DM, fontSize: 11, fontWeight: 600,
        letterSpacing: "0.1em", textTransform: "uppercase",
        color: highlight ? "var(--blue)" : "var(--text-muted)",
        marginBottom: 16,
      }}>
        {tier}
      </p>
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontFamily: SERIF, fontSize: 38, fontWeight: 400, color: "var(--text)",
        }}>
          {price}
        </span>
        {price !== "Free" && (
          <span style={{ fontFamily: DM, fontSize: 14, color: "var(--text-muted)", marginLeft: 4 }}>
            / month
          </span>
        )}
      </div>
      <p style={{
        fontFamily: DM, fontSize: 13, color: "var(--text-muted)",
        fontWeight: 300, marginBottom: 28,
      }}>
        {sub}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <li key={item} style={{
            fontFamily: DM, fontSize: 14, color: "var(--text-dim)",
            fontWeight: 300, display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ color: "var(--blue)", flexShrink: 0, marginTop: 1 }}>✓</span>
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={highlight ? "hp-cta-primary" : "hp-cta-secondary"}
        style={{
          display: "block", textAlign: "center",
          fontFamily: DM, fontSize: 14, fontWeight: 500,
          textDecoration: "none", padding: "12px",
          borderRadius: 8, marginTop: "auto",
          background: highlight ? "var(--blue)" : "transparent",
          border: highlight ? "none" : "1px solid rgba(255,255,255,0.12)",
          color: highlight ? "#fff" : "var(--text-dim)",
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <style>{`
        .hp-link:hover { color: var(--text) !important; }
        .hp-cta-primary { transition: background 0.15s, transform 0.1s; }
        .hp-cta-primary:hover { background: #1d4ed8 !important; }
        .hp-cta-primary:active { transform: scale(0.98); }
        .hp-cta-secondary { transition: background 0.15s, border-color 0.15s; }
        .hp-cta-secondary:hover { background: rgba(255,255,255,0.04) !important; border-color: rgba(255,255,255,0.2) !important; }
        .hp-feature { transition: border-color 0.2s; }
        .hp-feature:hover { border-color: rgba(255,255,255,0.14) !important; }
      `}</style>

      <Nav />

      <main>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 780, margin: "0 auto",
          padding: "96px 24px 80px",
          textAlign: "center",
        }}>
          <h1 style={{
            fontFamily: SERIF,
            fontSize: "clamp(38px, 5.5vw, 68px)",
            fontWeight: 400,
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: "var(--text)",
            margin: "0 0 24px",
          }}>
            The market is bigger than{" "}
            <em style={{ fontStyle: "italic", color: "var(--blue)" }}>30 tickers.</em>
          </h1>

          <p style={{
            fontFamily: DM,
            fontSize: "clamp(16px, 2vw, 19px)",
            fontWeight: 300,
            color: "var(--text-dim)",
            lineHeight: 1.68,
            maxWidth: 520,
            margin: "0 auto 40px",
          }}>
            Vauric is a living knowledge graph of the stock market. Navigate
            1,300&thinsp;+ companies by sector, industry, and relationship —
            and discover opportunities before the crowd does.
          </p>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/sign-up"
              className="hp-cta-primary"
              style={{
                fontFamily: DM, fontWeight: 500, fontSize: 16,
                color: "#fff", textDecoration: "none",
                padding: "14px 36px", borderRadius: 9,
                background: "var(--blue)", display: "inline-block",
              }}
            >
              Start exploring free
            </Link>
            <Link
              href="/sign-in"
              className="hp-cta-secondary"
              style={{
                fontFamily: DM, fontWeight: 400, fontSize: 16,
                color: "var(--text-dim)", textDecoration: "none",
                padding: "14px 36px", borderRadius: 9,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "inline-block",
              }}
            >
              Sign in
            </Link>
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <StatsCounter />

        {/* ── Graph preview ───────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 1060, margin: "0 auto",
          padding: "0 24px 96px",
        }}>
          <p style={{
            fontFamily: DM, fontSize: 11,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--text-muted)", textAlign: "center",
            marginBottom: 20,
          }}>
            Live market knowledge graph
          </p>
          <div style={{
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14, overflow: "hidden",
            background: "var(--bg2)",
            position: "relative",
          }}>
            {/* Browser chrome strip */}
            <div style={{
              height: 36, background: "var(--bg3)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", gap: 7, padding: "0 14px",
            }}>
              {["#ef4444","#f59e0b","#22c55e"].map((c) => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: 0.7 }} />
              ))}
              <div style={{
                flex: 1, marginLeft: 12, height: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 5,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontFamily: DM, fontSize: 11, color: "var(--text-muted)" }}>
                  vauric.io/graph
                </span>
              </div>
            </div>
            {/* Fade overlays */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 100,
              background: "linear-gradient(to top, var(--bg2), transparent)",
              zIndex: 2, pointerEvents: "none",
            }} />
            <KnowledgeGraph />
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 920, margin: "0 auto",
          padding: "0 24px 96px",
        }}>
          <h2 style={{
            fontFamily: SERIF,
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 400, color: "var(--text)",
            textAlign: "center", marginBottom: 14, lineHeight: 1.15,
          }}>
            Find the stocks others overlook
          </h2>
          <p style={{
            fontFamily: DM, fontSize: 16, fontWeight: 300,
            color: "var(--text-muted)", textAlign: "center",
            maxWidth: 480, margin: "0 auto 48px", lineHeight: 1.65,
          }}>
            Most platforms show you the same 30 names. Vauric is built to surface the others.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}>
            <Feature
              title="Navigate by connection, not just ticker"
              body="Every stock is linked to its sector, sub-sector, industry node, direct peers, and indirect relationships. Spot capital rotation as it happens — not after the chart already moved."
            />
            <Feature
              title="Instant AI company analysis"
              body="Click any node to get a breakdown of business segments, margins, guidance, and key relationships — generated on demand and updated automatically. No research rabbit hole required."
            />
            <Feature
              title="Scenario modelling"
              body="Bull, base, and bear case price targets with 6-month, 1-year, and 2-year horizons. Understand the conditions that need to be true for each outcome before you size a position."
            />
            <Feature
              title="Catalyst alerts that matter"
              body="Earnings, analyst upgrades and downgrades, short squeeze conditions, insider filings. Alerts are tied to your watchlist — so you only hear about what you actually care about."
            />
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 920, margin: "0 auto",
          padding: "0 24px 96px",
        }}>
          <h2 style={{
            fontFamily: SERIF,
            fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 400, color: "var(--text)",
            textAlign: "center", marginBottom: 48, lineHeight: 1.15,
          }}>
            Straightforward pricing
          </h2>

          <div style={{
            display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center",
          }}>
            <PricingCard
              tier="Free"
              price="Free"
              sub="Full graph access, no credit card required."
              items={[
                "Full knowledge graph — all 1,300+ stocks",
                "Real-time prices, daily moves, and sector data",
                "Personal watchlist with live tracking",
                "Stock pages with company analysis",
                "Sector, exposure, peer, and impact connection views",
              ]}
              cta="Get started free"
              ctaHref="/sign-up"
            />
            <PricingCard
              tier="Plus"
              price="$9"
              sub="Alerts and a bigger watchlist."
              items={[
                "Everything in Free",
                "Price and earnings alerts",
                "Extended watchlist",
                "Analyst action notifications",
              ]}
              cta="Start Plus"
              ctaHref="/sign-up?plan=plus"
            />
            <PricingCard
              tier="Pro"
              price="$15"
              sub="The full picture — alerts, AI, and scenarios."
              items={[
                "Everything in Plus",
                "AI analysis on every company",
                "Bull, base, and bear scenario modelling",
                "Multi-select connection views",
                "Saved focus lists",
                "Portfolio tracking and export",
              ]}
              cta="Start Pro"
              ctaHref="/sign-up?plan=pro"
              highlight
            />
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────────────────────── */}
        <section style={{
          textAlign: "center",
          padding: "0 24px 120px",
        }}>
          <h2 style={{
            fontFamily: SERIF,
            fontSize: "clamp(26px, 4vw, 42px)",
            fontWeight: 400, color: "var(--text)",
            marginBottom: 20, lineHeight: 1.15,
          }}>
            Start with the full graph — free.
          </h2>
          <p style={{
            fontFamily: DM, fontSize: 16, fontWeight: 300,
            color: "var(--text-muted)", marginBottom: 36,
          }}>
            No credit card needed.
          </p>
          <Link
            href="/sign-up"
            className="hp-cta-primary"
            style={{
              fontFamily: DM, fontWeight: 500, fontSize: 16,
              color: "#fff", textDecoration: "none",
              padding: "15px 44px", borderRadius: 9,
              background: "var(--blue)", display: "inline-block",
            }}
          >
            Create free account
          </Link>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "32px 24px",
          maxWidth: 920, margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <p style={{ fontFamily: DM, fontSize: 12, color: "var(--text-muted)" }}>
            © 2026 Vauric · Nothing on this site constitutes financial advice.
          </p>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms",   href: "/terms"   },
              { label: "Sign in", href: "/sign-in" },
            ].map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                style={{ fontFamily: DM, fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}
                className="hp-link"
              >
                {label}
              </Link>
            ))}
          </div>
        </footer>

      </main>
    </>
  );
}
