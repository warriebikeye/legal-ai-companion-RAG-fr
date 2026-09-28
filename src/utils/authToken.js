// src/utils/authToken.js
//
// Bearer-token auth. The token is an opaque session id the backend
// checks against Redis — works the same on web and inside the
// Median-wrapped app's WebView, where cross-site cookies are unreliable.
//
// Alongside it we cache the last-known profile so pages can paint the
// logged-in UI instantly on load. The cache is display-only: /auth/me
// always has the final say, and a 401 clears both.

const TOKEN_KEY = "auth_token";
const USER_KEY  = "auth_user";

/** Fired on window when the backend rejects our token (401). */
export const AUTH_EXPIRED_EVENT = "auth:expired";

export function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setStoredToken(token) {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
}

export function clearStoredToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

export function authHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─── Cached profile (display only) ─── */

export function getCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Accepts an /auth/me response and stores the profile fields in the
 *  same shape readAuthCookie() returns. */
export function cacheUserFromMe(data) {
  if (!data?.isAuthenticated) return;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify({
      firstname:          data.firstname ?? data.name ?? "",
      lastname:           data.lastname ?? "",
      email:              data.userEmail ?? "",
      photo:              data.userImage ?? "",
      subscriptionTier:   data.subscriptionTier ?? "free",
      subscriptionStatus: data.subscriptionStatus ?? "inactive",
    }));
  } catch { /* storage unavailable — just no instant paint next time */ }
}

export function clearCachedUser() {
  try { localStorage.removeItem(USER_KEY); } catch { /* storage unavailable */ }
}

/** Logout / expired session — drop everything auth-related. */
export function clearAuth() {
  clearStoredToken();
  clearCachedUser();
}

/** Call with every response from an authenticated request. On a 401
 *  (session expired or revoked) it clears local auth and fires
 *  AUTH_EXPIRED_EVENT so the page can show the login modal. Only
 *  acts when we actually sent a token; 503 (session store down) is
 *  deliberately ignored. */
export function handleUnauthorized(response, sentToken) {
  if (response.status === 401 && sentToken) {
    clearAuth();
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

/** fetch() for authenticated, non-encrypted endpoints (streams, file
 *  downloads, multipart uploads, /auth/*). Adds the bearer token and
 *  cookies, and handles an expired session. */
export async function authFetch(url, options = {}) {
  const auth = authHeaders();
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: { ...(options.headers || {}), ...auth },
  });
  handleUnauthorized(response, !!auth.Authorization);
  return response;
}
