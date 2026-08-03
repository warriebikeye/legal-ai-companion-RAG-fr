// src/pages/UpgradePage.jsx
import "./UpgradePage.css";

/* ─── Bundle definitions — must match tokens.js exactly ───
   Pricing is USD-only for every visitor, regardless of country —
   the Flutterwave links accept any currency at checkout. */
const BUNDLES = [
  {
    id:       "starter",
    label:    "Starter",
    tokens:   75,
    badge:    null,
    usdPrice: "$1",
    link:     process.env.REACT_APP_FLW_STARTER_LINK,
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
    link:     process.env.REACT_APP_FLW_STANDARD_LINK,
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
    link:     process.env.REACT_APP_FLW_PRO_LINK,
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
    link:     process.env.REACT_APP_FLW_POWER_LINK,
    features: [
      "900 tokens",
      "30 contract reviews + PDFs",
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
