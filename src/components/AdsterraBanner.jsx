import { useMemo } from "react";

/**
 * AdsterraBanner — full iframe isolation (same pattern as the old AdBanner)
 *
 * Adsterra's loaders inject scripts that either document.write() their
 * own iframe, or self-mount a sticky/social-bar widget. Both behaviors
 * are more aggressive about touching the DOM than AdSense's
 * adsbygoogle.push() was — which is exactly why this still lives inside
 * a sandboxed iframe via srcDoc:
 *   - The Adsterra <script> tags (and their target <div>, where needed)
 *     live INSIDE a separate HTML document. Adsterra can mutate that
 *     document all it wants — it never touches the parent DOM, so
 *     .chats / .chatfooter layout can never be affected.
 *   - The outer iframe element has a FIXED width/height (the `height`
 *     prop, matching the CSS box for the slot). Content inside can't
 *     resize it.
 *
 * SCROLL FIX (unchanged from AdBanner): pointer-events: none on the
 * outer iframe so touch/scroll gestures pass straight through to
 * .chats underneath instead of being captured by the iframe — critical
 * in the Median.co WebView.
 *
 * Tradeoff: ad clicks won't register while pointer-events is disabled.
 * Impression-based revenue is unaffected. Don't re-enable pointer
 * events globally on the iframe — that's what breaks scrolling.
 *
 * SUPPORTED VARIANTS (driven by `variant` prop):
 *   - "native"     → Code 1: container div + async/data-cfasync script
 *   - "social-bar"  → Code 2: self-injecting script, no container needed
 *   - "banner"      → Code 3: atOptions + invoke.js, fixed 320x50 default
 */

const ADSTERRA_UNITS = {
  native: {
    containerId: "container-b5e0a535ebd373d83d4ffe26acc9467c",
    scriptSrc:
      "https://pl29765385.effectivecpmnetwork.com/b5e0a535ebd373d83d4ffe26acc9467c/invoke.js",
  },
  socialBar: {
    scriptSrc:
      "https://pl29765551.effectivecpmnetwork.com/c9/a3/a4/c9a3a4b888ce4a6187ff32b176d8d07c.js",
  },
  banner: {
    key: "fa4af2902b41053e3e9b7bd7f80cb42c",
    scriptSrc:
      "https://www.highperformanceformat.com/fa4af2902b41053e3e9b7bd7f80cb42c/invoke.js",
    defaultWidth: 320,
    defaultHeight: 50,
  },
};

export default function AdsterraBanner({
  variant = "banner",   // "native" | "social-bar" | "banner"
  width,                 // only used for "banner" — defaults to 320
  adHeight,               // only used for "banner" — defaults to 50
  height = 50,             // outer iframe box height — match adHeight for banners
  className = "",
}) {
  const bannerWidth  = width    ?? ADSTERRA_UNITS.banner.defaultWidth;
  const bannerHeight = adHeight ?? ADSTERRA_UNITS.banner.defaultHeight;

  const srcDoc = useMemo(() => {
    let bodyMarkup = "";

    if (variant === "native") {
      const { containerId, scriptSrc } = ADSTERRA_UNITS.native;
      bodyMarkup = `
    <div id="${containerId}"></div>
    <script async="async" data-cfasync="false" src="${scriptSrc}"></script>
      `;
    } else if (variant === "social-bar") {
      bodyMarkup = `
    <script src="${ADSTERRA_UNITS.socialBar.scriptSrc}"></script>
      `;
    } else if (variant === "banner") {
      const { key, scriptSrc } = ADSTERRA_UNITS.banner;
      bodyMarkup = `
    <script>
      atOptions = {
        'key' : '${key}',
        'format' : 'iframe',
        'height' : ${bannerHeight},
        'width' : ${bannerWidth},
        'params' : {}
      };
    </script>
    <script src="${scriptSrc}"></script>
      `;
    }

    return `
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
    </style>
  </head>
  <body>
    <div class="ad-wrap">
      ${bodyMarkup}
    </div>
  </body>
</html>
    `;
  }, [variant, bannerWidth, bannerHeight]);

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