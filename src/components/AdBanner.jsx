import { useEffect, useRef } from "react";

export default function AdBanner({
  adSlot,
  adFormat = "auto",
  adLayoutKey = null,
  fullWidthResponsive = true,
  className = "",
}) {
  const insRef = useRef(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    // Guard: only push once per mounted <ins>, and only if this
    // specific element hasn't already been initialized by AdSense.
    // Re-pushing on an already-initialized <ins> throws AdSense's
    // "already have ads" TagError AND leaves stale inline styles /
    // dimensions on the node, which can bleed into layout on
    // subsequent navigations.
    if (pushedRef.current) return;
    const el = insRef.current;
    if (!el || el.getAttribute("data-adsbygoogle-status")) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushedRef.current = true;
    } catch (err) {
      console.error("AdSense error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={className}>
      <ins
        // ── KEY FIX: force a brand-new <ins> per AdBanner instance.
        // Combined with giving each <AdBanner> a unique `key` prop
        // from the parent (tied to message id / conversation id),
        // this guarantees AdSense never reuses or re-initializes a
        // node that already has injected styles/dimensions from a
        // previous render.
        key={`${adSlot}-${adLayoutKey ?? "auto"}`}
        ref={insRef}
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
