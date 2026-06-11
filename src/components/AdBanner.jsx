import { useEffect } from "react";

export default function AdBanner({
  adSlot,
  adFormat = "auto",
  adLayoutKey = null,
  fullWidthResponsive = true,
  className = "chat bot",
}) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdSense error:", err);
    }
  }, []);

  return (
    <div className={className}>
      <ins
        className="adsbygoogle"
        style={{
          display: "block",
          margin: "20px 0",
        }}
        data-ad-client={process.env.REACT_APP_ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        {...(adLayoutKey
          ? { "data-ad-layout-key": adLayoutKey }
          : {})}
        {...(!adLayoutKey
          ? {
              "data-full-width-responsive":
                fullWidthResponsive.toString(),
            }
          : {})}
      />
    </div>
  );
}