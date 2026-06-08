// src/utils/openAuth.js
//
// Drop-in replacement for window.location.href = `${API_BASE_URL}/auth/google`
//
// Usage in HomePage.jsx:
//   import { openGoogleAuth } from '../utils/openAuth';
//   onClick={() => openGoogleAuth(`${API_BASE_URL}/auth/google`)}

// ✅ Replace "myapp" with your actual AllAppPress custom URL scheme
// Check AllAppPress dashboard → App Settings → URL Scheme
const APP_SCHEME = "myapp";

export function openGoogleAuth(authUrl) {
  const ua = navigator.userAgent || "";

  // Detect Android WebView via the "; wv)" token Google looks for
  const isAndroidWebView =
    /; wv\)/.test(ua) ||
    (/Android/.test(ua) && /Version\/\d/.test(ua) && !/Chrome/.test(ua));

  if (isAndroidWebView) {
    const url = new URL(authUrl);

    // ✅ Tell backend this is a WebView/mobile request
    url.searchParams.set("intent", "1");

    // ✅ Tell backend where to redirect after successful auth
    // Backend must redirect to this scheme after Google callback
    url.searchParams.set(
      "redirect_to",
      `${APP_SCHEME}://auth/callback`
    );

    // Intent URL — asks OS to open in Chrome, passing our url through
    const intentUrl =
      `intent://${url.toString().replace(/^https?:\/\//, "")}` +
      `#Intent;` +
      `scheme=https;` +
      `package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(url.toString())};` +
      `end`;

    console.log("[openAuth] Android WebView detected — opening via Intent");
    window.location.href = intentUrl;

    // ✅ Fallback: if Intent URL doesn't work after 1.5s, try direct redirect
    // This covers devices where Chrome isn't the default browser
    setTimeout(() => {
      window.location.href = url.toString();
    }, 1500);

  } else {
    // Normal browser or iOS — plain redirect
    console.log("[openAuth] Standard browser — plain redirect");
    window.location.href = authUrl;
  }
}