// src/hooks/useAuthCookie.js

/**
 * Reads the `ub_sess` JWT cookie and decodes its payload
 * WITHOUT signature verification (that's the server's job).
 *
 * Returns a user object if the cookie exists and is not
 * expired, otherwise returns null.
 *
 * Shape of returned object:
 * {
 *   id, firstname, lastname, email, photo,
 *   subscriptionTier,   // "free" | "premium" | …
 *   subscriptionStatus, // "active" | "inactive" | …
 *   exp,                // unix timestamp
 * }
 *
 * Security note:
 *   - The cookie is HttpOnly=true in production, so this
 *     function will return null there (as intended — the
 *     browser attaches the cookie automatically on every
 *     request; JS never needs to read it for security).
 *   - In development (HttpOnly=false for local testing)
 *     this hook allows zero-fetch auth state on load.
 *
 * Wait — if HttpOnly blocks JS, how does this help?
 *   We set a SECOND, non-HttpOnly "presence" cookie that
 *   contains only the safe UI payload (no session secret,
 *   just the JWT we already sign). See setAuthCookie.js for
 *   the `ub_ui` companion cookie. The real `ub_sess` JWT
 *   remains HttpOnly as the hardened security cookie.
 */

const UI_COOKIE_NAME = "ub_ui";

function getCookieValue(name) {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? match.split("=").slice(1).join("=") : null;
}

function base64UrlDecode(str) {
  // Pad and replace URL-safe chars
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  try {
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/**
 * Synchronously reads and decodes the UI cookie.
 * Returns null if absent or expired.
 */
export function readAuthCookie() {
  try {
    const raw = getCookieValue(UI_COOKIE_NAME);
    if (!raw) return null;

    const parts = raw.split(".");
    if (parts.length !== 3) return null;

    const payload = base64UrlDecode(parts[1]);
    if (!payload) return null;

    // Check expiry (exp is unix seconds)
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // expired
    }

    return {
      id:                 payload.id                 ?? null,
      firstname:          payload.firstname          ?? "",
      lastname:           payload.lastname           ?? "",
      email:              payload.email              ?? "",
      photo:              payload.photo              ?? "",
      subscriptionTier:   payload.subscriptionTier   ?? "free",
      subscriptionStatus: payload.subscriptionStatus ?? "inactive",
    };
  } catch {
    return null;
  }
}

/**
 * Returns true if a valid, non-expired UI cookie exists.
 * Use this for the fastest possible auth gate (zero fetch).
 */
export function isAuthenticatedFromCookie() {
  return readAuthCookie() !== null;
}