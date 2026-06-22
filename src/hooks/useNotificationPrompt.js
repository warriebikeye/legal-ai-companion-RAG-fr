// src/hooks/useNotificationPrompt.js
//
// Manages all 3 OneSignal push notification trigger scenarios:
//   1. After first successful RAG query response
//   2. When the user hits their daily query limit
//   3. After a document scan completes
//
// Also exposes helpers to call from auth flow:
//   - oneSignalLogin(email)  → call after login/verify success
//   - oneSignalLogout()      → call after logout
//   - requestPermission()    → triggers the real OS dialog

import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "clauzify_push_asked"; // tracks if we've asked before

function hasBeenAsked() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function markAsked() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {}
}

// ─── Median bridge ────────────────────────────────────────────
function isMedianAvailable() {
  return typeof window !== "undefined" && !!window.median?.onesignal;
}

export function oneSignalLogin(email) {
  if (!isMedianAvailable()) return;
  try {
    window.median.onesignal.login(email);
  } catch (err) {
    console.warn("[OneSignal] login failed:", err);
  }
}

export function oneSignalLogout() {
  if (!isMedianAvailable()) return;
  try {
    window.median.onesignal.logout();
  } catch (err) {
    console.warn("[OneSignal] logout failed:", err);
  }
}

function requestPermission() {
  if (!isMedianAvailable()) return;
  try {
    window.median.onesignal.registerForPushNotifications();
  } catch (err) {
    console.warn("[OneSignal] registerForPushNotifications failed:", err);
  }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useNotificationPrompt() {
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptScenario, setPromptScenario] = useState(null); // "first_query" | "limit_hit" | "scan_done"
  const queryCountRef = useRef(0); // track completed queries this session

  // Internal: show the prompt if we haven't asked before this session
  const maybeShow = useCallback((scenario) => {
    if (hasBeenAsked()) return;        // already asked — never ask again
    if (!isMedianAvailable()) return;  // not in Median WebView
    setPromptScenario(scenario);
    setPromptVisible(true);
  }, []);

  // ── Scenario 1: call this after every successful RAG response ──
  const onQuerySuccess = useCallback(() => {
    queryCountRef.current += 1;
    // Trigger after the 3rd successful query (user has seen real value)
    if (queryCountRef.current === 3) {
      maybeShow("first_query");
    }
  }, [maybeShow]);

  // ── Scenario 2: call this when backend returns a 429 / limit error ──
  const onQueryLimitHit = useCallback(() => {
    maybeShow("limit_hit");
  }, [maybeShow]);

  // ── Scenario 3: call this after a document scan completes ──
  const onScanComplete = useCallback(() => {
    maybeShow("scan_done");
  }, [maybeShow]);

  // ── User tapped "Allow" on our soft prompt ──
  const handleAllow = useCallback(() => {
    markAsked();
    setPromptVisible(false);
    requestPermission(); // fires the real OS dialog
  }, []);

  // ── User tapped "No Thanks" ──
  const handleDismiss = useCallback(() => {
    markAsked(); // don't ask again even if dismissed
    setPromptVisible(false);
  }, []);

  return {
    promptVisible,
    promptScenario,
    onQuerySuccess,
    onQueryLimitHit,
    onScanComplete,
    handleAllow,
    handleDismiss,
  };
}