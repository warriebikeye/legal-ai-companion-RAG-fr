// src/hooks/useAdminStream.js
//
// Replaces the setInterval polling in AdminDashboard.jsx with a
// single persistent SSE connection to GET /admin/stream.
//
// Usage:
//   const { data, queueData, connected, error } = useAdminStream();

import { useState, useEffect, useRef } from "react";

const API_BASE_URL = process.env.REACT_APP_BASEURL;

export function useAdminStream() {
  const [data, setData]           = useState(null);   // full snapshot
  const [queueData, setQueueData] = useState(null);   // live queue (updates every 5s)
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const esRef = useRef(null);
  const reconnectRef = useRef(null);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    function connect() {
      if (esRef.current) esRef.current.close();

      const es = new EventSource(`${API_BASE_URL}/admin/stream`, {
        withCredentials: true,
      });

      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setError(null);
        retriesRef.current = 0;
        console.log("[useAdminStream] SSE connected");
      };

      es.onmessage = (e) => {
        let event;
        try {
          event = JSON.parse(e.data);
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
      };

      es.onerror = () => {
        setConnected(false);
        es.close();

        retriesRef.current += 1;
        if (retriesRef.current > MAX_RETRIES) {
          setError("Dashboard stream disconnected. Please refresh the page.");
          return;
        }

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s
        const delay = Math.min(2000 * 2 ** (retriesRef.current - 1), 30000);
        console.warn(`[useAdminStream] SSE error — reconnecting in ${delay}ms`);
        reconnectRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (esRef.current) esRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, []); // mount once

  const forceRefresh = () => {
    // Reconnect to get a fresh snapshot immediately
    if (esRef.current) esRef.current.close();
    retriesRef.current = 0;
    // Small delay so the close propagates
    setTimeout(() => {
      const es = new EventSource(`${API_BASE_URL}/admin/stream?refresh=true`, {
        withCredentials: true,
      });
      esRef.current = es;
      // Re-attach handlers by re-running the effect would be cleanest,
      // but for a manual refresh a page reload is acceptable:
      window.location.reload();
    }, 100);
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