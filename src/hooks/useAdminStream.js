// src/hooks/useAdminStream.js
//
// Replaces the setInterval polling in AdminDashboard.jsx with a
// single persistent SSE connection to GET /admin/stream.
//
// Uses fetch() + a stream reader rather than EventSource, because
// EventSource can't send the Authorization header the session-token
// auth needs (and cookies don't work in the Median WebView).
//
// Usage:
//   const { data, queueData, connected, error } = useAdminStream();

import { useState, useEffect, useRef } from "react";
import { authFetch } from "../utils/authToken";

const API_BASE_URL = process.env.REACT_APP_BASEURL;

export function useAdminStream() {
  const [data, setData]           = useState(null);   // full snapshot
  const [queueData, setQueueData] = useState(null);   // live queue (updates every 5s)
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const abortRef = useRef(null);
  const reconnectRef = useRef(null);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    let stopped = false;

    function handleEvent(raw) {
      let event;
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }

      setLastUpdate(new Date());

      switch (event.type) {
        case "snapshot":
          // Full dashboard stats — merge queue data in too
          setData(event.payload);
          if (event.payload?.queue) {
            setQueueData(event.payload.queue);
          }
          break;

        case "queue":
          // Lightweight queue-only update every 5s
          setQueueData(event.payload);
          // Also patch queue into the main data object so
          // components reading `data.queue` stay in sync
          setData((prev) =>
            prev ? { ...prev, queue: event.payload } : prev
          );
          break;

        case "error":
          setError(event.payload || "Stream error");
          break;

        default:
          break;
      }
    }

    function scheduleReconnect() {
      if (stopped) return;
      retriesRef.current += 1;
      if (retriesRef.current > MAX_RETRIES) {
        setError("Dashboard stream disconnected. Please refresh the page.");
        return;
      }

      // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      const delay = Math.min(2000 * 2 ** (retriesRef.current - 1), 30000);
      console.warn(`[useAdminStream] SSE error — reconnecting in ${delay}ms`);
      reconnectRef.current = setTimeout(connect, delay);
    }

    async function connect() {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await authFetch(`${API_BASE_URL}/admin/stream`, {
          headers: { Accept: "text/event-stream" },
          signal: controller.signal,
        });

        // Not logged in / not an admin — retrying won't help
        if (res.status === 401 || res.status === 403) {
          setConnected(false);
          setError(res.status === 401 ? "Session expired. Please log in again." : "Admin access required.");
          return;
        }
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        setConnected(true);
        setError(null);
        retriesRef.current = 0;
        console.log("[useAdminStream] SSE connected");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line
          let sep;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const payload = frame
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");
            if (payload) handleEvent(payload); // ": ping" keep-alives have no data line
          }
        }

        // Server closed the stream
        setConnected(false);
        scheduleReconnect();
      } catch (err) {
        if (controller.signal.aborted) return; // unmounted / replaced
        setConnected(false);
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      stopped = true;
      abortRef.current?.abort();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []); // mount once

  const forceRefresh = () => {
    // Stats are cached server-side for 30s; a reload opens a fresh
    // stream and gets a new snapshot.
    abortRef.current?.abort();
    window.location.reload();
  };

  return {
    data,
    queueData,
    connected,
    error,
    lastUpdate,
    forceRefresh,
  };
}
