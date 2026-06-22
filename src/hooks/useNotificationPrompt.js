// src/hooks/useNotificationPrompt.js
//
// Automatic Registration mode — Median handles the OS permission dialog
// on first launch automatically. Our job is:
//   1. Call oneSignalLogin(email) after auth so OneSignal knows WHO the device belongs to
//   2. Show informational soft prompts (no registerForPushNotifications needed)
//   3. Handle all 3 notification scenarios
//
// With Automatic Registration, window.median.onesignal may not be
// immediately available on page load — it initialises asynchronously.
// We use a retry/poll pattern to wait for it.

import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_KEY = "clauzify_push_asked";

function hasBeenAsked() {
  try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

function markAsked() {
  try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
}

// ─── Median bridge ─────────────────────────────────────────────────────────
// Polls for window.median.onesignal up to 10 seconds after page load.
// Median initialises the native bridge asynchronously — it may not exist
// at React render time even in a correctly built app.

function isMedianAvailable() {
  return typeof window !== "undefined" && !!window.median?.onesignal;
}

function waitForMedian(callback, maxWaitMs = 10000) {
  if (isMedianAvailable()) { callback(); return; }
  const interval = 500;
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed += interval;
    if (isMedianAvailable()) {
      clearInterval(timer);
      callback();
    } else if (elapsed >= maxWaitMs) {
      clearInterval(timer);
      console.warn("[OneSignal] Median bridge not available after", maxWaitMs, "ms");
    }
  }, interval);
}

// ─── Exported auth helpers ──────────────────────────────────────────────────

export function oneSignalLogin(email) {
  // With Automatic Registration, Median may not have finished initialising
  // at the exact moment login completes — wait for the bridge then login.
  waitForMedian(() => {
    try {
      window.median.onesignal.login(email);
      console.log("[OneSignal] Logged in:", email);
    } catch (err) {
      console.warn("[OneSignal] login failed:", err);
    }
  });
}

export function oneSignalLogout() {
  if (!isMedianAvailable()) return;
  try {
    window.median.onesignal.logout();
    console.log("[OneSignal] Logged out");
  } catch (err) {
    console.warn("[OneSignal] logout failed:", err);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useNotificationPrompt() {
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptScenario, setPromptScenario] = useState(null);
  const queryCountRef = useRef(0);
  const [medianReady, setMedianReady] = useState(false);

  // Wait for Median bridge to be ready on mount
  useEffect(() => {
    waitForMedian(() => {
      setMedianReady(true);
      console.log("[OneSignal] Median bridge ready");
    });
  }, []);

  // With Automatic Registration, the OS already asked permission on first launch.
  // Our soft prompt is now purely informational — tells the user WHY they'll
  // get notifications. No need to call registerForPushNotifications() ourselves.
  const maybeShow = useCallback((scenario) => {
    if (hasBeenAsked()) return;
    if (!medianReady) return;
    setPromptScenario(scenario);
    setPromptVisible(true);
  }, [medianReady]);

  // ── Scenario 1: after 3rd successful RAG query ──
  const onQuerySuccess = useCallback(() => {
    queryCountRef.current += 1;
    if (queryCountRef.current === 3) {
      maybeShow("first_query");
    }
  }, [maybeShow]);

  // ── Scenario 2: when daily query limit is hit ──
  const onQueryLimitHit = useCallback(() => {
    maybeShow("limit_hit");
  }, [maybeShow]);

  // ── Scenario 3: after document scan completes ──
  const onScanComplete = useCallback(() => {
    maybeShow("scan_done");
  }, [maybeShow]);

  // ── User tapped "Got it" on our informational prompt ──
  const handleAllow = useCallback(() => {
    markAsked();
    setPromptVisible(false);
    // No registerForPushNotifications() needed — Automatic mode handles it
  }, []);

  // ── User tapped "Dismiss" ──
  const handleDismiss = useCallback(() => {
    markAsked();
    setPromptVisible(false);
  }, []);

  return {
    promptVisible,
    promptScenario,
    medianReady,       // expose so you can log/debug
    onQuerySuccess,
    onQueryLimitHit,
    onScanComplete,
    handleAllow,
    handleDismiss,
  };
}
