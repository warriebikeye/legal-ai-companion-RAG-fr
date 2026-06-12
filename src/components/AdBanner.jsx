import { useMemo } from "react";

/**
 * AdBanner — full iframe isolation (AdSense-recommended SPA pattern)
 *
 * Why this is different from earlier attempts:
 *   - The <ins class="adsbygoogle"> and the adsbygoogle.js script live
 *     INSIDE a separate HTML document, loaded via srcdoc into a sandboxed
 *     iframe. They never exist in the parent DOM at all, so AdSense can
 *     never mutate anything React is aware of, and layout/.chats sizing
 *     can never be affected by what happens inside the iframe's document.
 *   - The iframe element itself has a fixed width/height (matching the
 *     CSS box of .response-ad-middle / .response-ad-bottom). Its content
 *     cannot resize it.
 *
 * SCROLL FIX: the iframe is set to pointer-events: none. Without this,
 * the iframe — and the WebView in particular — captures ALL touch
 * events that start over it, including vertical drags meant to scroll
 * .chats. With pointer-events: none, every touch/scroll gesture passes
 * straight through the iframe to .chats underneath.
 *
 * Tradeoff: ad clicks won't register while this is set. AdSense
 * impressions (viewability) still count for impression-based formats.
 * If click-through revenue is needed later, that requires a separate,
 * carefully-scoped tap-detection layer — do not re-enable pointer
 * events on the iframe globally, as that's what breaks scrolling.
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
        overflow: hidden;
        height: 100%;
      }
      .ad-wrap {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
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
      style={{ width: "100%", height: `${height}px`, overflow: "hidden" }}
    >
      <iframe
        title="advertisement"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin allow-popups"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          overflow: "hidden",
          // ── KEY FIX: never let this iframe capture touch/scroll ──
          pointerEvents: "none",
        }}
        scrolling="no"
        loading="lazy"
        tabIndex={-1}
      />
    </div>
  );
}
