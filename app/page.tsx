import Link from "next/link";
import Image from "next/image";
import { RadarIcon } from "@/components/Logo";
import StatsCounter from "@/components/StatsCounter";
import RevealOnScroll from "@/components/RevealOnScroll";
import WaitlistForm from "@/components/WaitlistForm";

const DM    = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF = 'var(--font-dm-serif), serif';

// ─── Feature ─────────────────────────────────────────────────────────────────

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="hp-feature" style={{
      padding: "28px 30px",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12,
      background: "var(--bg2)",
      flex: 1,
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
  tier, price, sub, items, cta, ctaHref, highlight, accent, badge,
}: {
  tier: string;
  price: string;
  sub: string;
  items: string[];
  cta: string;
  ctaHref: string;
  highlight?: boolean;
  accent?: boolean;
  badge?: string;
}) {
  // Colour tokens per tier
  const borderCol = highlight
    ? "rgba(59,130,246,0.4)"
    : accent
    ? "rgba(255,255,255,0.24)"
    : "rgba(148,163,184,0.12)";
  const bgCol = highlight
    ? "rgba(59,130,246,0.06)"
    : accent
    ? "rgba(255,255,255,0.05)"
    : "rgba(148,163,184,0.03)";
  const tierCol  = highlight ? "var(--blue)"    : accent ? "#94a3b8"  : "#475569";
  const priceCol = highlight ? "var(--text)"    : accent ? "var(--text)" : "#475569";
  const subCol   = highlight ? "var(--text-dim)": accent ? "var(--text-dim)" : "#334155";
  const itemCol  = highlight ? "var(--text-dim)": accent ? "#94a3b8"  : "#3f4f61";
  const checkCol = highlight ? "var(--blue)"    : accent ? "#64748b"  : "#2d3d4d";

  return (
    <div style={{
      border: `1px solid ${borderCol}`,
      borderRadius: 14,
      background: bgCol,
      padding: "30px 28px",
      display: "flex", flexDirection: "column",
      flex: 1,
      position: "relative",
    }}>

      {/* Badge — floats over the top border, doesn't affect card flow */}
      {badge && (
        <span style={{
          position: "absolute", top: -13, left: "50%",
          transform: "translateX(-50%)",
          fontFamily: DM, fontSize: 10, fontWeight: 600,
          letterSpacing: "0.1em", textTransform: "uppercase",
          color: "#fff", background: "var(--blue)",
          padding: "3px 10px", borderRadius: 20,
          whiteSpace: "nowrap",
        }}>
          {badge}
        </span>
      )}

      {/* Tier label */}
      <p style={{
        fontFamily: DM, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: tierCol, margin: "0 0 20px",
      }}>
        {tier}
      </p>

      {/* Price */}
      <div style={{ minHeight: 52, marginBottom: 8 }}>
        <span style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: priceCol }}>
          {price}
        </span>
        {price !== "Free" && (
          <span style={{ fontFamily: DM, fontSize: 13, color: "var(--text-muted)", marginLeft: 4 }}>
            / month
          </span>
        )}
      </div>

      {/* Sub */}
      <p style={{
        fontFamily: DM, fontSize: 13, color: subCol,
        fontWeight: 300, minHeight: 44, marginBottom: 24, lineHeight: 1.6,
      }}>
        {sub}
      </p>

      {/* Feature list */}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
        {items.map((item) => (
          <li key={item} style={{
            fontFamily: DM, fontSize: 13, color: itemCol,
            fontWeight: 300, display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <span style={{ flexShrink: 0, marginTop: 1, color: checkCol }}>✓</span>
            {item}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={ctaHref}
        className={highlight ? "hp-cta-primary" : "hp-cta-secondary"}
        style={{
          display: "block", textAlign: "center",
          fontFamily: DM, fontSize: 14, fontWeight: 500,
          textDecoration: "none", padding: "12px", borderRadius: 8,
          background: highlight
            ? "var(--blue)"
            : accent
            ? "rgba(255,255,255,0.08)"
            : "transparent",
          border: highlight
            ? "none"
            : accent
            ? "1px solid rgba(255,255,255,0.16)"
            : "1px solid rgba(148,163,184,0.14)",
          color: highlight ? "#fff" : accent ? "#94a3b8" : "#3f4f61",
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

      <main>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section id="waitlist" style={{
          maxWidth: 780, margin: "0 auto",
          padding: "80px 24px 80px",
          textAlign: "center",
        }}>

          {/* Brand mark */}
          <div style={{
            display: "flex", flexDirection: "row", alignItems: "center",
            justifyContent: "center", gap: 20, marginBottom: 56,
          }}>
            <RadarIcon size={100} />
            <span style={{
              fontFamily: DM, fontSize: 72, fontWeight: 700,
              letterSpacing: "0.18em", color: "#fff",
              lineHeight: 1,
            }}>
              VAURIC
            </span>
          </div>

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

          <WaitlistForm bare />
        </section>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <RevealOnScroll direction="up">
          <StatsCounter />
        </RevealOnScroll>

        {/* ── Graph preview ───────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 1060, margin: "0 auto",
          padding: "0 24px 96px",
        }}>
          <RevealOnScroll direction="up">
            <p style={{
              fontFamily: DM, fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--text-muted)", textAlign: "center",
              marginBottom: 20,
            }}>
              Live market knowledge graph
            </p>
          </RevealOnScroll>
          <RevealOnScroll direction="right" delay={80}>
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
              <Image
                src="/graph-preview.jpg"
                alt="Vauric knowledge graph — live market structure and connections"
                width={1440}
                height={810}
                style={{ width: "100%", height: "auto", display: "block" }}
                priority
              />
            </div>
          </RevealOnScroll>
        </section>

        {/* ── Features ────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 920, margin: "0 auto",
          padding: "0 24px 96px",
        }}>
          <RevealOnScroll direction="up">
            <h2 style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 400, color: "var(--text)",
              textAlign: "center", marginBottom: 14, lineHeight: 1.15,
            }}>
              Find the stocks others overlook
            </h2>
          </RevealOnScroll>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}>
            <RevealOnScroll direction="left" delay={0} style={{ display: "flex", flexDirection: "column" }}>
              <Feature
                title="Navigate by connection, not just ticker"
                body="Every stock is linked to its sector, sub-sector, industry node, direct peers, and indirect relationships. Spot capital rotation as it happens — not after the chart already moved."
              />
            </RevealOnScroll>
            <RevealOnScroll direction="up" delay={100} style={{ display: "flex", flexDirection: "column" }}>
              <Feature
                title="Instant company analysis"
                body="Click any node to get a breakdown of business segments, margins, guidance, and key relationships — generated on demand and updated automatically. No research rabbit hole required."
              />
            </RevealOnScroll>
            <RevealOnScroll direction="right" delay={200} style={{ display: "flex", flexDirection: "column" }}>
              <Feature
                title="Scenario modelling"
                body="Bull, base, and bear case price targets with 6-month, 1-year, and 2-year horizons. Understand the conditions that need to be true for each outcome before you size a position."
              />
            </RevealOnScroll>
            <RevealOnScroll direction="left" delay={0} style={{ display: "flex", flexDirection: "column" }}>
              <Feature
                title="Catalyst alerts that matter"
                body="Earnings, analyst upgrades and downgrades, corporate actions, and IPOs. Alerts are tied to your watchlist — so you only hear about what you actually care about."
              />
            </RevealOnScroll>
            <RevealOnScroll direction="up" delay={100} style={{ display: "flex", flexDirection: "column" }}>
              <Feature
                title="Live data on every stock"
                body="Real-time prices, daily moves, and relative strength vs sector ETFs. Every node on the graph is a live data point, not a static label."
              />
            </RevealOnScroll>
            <RevealOnScroll direction="right" delay={200} style={{ display: "flex", flexDirection: "column" }}>
              <Feature
                title="Watchlist and portfolio tracking"
                body="Save the stocks you're following and track your holdings in one place. See performance, alerts, and analysis for everything you own or are watching."
              />
            </RevealOnScroll>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────────── */}
        <section style={{
          maxWidth: 920, margin: "0 auto",
          padding: "0 24px 96px",
        }}>
          <RevealOnScroll direction="up">
            <h2 style={{
              fontFamily: SERIF,
              fontSize: "clamp(28px, 4vw, 44px)",
              fontWeight: 400, color: "var(--text)",
              textAlign: "center", marginBottom: 48, lineHeight: 1.15,
            }}>
              Simple pricing
            </h2>
          </RevealOnScroll>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}>
            <RevealOnScroll direction="left" delay={0} style={{ display: "flex" }}>
              <PricingCard
                tier="Free"
                price="Free"
                sub="Full graph access. No credit card needed."
                items={[
                  "Full knowledge graph — all 1,300+ stocks",
                  "All connections visible — sector, industry, peer, and exposure",
                  "Real-time prices and daily moves",
                  "Stock detail pages",
                  "Personal watchlist",
                  "General news feed",
                ]}
                cta="Get started free"
                ctaHref="#waitlist"
              />
            </RevealOnScroll>
            <RevealOnScroll direction="up" delay={120} style={{ display: "flex" }}>
              <PricingCard
                tier="Pro"
                price="$15"
                sub="Build conviction, size positions, and stay ahead of your holdings."
                items={[
                  "Everything in Plus",
                  "AI market summary filtered to your watchlist",
                  "Bull, base, and bear scenario modelling",
                  "Instant analysis on every company page",
                  "Track your highest-conviction ideas in saved focus lists",
                  "Portfolio tracking and export",
                  "Trace connections across companies with multi-select views",
                ]}
                badge="Recommended"
                cta="Join waitlist"
                ctaHref="#waitlist"
                highlight
              />
            </RevealOnScroll>
            <RevealOnScroll direction="right" delay={240} style={{ display: "flex" }}>
              <PricingCard
                tier="Plus"
                price="$9"
                sub="Automatic alerts and market context, without the analysis."
                items={[
                  "Everything in Free",
                  "AI market summary — biggest stories each day",
                  "Price and earnings alerts",
                  "Analyst upgrade and downgrade notifications",
                  "Corporate action alerts",
                ]}
                cta="Join waitlist"
                ctaHref="#waitlist"
                accent
              />
            </RevealOnScroll>
          </div>
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
