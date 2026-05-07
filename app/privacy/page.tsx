import Logo from "@/components/Logo";
import Link from "next/link";

const DM    = 'var(--font-dm-sans), "DM Sans", sans-serif';
const SERIF = 'var(--font-dm-serif), serif';

const prose: React.CSSProperties = {
  fontSize: 15,
  color: "#94a3b8",
  lineHeight: 1.85,
  fontWeight: 300,
  fontFamily: DM,
  margin: "0 0 20px",
};

const h2style: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: 22,
  fontWeight: 400,
  color: "#f1f5f9",
  margin: "48px 0 14px",
};

const h3style: React.CSSProperties = {
  fontFamily: DM,
  fontSize: 13,
  fontWeight: 600,
  color: "#e2e8f0",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  margin: "28px 0 8px",
};

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#05080f", color: "#f1f5f9" }}>
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "32px 32px 96px" }}>

        {/* Back */}
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          color: "#475569", fontSize: 13, textDecoration: "none",
          fontFamily: DM, marginBottom: 48,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Home
        </Link>

        {/* Logo */}
        <div style={{ marginBottom: 48 }}>
          <Logo variant="default" />
        </div>

        {/* Header */}
        <h1 style={{ fontFamily: SERIF, fontSize: 40, fontWeight: 400, color: "#f1f5f9", margin: "0 0 10px" }}>
          Privacy Policy
        </h1>
        <p style={{ fontFamily: DM, fontSize: 13, color: "#334155", margin: "0 0 48px" }}>
          Last updated: May 2026
        </p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 40 }}>

          <p style={prose}>
            Vauric (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your personal information. This policy explains what data we collect, how we use it, and your rights in relation to it.
          </p>

          {/* 1 */}
          <h2 style={h2style}>1. Information we collect</h2>

          <h3 style={h3style}>Waitlist &amp; account data</h3>
          <p style={prose}>
            When you join the waitlist or create an account we collect your email address. We also record how you found us if you choose to tell us. Account authentication is handled by Clerk and may include your name and profile picture if you sign in with a social provider.
          </p>

          <h3 style={h3style}>Payment information</h3>
          <p style={prose}>
            Subscription payments are processed by Stripe. We never see or store your full card number. Stripe provides us with a payment token, subscription status, and billing history.
          </p>

          <h3 style={h3style}>Usage data</h3>
          <p style={prose}>
            We record which stock detail pages you visit so we can prioritise analysis freshness and improve the product. We do not sell this data or use it for advertising.
          </p>

          {/* 2 */}
          <h2 style={h2style}>2. How we use your information</h2>
          <p style={prose}>
            We use the information we hold to:
          </p>
          <ul style={{ ...prose, paddingLeft: 24, margin: "0 0 20px" }}>
            <li style={{ marginBottom: 8 }}>Provide and improve the Vauric service</li>
            <li style={{ marginBottom: 8 }}>Send you product updates and launch announcements (you may unsubscribe at any time)</li>
            <li style={{ marginBottom: 8 }}>Process payments and manage your subscription</li>
            <li style={{ marginBottom: 8 }}>Detect and prevent fraud or abuse</li>
          </ul>
          <p style={prose}>
            We do not use your data for advertising, profiling, or sale to third parties.
          </p>

          {/* 3 */}
          <h2 style={h2style}>3. Data storage</h2>
          <p style={prose}>
            Your data is stored on <strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Supabase</strong>, a managed PostgreSQL platform hosted in the EU (Frankfurt, Germany). Authentication data is managed by <strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Clerk</strong>, which stores data in the United States and is compliant with EU–US data transfer frameworks.
          </p>
          <p style={prose}>
            We retain your account data for as long as your account is active or as required by law. Waitlist data is deleted after launch or on request.
          </p>

          {/* 4 */}
          <h2 style={h2style}>4. Third-party services</h2>
          <p style={prose}>We use the following third-party services to operate Vauric:</p>
          <ul style={{ ...prose, paddingLeft: 24, margin: "0 0 20px" }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Stripe</strong> — payment processing (stripe.com/privacy)</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Clerk</strong> — authentication and user management (clerk.com/privacy)</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Supabase</strong> — database and API infrastructure (supabase.com/privacy)</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Finnhub</strong> — financial news data (finnhub.io/privacy-policy)</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Polygon.io</strong> — market price data (polygon.io/privacy)</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Anthropic</strong> — AI-generated analysis (anthropic.com/privacy)</li>
          </ul>
          <p style={prose}>
            Each third-party service is governed by its own privacy policy. We share only the minimum data necessary for each service to function.
          </p>

          {/* 5 */}
          <h2 style={h2style}>5. Cookies</h2>
          <p style={prose}>
            Vauric uses minimal cookies. We set only those required for authentication (via Clerk) and session management. We do not use advertising, tracking, or analytics cookies. You can disable cookies in your browser, but this will prevent you from signing in.
          </p>

          {/* 6 */}
          <h2 style={h2style}>6. Your rights</h2>
          <p style={prose}>
            Under GDPR and UK data protection law you have the right to:
          </p>
          <ul style={{ ...prose, paddingLeft: 24, margin: "0 0 20px" }}>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Access</strong> the personal data we hold about you</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Rectification</strong> of inaccurate data</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Erasure</strong> (&ldquo;right to be forgotten&rdquo;) — request deletion of your account and data</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li style={{ marginBottom: 8 }}><strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Objection</strong> to processing for direct marketing</li>
          </ul>
          <p style={prose}>
            To exercise any of these rights, contact us at <a href="mailto:hello@vauric.io" style={{ color: "#3b82f6", textDecoration: "none" }}>hello@vauric.io</a>.
          </p>

          {/* 7 */}
          <h2 style={h2style}>7. Financial data disclaimer</h2>
          <p style={prose}>
            All market data, news, analysis, and information provided by Vauric is for informational purposes only. Nothing on this platform constitutes financial advice, investment advice, or a recommendation to buy or sell any security. Always do your own research and consult a qualified financial advisor before making investment decisions.
          </p>

          {/* 8 */}
          <h2 style={h2style}>8. Changes to this policy</h2>
          <p style={prose}>
            We may update this policy from time to time. Material changes will be communicated by email or a notice on the platform. Continued use of Vauric after changes take effect constitutes acceptance of the revised policy.
          </p>

          {/* 9 */}
          <h2 style={h2style}>9. Contact</h2>
          <p style={prose}>
            Questions about this policy or your data should be sent to{" "}
            <a href="mailto:hello@vauric.io" style={{ color: "#3b82f6", textDecoration: "none" }}>hello@vauric.io</a>.
          </p>

        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 64, paddingTop: 24, textAlign: "center", fontFamily: DM, fontSize: 12, color: "#334155" }}>
          <p>© 2026 Vauric &nbsp;·&nbsp; <Link href="/terms" style={{ color: "#334155", textDecoration: "none" }}>Terms of Service</Link></p>
          <p style={{ marginTop: 6 }}>Vauric is operated by Vauric Ltd (registration pending). Registered in Scotland, United Kingdom.</p>
        </div>

      </div>
    </div>
  );
}
