import { useMemo, useRef } from "react";

/**
 * AdBanner — full iframe isolation (AdSense-recommended SPA pattern)
 *
 * Why this is different from previous attempts:
 *   - The <ins class="adsbygoogle"> and the adsbygoogle.js script live
 *     INSIDE a separate HTML document, loaded via srcdoc into a sandboxed
 *     iframe. They never exist in the parent DOM at all.
 *   - React never sees, creates, diffs, or reuses the <ins>/script —
 *     there is nothing for AdSense to mutate that React (or this app's
 *     CSS layout) has any awareness of.
 *   - The iframe element itself has a fixed width/height set by us. The
 *     iframe's *content* can do anything it wants internally (resize
 *     its own document, AdSense can inject whatever) — none of that can
 *     ever leak out and resize the iframe element in the parent page.
 *   - Navigating between conversations / tiers simply mounts or unmounts
 *     this <iframe> element like any other element. There is no shared
 *     mutable state between instances, so nothing can be "poisoned"
 *     across navigations. A fresh mount = a fresh document = a fresh
 *     adsbygoogle context every time.
 *
 * This is the pattern Google's own SPA/AdSense guidance recommends for
 * frameworks (React/Vue/Angular) where ads are mounted/unmounted
 * frequently during client-side navigation.
 */
export default function AdBanner({
  adSlot,
  adFormat = "auto",
  adLayoutKey = null,
  fullWidthResponsive = true,
  className = "",
  height = 100, // px — must match the CSS box height for this slot
}) {
  const client = process.env.REACT_APP_ADSENSE_CLIENT;

  const wrapperRef = useRef(null);
  const iframeRef = useRef(null);
  const touchStartRef = useRef(null);

  // ── Fallback for touch-action: pan-y not being honored ──
  // Some Android WebViews (Median/GoNative wrappers) capture all touch
  // events on an iframe regardless of touch-action, preventing the
  // ancestor .chats container from ever receiving a scroll gesture.
  //
  // Strategy: the iframe defaults to pointer-events: none, so vertical
  // scroll/drag gestures always fall through to .chats untouched. On
  // touchstart (received by the wrapper div, BEFORE the gesture would
  // enter the iframe), we briefly enable pointer-events on the iframe
  // for a short window — long enough for a genuine tap-to-click on the
  // ad to register inside the iframe, but short enough that a
  // scroll/drag gesture (which takes longer than a tap) never gets
  // captured by the iframe in the first place.
  const TAP_WINDOW_MS = 250;

  const handleTouchStart = () => {
    if (touchStartRef.current) clearTimeout(touchStartRef.current);
    if (iframeRef.current) {
      iframeRef.current.style.pointerEvents = "auto";
    }
    touchStartRef.current = setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.style.pointerEvents = "none";
      }
    }, TAP_WINDOW_MS);
  };

  const insAttrs = adLayoutKey
    ? `data-ad-layout-key="${adLayoutKey}"`
    : `data-full-width-responsive="${fullWidthResponsive.toString()}"`;

  const srcDoc = useMemo(() => `
<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        height: 100%;
        touch-action: pan-y;
      }
      .ad-wrap {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        touch-action: pan-y;
      }
      ins.adsbygoogle {
        display: block;
        width: 100%;
      }
    </style>
  </head>
  <body>
    <div class="ad-wrap">
      <ins class="adsbygoogle"
           style="display:block; width:100%; height:100%;"
           data-ad-client="${client}"
           data-ad-slot="${adSlot}"
           data-ad-format="${adFormat}"
           ${insAttrs}></ins>
    </div>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}"></script>
    <script>
      (adsbygoogle = window.adsbygoogle || []).push({});
    </script>
  </body>
</html>
  `, [client, adSlot, adFormat, adLayoutKey, fullWidthResponsive, insAttrs]);

  return (
    <div
      className={className}
      ref={wrapperRef}
      style={{ width: "100%", height: `${height}px`, overflow: "hidden" }}
      onTouchStart={handleTouchStart}
    >
      <iframe
        ref={iframeRef}
        title="advertisement"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-popups"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          overflow: "hidden",
          touchAction: "pan-y",
          // Default to non-interactive so vertical scroll gestures
          // always reach .chats. Briefly toggled to "auto" on
          // touchstart (see handleTouchStart) to allow real taps.
          pointerEvents: "none",
        }}
        scrolling="no"
        loading="lazy"
      />
    </div>
  );
          }
