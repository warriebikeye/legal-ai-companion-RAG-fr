// src/hooks/useRAGStream.js
//
// Drop-in hook for the RAG streaming endpoint.
// Replaces a plain fetch() call with token-by-token streaming.
//
// Usage:
//   const { ask, answer, sources, clauseAnalysis, status, error, conversationId } = useRAGStream();
//
//   <button onClick={() => ask({ query, country, conversationId, files })}>Send</button>
//   <div>{answer}</div>   // updates in real time as tokens arrive

import { useState, useRef, useCallback } from "react";

const API_BASE_URL = process.env.REACT_APP_BASEURL;

/* =========================================================
   STATUS values:
     "idle"        — nothing happening
     "preparing"   — file upload / pre-stream setup
     "streaming"   — tokens arriving
     "done"        — stream complete
     "error"       — something went wrong
========================================================= */

export function useRAGStream() {
  const [answer, setAnswer]           = useState("");
  const [sources, setSources]         = useState([]);
  const [clauseAnalysis, setClause]   = useState(null);
  const [documentText, setDocumentText]           = useState(null);
  const [documentTruncated, setDocumentTruncated] = useState(false);
  const [status, setStatus]           = useState("idle");
  const [error, setError]             = useState(null);
  const [conversationId, setConvoId]  = useState(null);
  const [modelUsed, setModelUsed]     = useState(null);
  const [durationMs, setDuration]     = useState(null);

  const abortRef = useRef(null);

  const ask = useCallback(async ({ query, country = "nigeria", conversationId: cid, files = [] }) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    // Reset state
    setAnswer("");
    setSources([]);
    setClause(null);
    setDocumentText(null);
    setDocumentTruncated(false);
    setError(null);
    setStatus("preparing");
    setModelUsed(null);
    setDuration(null);

    try {
      const body = new FormData();
      body.append("query", query || "");
      body.append("country", country);
      if (cid) body.append("conversationId", cid);
      files.forEach((f) => body.append("files", f));

      const response = await fetch(`${API_BASE_URL}/ask/stream`, {
        method: "POST",
        body,
        credentials: "include",
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Browser does not support ReadableStream");
      }

      setStatus("streaming");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n
        const frames = buffer.split("\n\n");
        buffer = frames.pop(); // last item may be incomplete

        for (const frame of frames) {
          if (!frame.trim() || frame.startsWith(": ")) continue; // skip keep-alive pings

          const line = frame.replace(/^data: /, "").trim();
          if (!line) continue;

          let event;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          switch (event.type) {
            case "connected":
              setConvoId(event.payload.conversationId);
              break;

            case "meta":
              setSources(event.payload.sources || []);
              setDocumentText(event.payload.documentText || null);
              setDocumentTruncated(event.payload.documentTruncated || false);
              break;

            case "chunk":
              setAnswer((prev) => prev + event.payload);
              break;

            case "clause":
              setClause(event.payload);
              break;

            case "done":
              setModelUsed(event.payload.modelUsed || null);
              setDuration(event.payload.durationMs || null);
              setStatus("done");
              break;

            case "error":
              setError(event.payload || "Unknown error");
              setStatus("error");
              break;

            default:
              break;
          }
        }
      }

      // If stream ended without a done event (edge case)
      setStatus((s) => (s === "streaming" ? "done" : s));

    } catch (err) {
      if (err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      console.error("[useRAGStream] error:", err);
      setError(err.message || "Stream failed");
      setStatus("error");
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      setStatus("idle");
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setAnswer("");
    setSources([]);
    setClause(null);
    setDocumentText(null);
    setDocumentTruncated(false);
    setError(null);
    setStatus("idle");
    setModelUsed(null);
    setDuration(null);
  }, []);

  return {
    ask,
    cancel,
    reset,
    answer,
    sources,
    clauseAnalysis,
    documentText,
    documentTruncated,
    status,
    error,
    conversationId,
    modelUsed,
    durationMs,
    isStreaming: status === "streaming",
    isPreparing: status === "preparing",
    isIdle:      status === "idle",
    isDone:      status === "done",
    isError:     status === "error",
  };
}