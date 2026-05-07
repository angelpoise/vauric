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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p style={{ fontFamily: DM, fontSize: 13, color: "#334155", margin: "0 0 48px" }}>
          Last updated: May 2026
        </p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 40 }}>

          <p style={prose}>
            Please read these Terms of Service carefully before using Vauric. By accessing or using the platform you agree to be bound by these terms.
          </p>

          {/* 1 */}
          <h2 style={h2style}>1. Service description</h2>
          <p style={prose}>
            Vauric is an information platform that provides a visual knowledge graph of financial markets, stock data, news aggregation, and AI-generated analysis. Vauric is <strong style={{ color: "#e2e8f0", fontWeight: 500 }}>not a financial advisor</strong> and does not provide investment advice. All information on the platform is provided for informational and educational purposes only.
          </p>
          <p style={prose}>
            Nothing on Vauric constitutes a recommendation to buy, sell, or hold any security or financial instrument. You are solely responsible for any investment decisions you make.
          </p>

          {/* 2 */}
          <h2 style={h2style}>2. Acceptable use</h2>
          <p style={prose}>
            You must be at least 18 years old to use Vauric. By using the platform you confirm that you meet this requirement.
          </p>
          <p style={prose}>
            You agree to use Vauric for personal, non-commercial purposes only. You must not:
          </p>
          <ul style={{ ...prose, paddingLeft: 24, margin: "0 0 20px" }}>
            <li style={{ marginBottom: 8 }}>Scrape, crawl, or systematically extract data from the platform</li>
            <li style={{ marginBottom: 8 }}>Use automated tools, bots, or scripts to access the service without prior written permission</li>
            <li style={{ marginBottom: 8 }}>Reproduce, redistribute, or resell any content or data from Vauric</li>
            <li style={{ marginBottom: 8 }}>Attempt to reverse-engineer, decompile, or access underlying source code</li>
            <li style={{ marginBottom: 8 }}>Use the service in any way that violates applicable laws or regulations</li>
            <li style={{ marginBottom: 8 }}>Share your account credentials with any other person</li>
          </ul>
          <p style={prose}>
            We reserve the right to suspend or terminate accounts that violate these terms without notice.
          </p>

          {/* 3 */}
          <h2 style={h2style}>3. Subscription terms</h2>
          <p style={prose}>
            Vauric offers a free tier and a paid Pro subscription. Pro subscriptions are billed monthly on a recurring basis. By subscribing you authorise us to charge your payment method automatically at the start of each billing period.
          </p>
          <p style={prose}>
            You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period — you will retain Pro access until that date. <strong style={{ color: "#e2e8f0", fontWeight: 500 }}>We do not issue refunds for partial billing periods.</strong>
          </p>
          <p style={prose}>
            Prices may change with at least 30 days&rsquo; notice communicated by email or in-app notification.
          </p>

          {/* 4 */}
          <h2 style={h2style}>4. Pro tier features</h2>
          <p style={prose}>
            Pro tier features are provided as described at the time of purchase. We reserve the right to modify, add, or remove features with reasonable notice. If we remove a feature that was central to your subscription, you may cancel for a prorated refund at our discretion.
          </p>

          {/* 5 */}
          <h2 style={h2style}>5. Intellectual property</h2>
          <p style={prose}>
            All content, design, code, branding, data compilations, and analysis generated by Vauric are the intellectual property of Vauric and its licensors. You are granted a limited, non-exclusive, non-transferable licence to access and use the platform for your personal use during the term of your subscription.
          </p>
          <p style={prose}>
            Third-party data (market prices, news articles, SEC filings) is provided under licence from its respective owners and is subject to their terms.
          </p>

          {/* 6 */}
          <h2 style={h2style}>6. Limitation of liability</h2>
          <p style={prose}>
            Vauric is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or that market data will be accurate or timely.
          </p>
          <p style={prose}>
            To the fullest extent permitted by law, Vauric and its operators shall not be liable for any direct, indirect, incidental, or consequential loss arising from:
          </p>
          <ul style={{ ...prose, paddingLeft: 24, margin: "0 0 20px" }}>
            <li style={{ marginBottom: 8 }}>Investment or trading decisions made using information from the platform</li>
            <li style={{ marginBottom: 8 }}>Inaccuracy, delay, or unavailability of market data or news</li>
            <li style={{ marginBottom: 8 }}>Service interruptions or data loss</li>
            <li style={{ marginBottom: 8 }}>Actions taken or not taken based on AI-generated analysis</li>
          </ul>

          {/* 7 */}
          <h2 style={h2style}>7. Governing law</h2>
          <p style={prose}>
            These terms are governed by the laws of <strong style={{ color: "#e2e8f0", fontWeight: 500 }}>Scotland, United Kingdom</strong>. Any disputes shall be subject to the exclusive jurisdiction of the Scottish courts.
          </p>

          {/* 8 */}
          <h2 style={h2style}>8. Changes to these terms</h2>
          <p style={prose}>
            We may update these terms from time to time. Material changes will be communicated by email or a notice on the platform with at least 14 days&rsquo; advance notice. Continued use of Vauric after changes take effect constitutes acceptance of the revised terms.
          </p>

          {/* 9 */}
          <h2 style={h2style}>9. Contact</h2>
          <p style={prose}>
            Questions about these terms should be sent to{" "}
            <a href="mailto:hello@vauric.io" style={{ color: "#3b82f6", textDecoration: "none" }}>hello@vauric.io</a>.
          </p>

        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 64, paddingTop: 24, textAlign: "center", fontFamily: DM, fontSize: 12, color: "#334155" }}>
          <p>© 2026 Vauric &nbsp;·&nbsp; <Link href="/privacy" style={{ color: "#334155", textDecoration: "none" }}>Privacy Policy</Link></p>
          <p style={{ marginTop: 6 }}>Vauric is operated by Vauric Ltd (registration pending). Registered in Scotland, United Kingdom.</p>
        </div>

      </div>
    </div>
  );
}
