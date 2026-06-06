import "./UpgradePage.css";

const API_BASE_URL =
  process.env.REACT_APP_BASEURL;

function UpgradePage() {
  const dailyLink =
    process.env.REACT_APP_FLW_DAILY_LINK;
  const monthlyLink =
    process.env.REACT_APP_FLW_MONTHLY_LINK;
  const dailyProdLink =
    process.env.REACT_APP_FLW_PROD_DAILY_LINK;
  const monthlyProdLink =
    process.env.REACT_APP_FLW_PROD_MONTHLY_LINK;
  return (
    <div className="upgradePage">
      <div className="upgradeContainer">

        <div className="upgradeHeader">
          <h1>Upgrade to Pro</h1>

          <p>
            Unlock deeper reasoning,
            larger document analysis,
            premium AI responses,
            and faster legal intelligence.
          </p>
        </div>

        <div className="pricingGrid">

          {/* DAILY PLAN */}

          <div className="pricingCard">
            <div className="planBadge">
              DAILY PASS
            </div>

            <h2>₦700 / $0.5</h2>

            <p className="planDuration">
              24 Hours Access
            </p>

            <ul>
              <li>
                Gemini 2.5 Pro
              </li>

              <li>
                Larger Context Window
              </li>

              <li>
                Better Legal Reasoning
              </li>

              <li>
                Faster Responses
              </li>

              <li>
                Upload Large Documents
              </li>
            </ul>

            <button
              className="upgradeButton"
              onClick={() =>
                window.location.href =
                dailyLink
              }
              onClick={() => {
                window.location.href =
                  process.env.ENVIRONMENT === "production"
                    ? dailyProdLink
                    : dailyLink;
              }}
            >
              Upgrade Daily
            </button>
          </div>

          {/* MONTHLY PLAN */}

          <div className="pricingCard featuredPlan">

            <div className="popularBadge">
              MOST POPULAR
            </div>

            <div className="planBadge">
              MONTHLY PRO
            </div>

            <h2>₦5500 / $4</h2>

            <p className="planDuration">
              30 Days Access
            </p>

            <ul>
              <li>
                Everything in Daily
              </li>

              <li>
                Maximum AI Quality
              </li>

              <li>
                Priority Processing
              </li>

              <li>
                Larger Legal Memory
              </li>

              <li>
                Premium AI Models
              </li>
            </ul>

            <button
              className="upgradeButton premiumBtn"
              onClick={() => {
                window.location.href =
                  process.env.ENVIRONMENT === "production"
                    ? monthlyProdLink
                    : monthlyLink;
              }}
            >
              Upgrade Monthly
            </button>
          </div>
        </div>

        <div className="upgradeFooter">
          Secure payment powered by Flutterwave
        </div>
      </div>
    </div>
  );
}

export default UpgradePage;