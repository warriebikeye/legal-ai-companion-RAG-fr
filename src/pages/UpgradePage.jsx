// src/pages/UpgradePage.jsx
import "./UpgradePage.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { encryptedFetch } from "../utils/encryption";
import { readAuthCookie } from "../hooks/useAuthCookie";
import { authHeaders, setStoredToken } from "../utils/authToken";

const API_BASE_URL = process.env.REACT_APP_BASEURL;

/* ─── Bundle definitions — must match tokens.js exactly ───
   Pricing is USD-only for every visitor, regardless of country —
   Flutterwave Inline accepts any currency/method at checkout. */
const BUNDLES = [
  {
    id:       "starter",
    label:    "Starter",
    tokens:   75,
    badge:    null,
    usdPrice: "$1",
    amount:   1,
    features: [
      "75 tokens",
      "2 contract reviews + PDFs",
      "18 legal Q&As",
      "No ads while balance lasts",
    ],
  },
  {
    id:       "standard",
    label:    "Standard",
    tokens:   170,
    badge:    null,
    usdPrice: "$2.50",
    amount:   2.5,
    features: [
      "170 tokens",
      "5 contract reviews + PDFs",
      "42 legal Q&As",
      "No ads while balance lasts",
    ],
  },
  {
    id:       "pro",
    label:    "Pro",
    tokens:   400,
    badge:    "MOST POPULAR",
    usdPrice: "$5",
    amount:   5,
    features: [
      "400 tokens",
      "13 contract reviews + PDFs",
      "100 legal Q&As",
      "No ads while balance lasts",
    ],
  },
  {
    id:       "power",
    label:    "Power",
    tokens:   900,
    badge:    "BEST VALUE",
    usdPrice: "$12",
    amount:   12,
    features: [
      "900 tokens",
      "30 contract reviews + PDFs",
      "225 legal Q&As",
      "No ads while balance lasts",
    ],
  },
];

function UpgradePage() {
  const navigate = useNavigate();
  const [processingId, setProcessingId] = useState(null);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', text }

  /* ─── Resolve the logged-in user ──────────────────────────
     readAuthCookie() is a fast, zero-fetch path — but the
     JS-readable `ub_ui` cookie isn't reliably readable inside
     some wrapped-app WebViews even when the real session
     cookie is working fine (the rest of the app stays logged
     in). Fall back to /auth/me (same pattern HomePage.jsx
     uses) before concluding the user really isn't logged in.
  ───────────────────────────────────────────────────────── */
  async function resolveAuthenticatedUser() {
    const cookieUser = readAuthCookie();
    if (cookieUser && cookieUser.email) return cookieUser;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method:      "GET",
        credentials: "include",
        headers:     { ...authHeaders() },
      });
      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.isAuthenticated || !data?.userEmail) return null;

      setStoredToken(data.token);

      return {
        email:     data.userEmail,
        firstname: data.firstname || "",
        lastname:  data.lastname || "",
      };
    } catch {
      return null;
    }
  }

  async function handleUpgrade(bundle) {
    if (processingId) return;

    const user = await resolveAuthenticatedUser();
    if (!user || !user.email) {
      setStatus({ type: "error", text: "Please log in to top up your wallet." });
      return;
    }

    if (typeof window.FlutterwaveCheckout !== "function") {
      setStatus({ type: "error", text: "Payment system is still loading — please try again in a moment." });
      return;
    }

    setStatus(null);
    setProcessingId(bundle.id);

    window.FlutterwaveCheckout({
      public_key: process.env.REACT_APP_FLW_PUBLIC_KEY,
      tx_ref:     `topup-${bundle.id}-${Date.now()}`,
      amount:     bundle.amount,
      currency:   "USD",
      payment_options: "card,banktransfer,mobilemoney,ussd",
      customer: {
        email: user.email,
        name:  [user.firstname, user.lastname].filter(Boolean).join(" ") || user.email,
      },
      customizations: {
        title:       "Clauzify",
        description: `${bundle.label} — ${bundle.tokens} tokens`,
      },
      meta: { bundleId: bundle.id },
      callback: async (response) => {
        if (typeof window.closePaymentModal === "function") {
          window.closePaymentModal();
        }

        if (response?.status !== "successful") {
          setProcessingId(null);
          setStatus({ type: "error", text: "Payment was not completed." });
          return;
        }

        try {
          const data = await encryptedFetch(`${API_BASE_URL}/payments/verify`, {
            method:      "POST",
            credentials: "include",
            body: {
              transactionId: response.transaction_id,
              bundleId:      bundle.id,
            },
          });

          setStatus({
            type: "success",
            text: `${data.bundle} activated — +${data.tokens} tokens added (new balance: ${data.wallet}).`,
          });

          setTimeout(() => {
            navigate("/");
            window.location.reload();
          }, 2500);
        } catch (err) {
          setStatus({
            type: "error",
            text: err.message || "Payment verification failed. Please contact support with your transaction ID.",
          });
        } finally {
          setProcessingId(null);
        }
      },
      onclose: () => {
        setProcessingId(null);
      },
    });
  }

  return (
    <div className="upgradePage">
      <div className="upgradeContainer">

        <div className="upgradeHeader">
          <h1>Top Up Your Wallet</h1>
          <p>
            Buy tokens to ask legal questions, review contracts,
            and download PDF reports. Tokens are valid for 90 days —
            use them at your own pace.
          </p>
        </div>

        {status && (
          <div className={`upgradeStatus ${status.type === "error" ? "upgradeStatus--error" : "upgradeStatus--success"}`}>
            {status.text}
          </div>
        )}

        <div className="pricingGrid">
          {BUNDLES.map((bundle) => (
            <div
              key={bundle.id}
              className={`pricingCard ${bundle.badge === "MOST POPULAR" ? "featuredPlan" : ""}`}
            >
              {bundle.badge && (
                <div className="popularBadge">{bundle.badge}</div>
              )}

              <div className="planBadge">{bundle.label.toUpperCase()}</div>

              <div className="priceBlock">
                <span className="priceAmount">{bundle.usdPrice}</span>
                <span className="priceCurrency">USD</span>
              </div>

              <p className="planDuration">{bundle.tokens} tokens</p>

              <ul>
                {bundle.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>

              <button
                className={`upgradeButton ${bundle.badge === "MOST POPULAR" ? "premiumBtn" : ""}`}
                disabled={!!processingId}
                onClick={() => handleUpgrade(bundle)}
              >
                {processingId === bundle.id ? "Processing..." : `Get ${bundle.label}`}
              </button>
            </div>
          ))}
        </div>

        <div className="upgradeFooter">
          Secure payment powered by Flutterwave ·
          Cards, Bank Transfer, Mobile Money & USSD accepted
        </div>

      </div>
    </div>
  );
}

export default UpgradePage;
