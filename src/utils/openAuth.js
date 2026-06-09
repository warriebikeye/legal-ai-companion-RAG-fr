// src/utils/openAuth.js
//
// Median.co version — replaces the AllAppPress version
//
// Detection: Median appends "median" to the UA on both platforms
//   Android: "...MedianAndroid/1.0 median"
//   iOS:     "...MedianIOS/1.0 median"
//
// Android: forces Chrome via Intent URL (Google blocks OAuth in WebView)
// iOS:     plain redirect works fine (Median uses WKWebView + SFSafariVC)
//
// ✅ Set REACT_APP_SCHEME in your .env to your app's custom URL scheme
//    You'll find it in Median App Studio → App Settings → URL Scheme
//    e.g.  REACT_APP_SCHEME=deebees

const APP_SCHEME = process.env.REACT_APP_SCHEME || "myapp";

export function openGoogleAuth(authUrl) {
  const ua = navigator.userAgent || "";

  const isMedianAndroid = /MedianAndroid/i.test(ua);
  const isMedianIOS     = /MedianIOS/i.test(ua);
  const isMedianApp     = isMedianAndroid || isMedianIOS;

  // ── iOS inside Median ──────────────────────────────────────────────────────
  // Median on iOS uses SFSafariViewController for external links, which is a
  // real browser context — Google OAuth works fine as a plain redirect.
  if (isMedianIOS) {
    console.log("[openAuth] MedianIOS detected — plain redirect");
    window.location.href = authUrl;
    return;
  }

  // ── Android inside Median ──────────────────────────────────────────────────
  // Google blocks OAuth inside Android WebViews. We fire an Intent URL to
  // open Chrome instead. The session cookie set by the backend will carry
  // back once the deep-link redirects the user into the app.
  if (isMedianAndroid) {
    const url = new URL(authUrl);

    // Tell the backend this came from a mobile WebView
    url.searchParams.set("intent", "1");

    // Tell the backend where to redirect after successful Google callback
    // Backend reads this from session and redirects to APP_SCHEME://auth/callback
    url.searchParams.set("redirect_to", `${APP_SCHEME}://auth/callback`);

    const intentUrl =
      `intent://${url.toString().replace(/^https?:\/\//, "")}` +
      `#Intent;` +
      `scheme=https;` +
      `package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(url.toString())};` +
      `end`;

    console.log("[openAuth] MedianAndroid — opening via Chrome Intent");
    window.location.href = intentUrl;

    // Fallback: if Intent doesn't fire within 1.5s (Chrome not installed),
    // fall back to a direct redirect and let the backend handle it normally
    setTimeout(() => {
      window.location.href = url.toString();
    }, 1500);

    return;
  }

  // ── Standard browser (web) ─────────────────────────────────────────────────
  console.log("[openAuth] Standard browser — plain redirect");
  window.location.href = authUrl;
}