import { useEffect, useRef } from "react";

/**
 * AdBanner — isolation strategy
 *
 * Root cause of the cross-navigation corruption: adsbygoogle.push({})
 * mutates the <ins> element directly (injects an iframe, sets
 * data-adsbygoogle-status="done", writes inline width/height styles).
 * React's virtual DOM has no knowledge of these mutations. On the next
 * render where this component's JSX would normally produce an
 * equivalent <ins>, React either:
 *   - reuses the same DOM node (if key is stable) -> AdSense throws
 *     "already have ads" and the stale injected styles/iframe remain, or
 *   - tries to reconcile a node whose actual DOM no longer matches
 *     React's last known VDOM for it, causing layout to be computed
 *     against stale dimensions.
 *
 * Fix: build the ad markup with a plain DOM API call inside a wrapper
 * div whose children React never touches again. The wrapper's *size*
 * is fixed by CSS (.response-ad-middle / .response-ad-bottom), so
 * layout never depends on the ad's content, and on unmount we remove
 * the AdSense-managed <ins> entirely so nothing mutated lingers for
 * React to encounter on the next mount.
 */
export default function AdBanner({
  adSlot,
  adFormat = "auto",
  adLayoutKey = null,
  fullWidthResponsive = true,
  className = "",
}) {
  const containerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    // Build the <ins> entirely outside React's tree.
    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.style.height = "100%";

    ins.setAttribute("data-ad-client", process.env.REACT_APP_ADSENSE_CLIENT);
    ins.setAttribute("data-ad-slot", adSlot);
    ins.setAttribute("data-ad-format", adFormat);

    if (adLayoutKey) {
      ins.setAttribute("data-ad-layout-key", adLayoutKey);
    } else {
      ins.setAttribute("data-full-width-responsive", fullWidthResponsive.toString());
    }

    container.appendChild(ins);
    initializedRef.current = true;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdSense error:", err);
    }

    // Cleanup: remove the AdSense-managed node entirely on unmount so
    // nothing AdSense-mutated lingers in the DOM for React to encounter
    // again. A fresh <ins> is created on the next mount.
    return () => {
      try {
        if (container && ins.parentNode === container) {
          container.removeChild(ins);
        }
      } catch (_) {
        /* no-op */
      }
      initializedRef.current = false;
    };
  }, [adSlot, adFormat, adLayoutKey, fullWidthResponsive]);

  return (
    <div
      className={className}
      ref={containerRef}
      // Fixed-size box (sizes come from CSS .response-ad-middle /
      // .response-ad-bottom) -- the ad's actual content can never
      // change this box's dimensions, so .chats layout is stable
      // regardless of when/how AdSense renders inside it.
      suppressHydrationWarning
    />
  );
}
