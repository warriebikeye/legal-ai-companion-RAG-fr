import { useMemo } from "react";

/**
 * AdBanner — full iframe isolation (AdSense-recommended SPA pattern)
 *
 * The <ins> and adsbygoogle.js live INSIDE a sandboxed iframe srcdoc.
 * AdSense can mutate its own document freely; nothing leaks into the
 * parent React tree or affects layout/scroll there.
 *
 * The wrapper div has a hard pixel height so the parent scroll container
 * never collapses or shifts when AdSense resizes its own content internally.
 */
export default function AdBanner({
  adSlot,
  adFormat = "auto",
  adLayoutKey = null,
  fullWidthResponsive = true,
  className = "",
  height = 100,
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
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        background: transparent;
        /* Critically: overflow hidden so the iframe document itself
           never tries to scroll, which would fight the parent scroller */
        overflow: hidden;
        width: 100%;
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
        height: 100%;
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
    /*
     * flexShrink:0   — never let a flex parent crush this wrapper
     * display:block  — ensure block stacking inside .bot-message-content
     * overflow:hidden — the iframe's internal reflows must not leak out
     * The hard pixel height is the scroll contract: parent layout always
     * reserves exactly this many pixels, no more, no less.
     */
    <div
      className={className}
      style={{
        width: "100%",
        height: `${height}px`,
        overflow: "hidden",
        flexShrink: 0,
        display: "block",
        borderRadius: "6px",
      }}
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
          /* scrolling must be off so the iframe never creates
             its own scroll context that fights the parent */
          overflow: "hidden",
        }}
        scrolling="no"
        loading="lazy"
      />
    </div>
  );
}
