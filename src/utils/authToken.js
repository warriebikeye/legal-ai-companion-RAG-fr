// src/utils/authToken.js
//
// Bearer-token auth, alongside (not instead of) the existing cookie flow.
// Cross-site cookies are unreliable inside the Median-wrapped app's
// WebView — a custom Authorization header isn't subject to any cookie
// policy, so it works there regardless. The backend accepts either.

const TOKEN_KEY = "auth_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function authHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
