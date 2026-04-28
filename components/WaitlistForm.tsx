"use client";

import { useState } from "react";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSubmit() {
    setServerError("");
    if (!email || !email.includes("@")) {
      setEmailError(true);
      setTimeout(() => setEmailError(false), 1500);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: source || null }),
      });
      if (res.ok || res.status === 409) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setServerError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="form-wrap">
        <div className="form-card">
          <div className="success-state">
            <div className="success-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M4 10l4 4 8-8"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="success-title">You&apos;re on the list.</p>
            <p className="success-sub">
              We&apos;ll be in touch when early access opens.
              <br />
              Expect something worth the wait.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-wrap">
      <div className="form-card">
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            type="email"
            id="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={emailError ? { borderColor: "#ef4444" } : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="source">How did you find us?</label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="" disabled>
              Select an option
            </option>
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="x">X (Twitter)</option>
            <option value="reddit">Reddit</option>
            <option value="friend">Friend / word of mouth</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Joining…" : "Join the waitlist"}
        </button>
        {serverError && <p className="form-error">{serverError}</p>}
        <p className="form-note">
          Early waitlist members receive a <strong>lifetime discount</strong>{" "}
          when Pro launches. No spam. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
