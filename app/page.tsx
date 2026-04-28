import WaitlistForm from "@/components/WaitlistForm";
import KnowledgeGraph from "@/components/KnowledgeGraph";

export default function Home() {
  return (
    <>
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <div className="wrapper">
        {/* NAV */}
        <nav>
          <a href="/" className="logo">
            <svg className="logo-mark" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="21" cy="21" r="20.5" stroke="rgba(59,130,246,0.3)" />
              <circle cx="21" cy="21" r="6" fill="#3b82f6" opacity="0.9" />
              <line x1="21" y1="1"  x2="21" y2="10" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
              <line x1="21" y1="32" x2="21" y2="41" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
              <line x1="1"  y1="21" x2="10" y2="21" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
              <line x1="32" y1="21" x2="41" y2="21" stroke="rgba(59,130,246,0.4)" strokeWidth="1" />
              <circle cx="21" cy="4"  r="2" fill="rgba(59,130,246,0.5)" />
              <circle cx="21" cy="38" r="2" fill="rgba(59,130,246,0.5)" />
              <circle cx="4"  cy="21" r="2" fill="rgba(59,130,246,0.5)" />
              <circle cx="38" cy="21" r="2" fill="rgba(59,130,246,0.5)" />
              <line x1="8"  y1="8"  x2="15" y2="15" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
              <line x1="27" y1="27" x2="34" y2="34" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
              <line x1="34" y1="8"  x2="27" y2="15" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
              <line x1="8"  y1="34" x2="15" y2="27" stroke="rgba(59,130,246,0.25)" strokeWidth="1" />
              <circle cx="7"  cy="7"  r="1.5" fill="rgba(59,130,246,0.35)" />
              <circle cx="35" cy="7"  r="1.5" fill="rgba(59,130,246,0.35)" />
              <circle cx="7"  cy="35" r="1.5" fill="rgba(59,130,246,0.35)" />
              <circle cx="35" cy="35" r="1.5" fill="rgba(59,130,246,0.35)" />
            </svg>
            <span className="logo-name">VAURIC</span>
            <span className="logo-io">vauric.io</span>
          </a>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Early access — join the waitlist
          </div>

          <h1>
            The stock market is bigger
            <br />
            than <em>30 tickers</em>
          </h1>

          <p className="subheadline">
            Vauric is a living knowledge graph of the market. Discover stocks
            before the move is over, understand what&apos;s connected, and never
            miss what matters.
          </p>

          <WaitlistForm />
        </section>

        {/* GRAPH PREVIEW */}
        <div className="graph-section">
          <p className="graph-label">Live market knowledge graph — preview</p>
          <div className="graph-container">
            <div className="graph-fade-top" />
            <div className="graph-fade-bottom" />
            <KnowledgeGraph />
          </div>
        </div>

        {/* FEATURES */}
        <div className="features">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="3" stroke="#3b82f6" strokeWidth="1.5" />
                <circle cx="2" cy="3" r="1.5" stroke="#3b82f6" strokeWidth="1" />
                <circle cx="14" cy="3" r="1.5" stroke="#3b82f6" strokeWidth="1" />
                <circle cx="2" cy="13" r="1.5" stroke="#3b82f6" strokeWidth="1" />
                <circle cx="14" cy="13" r="1.5" stroke="#3b82f6" strokeWidth="1" />
                <line x1="5" y1="6" x2="3" y2="4" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
                <line x1="11" y1="6" x2="13" y2="4" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
                <line x1="5" y1="10" x2="3" y2="12" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
                <line x1="11" y1="10" x2="13" y2="12" stroke="#3b82f6" strokeWidth="1" opacity="0.5" />
              </svg>
            </div>
            <p className="feature-title">Knowledge graph</p>
            <p className="feature-desc">
              Stocks, sectors, and relationships mapped visually. See what
              connects, what moves together, and why.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="8" r="3.5" stroke="#3b82f6" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="1" fill="#3b82f6" />
              </svg>
            </div>
            <p className="feature-title">AI-powered alerts</p>
            <p className="feature-desc">
              Short squeeze watches, analyst actions, earnings, splits, and news
              — surfaced before the crowd finds them.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="4" width="14" height="10" rx="2" stroke="#3b82f6" strokeWidth="1.5" />
                <path d="M4 4V3a2 2 0 014 0v1M8 4V3a2 2 0 014 0v1" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M4 9h8M4 12h5" stroke="#3b82f6" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
              </svg>
            </div>
            <p className="feature-title">Deep stock pages</p>
            <p className="feature-desc">
              Every metric, every news story, earnings links, sector context, and
              peer comparisons in one place.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <footer>
          <p>
            © 2026 Vauric &nbsp;·&nbsp;{" "}
            <a href="#">Privacy policy</a> &nbsp;·&nbsp; <a href="#">Terms</a>
          </p>
          <p style={{ marginTop: 6 }}>
            Nothing on this site constitutes financial advice. Vauric is an
            information platform, not an investment advisor.
          </p>
        </footer>
      </div>
    </>
  );
}
