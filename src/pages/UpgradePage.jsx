// src/pages/UpgradePage.jsx
import "./UpgradePage.css";

/* ─── Bundle definitions — must match tokens.js exactly ─── */
const BUNDLES = [
  {
    id:       "starter",
    label:    "Starter",
    tokens:   75,
    badge:    null,
    prices:   { NGN: "₦1,500", KES: "KSh 200", GHS: "GH₵ 20", ZAR: "R25" },
    link:     process.env.REACT_APP_FLW_STARTER_LINK,
    features: [
      "75 tokens",
      "1 contract review + PDF",
      "18 legal Q&As",
      "No ads while balance lasts",
    ],
  },
  {
    id:       "standard",
    label:    "Standard",
    tokens:   170,
    badge:    null,
    prices:   { NGN: "₦3,500", KES: "KSh 450", GHS: "GH₵ 45", ZAR: "R55" },
    link:     process.env.REACT_APP_FLW_STANDARD_LINK,
    features: [
      "170 tokens",
      "2 contract reviews + PDFs",
      "42 legal Q&As",
      "No ads while balance lasts",
    ],
  },
  {
    id:       "pro",
    label:    "Pro",
    tokens:   400,
    badge:    "MOST POPULAR",
    prices:   { NGN: "₦8,000", KES: "KSh 1,000", GHS: "GH₵ 100", ZAR: "R130" },
    link:     process.env.REACT_APP_FLW_PRO_LINK,
    features: [
      "400 tokens",
      "6 contract reviews + PDFs",
      "100 legal Q&As",
      "No ads while balance lasts",
    ],
  },
  {
    id:       "power",
    label:    "Power",
    tokens:   900,
    badge:    "BEST VALUE",
    prices:   { NGN: "₦18,000", KES: "KSh 2,300", GHS: "GH₵ 230", ZAR: "R300" },
    link:     process.env.REACT_APP_FLW_POWER_LINK,
    features: [
      "900 tokens",
      "13 contract reviews + PDFs",
      "225 legal Q&As",
      "No ads while balance lasts",
    ],
  },
];

function UpgradePage() {
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

              {/* Show all local currency prices */}
              <div className="priceBlock">
                {Object.entries(bundle.prices).map(([currency, price]) => (
                  <div key={currency} className="priceRow">
                    <span className="priceCurrency">{currency}</span>
                    <span className="priceAmount">{price}</span>
                  </div>
                ))}
              </div>

              <p className="planDuration">{bundle.tokens} tokens</p>

              <ul>
                {bundle.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>

              <button
                className={`upgradeButton ${bundle.badge === "MOST POPULAR" ? "premiumBtn" : ""}`}
                onClick={() => {
                  window.location.href = bundle.link;
                }}
              >
                Get {bundle.label}
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