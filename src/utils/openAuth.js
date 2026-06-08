// src/utils/openAuth.js
//
// Drop-in replacement for window.location.href = `${API_BASE_URL}/auth/google`
//
// Usage in HomePage.jsx:
//   import { openGoogleAuth } from '../utils/openAuth';
//   onClick={() => openGoogleAuth(`${API_BASE_URL}/auth/google`)}

export function openGoogleAuth(authUrl) {
  const ua = navigator.userAgent || "";

  // Detect Android WebView via the "; wv)" token Google looks for
  const isAndroidWebView =
    /; wv\)/.test(ua) ||
    (/Android/.test(ua) && /Version\/\d/.test(ua) && !/Chrome/.test(ua));

  if (isAndroidWebView) {
    // Tell the backend this is a WebView request so it can fix the UA
    // even if the token check above missed it
    const url = new URL(authUrl);
    url.searchParams.set("intent", "1");

    // Try Android Intent URL first — asks OS to open in Chrome directly
    // bypassing the WebView entirely
    const intentUrl =
      `intent://${url.toString().replace(/^https?:\/\//, "")}` +
      `#Intent;` +
      `scheme=https;` +
      `package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(url.toString())};` +
      `end`;

    console.log("[openAuth] WebView detected — using Intent URL");
    window.location.href = intentUrl;
  } else {
    // Normal browser — plain redirect
    window.location.href = authUrl;
  }
}