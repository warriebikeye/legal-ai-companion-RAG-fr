// src/components/AuthModal.jsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { oneSignalLogin } from "../hooks/useNotificationPrompt";

const API_BASE_URL = process.env.REACT_APP_BASEURL;

export default function AuthModal({ onAuthenticated }) {
  const [view, setView]               = useState("signup");
  const [firstname, setFirstname]     = useState("");
  const [lastname, setLastname]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [token, setToken]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [message, setMessage]         = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ── Referral code: pre-filled from URL (?ref=), editable by hand ──
  const [searchParams] = useSearchParams();
  const [refCode, setRefCode] = useState(searchParams.get("ref") || "");
  const refCodeFromUrl = !!searchParams.get("ref");

  const clearFeedback = () => { setError(""); setMessage(""); };

  /* ── REGISTER ─────────────────────────────────────────── */
  const handleRegister = async () => {
    if (!firstname || !email || !password) return setError("All fields are required.");
    clearFeedback();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstname,
          lastname,
          email,
          password,
          referralCode: refCode.trim() || undefined, // optional
        }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Registration failed.");

      setMessage("Code sent! Check your email.");
      setView("verify");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── VERIFY ───────────────────────────────────────────── */
  const handleVerify = async () => {
    if (!token || token.length !== 6) return setError("Enter the 6-digit code.");
    clearFeedback();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, token }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Verification failed.");
      oneSignalLogin(email);
      onAuthenticated();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── LOGIN ────────────────────────────────────────────── */
  const handleLogin = async () => {
    if (!email || !password) return setError("Email and password are required.");
    clearFeedback();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Login failed.");
      oneSignalLogin(email);
      onAuthenticated();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── RENDER ───────────────────────────────────────────── */
  return (
    <div className="auth-overlay">
      <div className="auth-modal">

        {/* ── SIGN UP ── */}
        {view === "signup" && (
          <>
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-subtitle">Africa's Legal Intelligence Engine</p>

            {/* Referral banner — only when auto-filled from a shared link */}
            {refCodeFromUrl && refCode && (
              <div style={{
                background:   "rgba(200,169,74,0.1)",
                border:       "1px solid rgba(200,169,74,0.3)",
                borderRadius: "0.75rem",
                padding:      "1rem 1.4rem",
                fontSize:     "1.3rem",
                color:        "#c8a94a",
                textAlign:    "center",
              }}>
                🎁 You were referred! Sign up and start reviewing contracts with Clauzify
              </div>
            )}

            <input className="auth-input" type="text" placeholder="First name"
              value={firstname} onChange={(e) => setFirstname(e.target.value)} />

            <input className="auth-input" type="text" placeholder="Last name (optional)"
              value={lastname} onChange={(e) => setLastname(e.target.value)} />

            <input className="auth-input" type="email" placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)} />

            <div className="password-wrapper">
              <input className="auth-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              />
              <button type="button" className="show-password-btn"
                onClick={() => setShowPassword((p) => !p)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <input className="auth-input" type="text" placeholder="Referral code (optional)"
              value={refCode} onChange={(e) => setRefCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()} />

            {error   && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}

            <button className="auth-btn primary" onClick={handleRegister} disabled={loading}>
              {loading ? <span className="auth-loader" /> : "Create Account"}
            </button>
            <p className="auth-switch">
              Already have an account?{" "}
              <span onClick={() => { clearFeedback(); setView("login"); }}>Sign in</span>
            </p>
          </>
        )}

        {/* ── VERIFY ── */}
        {view === "verify" && (
          <>
            <h2 className="auth-title">Check your email</h2>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>
            <input className="auth-input token-input" type="text"
              inputMode="numeric" maxLength={6} placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
            />

            {error   && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}

            <button className="auth-btn primary" onClick={handleVerify} disabled={loading}>
              {loading ? <span className="auth-loader" /> : "Verify"}
            </button>
            <p className="auth-switch">
              Wrong email?{" "}
              <span onClick={() => { clearFeedback(); setView("signup"); }}>Go back</span>
            </p>
          </>
        )}

        {/* ── LOGIN ── */}
        {view === "login" && (
          <>
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-subtitle">Sign in to continue</p>

            <input className="auth-input" type="email" placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)} />

            <div className="password-wrapper">
              <input className="auth-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button type="button" className="show-password-btn"
                onClick={() => setShowPassword((p) => !p)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {error   && <p className="auth-error">{error}</p>}
            {message && <p className="auth-message">{message}</p>}

            <button className="auth-btn primary" onClick={handleLogin} disabled={loading}>
              {loading ? <span className="auth-loader" /> : "Sign In"}
            </button>
            <p className="auth-switch">
              No account?{" "}
              <span onClick={() => { clearFeedback(); setView("signup"); }}>Create one</span>
            </p>
          </>
        )}

      </div>
    </div>
  );
}