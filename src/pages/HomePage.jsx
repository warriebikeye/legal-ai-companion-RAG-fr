import { useNotificationPrompt, oneSignalLogin, oneSignalLogout } from '../hooks/useNotificationPrompt';
import NotificationPrompt from '../components/NotificationPrompt';
import PdfModal from '../components/PdfModal';
import LegalAnalysisCard from '../components/LegalAnalysisCard';
import '../App.css';
import { encryptedFetch } from "../utils/encryption";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import gptLogo from '../assets/DeeBees.svg';
import addBtn from '../assets/add-30.png';
import home from '../assets/home.svg';
import rocket from '../assets/rocket.svg';
import sendBtn from '../assets/send.svg';
import gptimglogo from '../assets/DeeBees.svg';
import logout from '../assets/logout.svg';
import defaultUserIcon from '../assets/user-icon.png';

import { useRAGStream } from '../hooks/useRAGStream';
import AuthModal from '../components/AuthModal';
import AdRenderer from '../components/AdRenderer';
import { readAuthCookie } from '../hooks/useAuthCookie';

const API_BASE_URL = process.env.REACT_APP_BASEURL;

/* =========================================================
   REFERRAL NUDGE — daily cap (mirrors backend's 5/day cap so
   we stop calling once the backend would just no-op anyway)
========================================================= */
const REFERRAL_NUDGE_KEY = "clauzify_referral_nudge_count";
const REFERRAL_NUDGE_DAILY_CAP = 5;

function getReferralNudgeCount() {
  try {
    const raw = localStorage.getItem(REFERRAL_NUDGE_KEY);
    if (!raw) return 0;
    const { date, count } = JSON.parse(raw);
    return date === new Date().toISOString().slice(0, 10) ? count : 0;
  } catch {
    return 0;
  }
}

function incrementReferralNudgeCount() {
  try {
    const date = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      REFERRAL_NUDGE_KEY,
      JSON.stringify({ date, count: getReferralNudgeCount() + 1 })
    );
  } catch { /* localStorage unavailable — cap just won't persist */ }
}

/* =========================================================
   DEFAULT BOT MESSAGE
========================================================= */
const DEFAULT_BOT_MESSAGE = {
  text: " Before you sign any Agreement or Contract, upload it here or ask me questions. I will show you problematic clause which isn't in compliance with the Law of your country.",
  isBot: true,
  isWelcome: true,
};

/* =========================================================
   COUNTRIES
========================================================= */
const countries = [
  { name: "Nigeria", flag: "🇳🇬" },
  { name: "Kenya", flag: "🇰🇪" },
  { name: "Ghana", flag: "🇬🇭" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "Tanzania", flag: "🇹🇿" },
  { name: "Liberia", flag: "🇱🇷"},

];

/* =========================================================
   HOMEPAGE
========================================================= */
function HomePage() {
  const messagesEndRef = useRef(null);
  const chatsRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  /* ── state ────────────────────────────────────────────── */
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [userLocation, setUserLocation] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userImage, setUserImage] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [recentConversations, setRecentConversations] = useState([]);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [messages, setMessages] = useState([DEFAULT_BOT_MESSAGE]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  /* ── wallet state — Phase 1 ──────────────────────────── */
  const [walletBalance, setWalletBalance] = useState(null);
  const [dailyFreeTokens, setDailyFreeTokens] = useState(4);
  // ── PDF modal state ──────────────────────────────────────
  const [pdfModal, setPdfModal] = useState(null); // { text, sources } | null
  const [referralCode, setReferralCode] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);
  // ── Referral nudge (in-app notification) state ──────────
  const [referralNudge, setReferralNudge] = useState(null); // { title, body, rewardTokens } | null

  /* ── derived ──────────────────────────────────────────── */

  // Ads show whenever the paid wallet is empty — regardless of
  // remaining daily free tokens. Ad presence is a monetization
  // choice, not a compliance gate; the compliance gate (below) is
  // still: never render on typing/streaming/welcome messages.
  const showAds = isAuthenticated && walletBalance === 0;
  /* ── stream hook ──────────────────────────────────────── */
  const {
    ask, cancel,
    answer: streamAnswer,
    sources: streamSources,
    clauseAnalysis: streamClause,
    documentText: streamDocumentText,
    status: streamStatus,
    error: streamError,
    conversationId: streamConvoId,
  } = useRAGStream();

  const isSending = streamStatus === "preparing" || streamStatus === "streaming";
  const isStreaming = streamStatus === "streaming";

  /* ── notification hook ────────────────────────────────── */
  const {
    promptVisible,
    promptScenario,
    onQuerySuccess,
    onQueryLimitHit,
    onScanComplete,
    handleAllow,
    handleDismiss,
  } = useNotificationPrompt();

  /* =========================================================
     HELPERS
  ========================================================= */
  const closeSidebarOnMobile = useCallback(() => {
    if (window.innerWidth <= 768) setSidebarOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  /* =========================================================
     SCROLL HELPERS
  ========================================================= */
  const isNearBottom = useCallback(() => {
    const el = chatsRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  }, []);

  const handleChatsScroll = useCallback(() => {
    if (isNearBottom()) setShowScrollBtn(false);
  }, [isNearBottom]);

  /* =========================================================
     SMART SCROLL
  ========================================================= */
  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowScrollBtn(false);
    } else {
      setShowScrollBtn(true);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================================================
     FETCH CONVERSATIONS
  ========================================================= */
  const fetchRecentConversations = useCallback(async () => {
    try {
      const convData = await encryptedFetch(`${API_BASE_URL}/conversations`, {
        method: "GET", credentials: "include",
      });
      setRecentConversations(
        Array.isArray(convData) ? convData :
          Array.isArray(convData?.conversations) ? convData.conversations : []
      );
    } catch (err) {
      console.error("Error fetching recent conversations:", err);
      setRecentConversations([]);
    }
  }, []);

  /* =========================================================
     FETCH WALLET BALANCE
  ========================================================= */
  const fetchWalletBalance = useCallback(async () => {
    try {
      const data = await encryptedFetch(`${API_BASE_URL}/api/wallet/balance`, {
        method: "GET",
        credentials: "include",
      });
      if (data?.success) {
        setWalletBalance(data.wallet);
        setDailyFreeTokens(data.dailyFreeTokens);
        if (data.referralCode) setReferralCode(data.referralCode);
      }
    } catch (err) {
      console.error("[fetchWalletBalance]", err);
    }
  }, []);

  /* =========================================================
     REFERRAL NUDGE — generates an in-app notification
     server-side when the user's wallet is empty. Captures the
     response and stores it so the banner below can render it;
     failures are logged and swallowed.
  ========================================================= */
  const fetchReferralNudge = useCallback(async () => {
    if (getReferralNudgeCount() >= REFERRAL_NUDGE_DAILY_CAP) return;
    incrementReferralNudgeCount();
    try {
      const data = await encryptedFetch(`${API_BASE_URL}/api/referral/nudge`, {
        method: "GET",
        credentials: "include",
      });
      if (data?.show && data?.notification) {
        setReferralNudge(data.notification);
      }
    } catch (err) {
      console.error("[fetchReferralNudge]", err);
    }
  }, []);

  /* =========================================================
     AUTH HELPERS
  ========================================================= */
  const applyUserData = useCallback((data) => {
    setIsAuthenticated(true);
    setUserEmail(data.email ?? data.userEmail ?? null);
    const composedName = [data.firstname, data.lastname].filter(Boolean).join(" ") || data.name || null;
    setUserName(composedName);
    setUserImage(data.photo ?? data.userImage ?? defaultUserIcon);
    setSubscriptionTier(data.subscriptionTier ?? "free");
    setSubscriptionStatus(data.subscriptionStatus ?? "inactive");
  }, []);

  /* =========================================================
     AUTH CHECK — cookie-first, then /auth/me fallback
  ========================================================= */
  const checkAuthentication = useCallback(async () => {
    const cookie = readAuthCookie();
    if (cookie) {
      applyUserData(cookie);
      setAuthChecked(true);
      fetchRecentConversations();
      fetchWalletBalance();
      fetchReferralNudge();
      fetch(`${API_BASE_URL}/auth/me`, { method: "GET", credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.isAuthenticated) applyUserData({
            email: data.userEmail,
            name: data.name,
            firstname: data.firstname,
            lastname: data.lastname,
            photo: data.userImage,
            subscriptionTier: data.subscriptionTier,
            subscriptionStatus: data.subscriptionStatus,
          });
          if (data?.isAuthenticated && data?.userEmail) {
            oneSignalLogin(data.userEmail);
          }
        })
        .catch(() => { });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET", credentials: "include",
      });
      if (!res.ok) { setIsAuthenticated(false); setAuthChecked(true); return; }
      const data = await res.json();
      if (data.isAuthenticated) {
        applyUserData({
          email: data.userEmail,
          name: data.name,
          firstname: data.firstname,
          lastname: data.lastname,
          photo: data.userImage,
          subscriptionTier: data.subscriptionTier,
          subscriptionStatus: data.subscriptionStatus,
        });
        if (data.userEmail) oneSignalLogin(data.userEmail);
        await fetchRecentConversations();
        await fetchWalletBalance();
        fetchReferralNudge();
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  }, [applyUserData, fetchRecentConversations, fetchWalletBalance, fetchReferralNudge]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  /* =========================================================
     RESIZE
  ========================================================= */
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* =========================================================
     COUNTRY AUTO-DETECT
  ========================================================= */
  useEffect(() => {
    const autoDetectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const found = countries.find((c) => c.name === data.country_name);
        if (found) setUserLocation(found.name);
      } catch (err) {
        console.warn("Auto-location failed:", err);
      }
    };
    autoDetectCountry();
  }, []);

  /* =========================================================
     STREAM — sync live bot message
  ========================================================= */
  useEffect(() => {
    if (streamStatus === "idle" || streamStatus === "done") return;
    setMessages((prev) => {
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);
      if (lastBotIdx === -1) return prev;
      updated[lastBotIdx] = {
        ...updated[lastBotIdx],
        text: streamAnswer || "",
        typing: streamStatus === "preparing",
        isStreaming: streamStatus === "streaming",
        sources: streamSources || [],
        clauseAnalysis: streamClause || null,
        documentText: streamDocumentText || null,
        hasSources: (streamSources || []).length > 0,
        hasClauseAnalysis: !!streamClause,
      };
      return updated;
    });
  }, [streamAnswer, streamSources, streamClause, streamDocumentText, streamStatus]);

  /* =========================================================
     STREAM — done
  ========================================================= */
  useEffect(() => {
    if (streamStatus !== "done") return;
    setMessages((prev) => {
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);
      if (lastBotIdx === -1) return prev;
      updated[lastBotIdx] = { ...updated[lastBotIdx], isStreaming: false, typing: false };
      return updated;
    });
    if (streamConvoId) setActiveConversationId(streamConvoId);
    if (isAuthenticated) fetchRecentConversations();
    if (isAuthenticated) fetchWalletBalance();
    if (isAuthenticated) onQuerySuccess();
  }, [streamStatus, streamConvoId, isAuthenticated, fetchRecentConversations, onQuerySuccess]);

  /* =========================================================
     STREAM — error
  ========================================================= */
  useEffect(() => {
    if (streamStatus !== "error" || !streamError) return;

    setMessages((prev) => {
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);
      if (lastBotIdx === -1) return prev;

      // ── Insufficient tokens — show top-up prompt ──
      if (streamError === "insufficient_tokens") {
        updated[lastBotIdx] = {
          isBot: true,
          text: "",
          typing: false,
          isStreaming: false,
          isTokenError: true,
          sources: [],
          clauseAnalysis: null,
        };
        return updated;
      }

      updated[lastBotIdx] = {
        isBot: true, text: `⚠️ ${streamError}`,
        typing: false, isStreaming: false, sources: [], clauseAnalysis: null,
      };
      return updated;
    });

    // Refresh wallet on any error — free token may have been consumed
    if (isAuthenticated) fetchWalletBalance();

    // Nudge toward referrals right when the user hits the paywall
    if (isAuthenticated && streamError === "insufficient_tokens") fetchReferralNudge();

    if (
      isAuthenticated && (
        streamError.toLowerCase().includes("limit") ||
        streamError.toLowerCase().includes("quota") ||
        streamError.toLowerCase().includes("daily") ||
        streamError === "insufficient_tokens"
      )
    ) {
      onQueryLimitHit();
    }
  }, [streamStatus, streamError, isAuthenticated, onQueryLimitHit, fetchWalletBalance, fetchReferralNudge]);

  /* =========================================================
     LOGOUT
  ========================================================= */
  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
    } catch (err) {
      console.error("Logout error:", err);
    }
    //oneSignalLogout();
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserName(null);
    setUserImage(null);
    setSubscriptionTier("free");
    setSubscriptionStatus("inactive");
    setWalletBalance(null);
    setDailyFreeTokens(4);
    setReferralCode(null);
    setRecentConversations([]);
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
  }, []);
  /* =========================================================
     REFERRAL — copy code
  ========================================================= */
  const handleCopyReferral = useCallback(() => {
    if (!referralCode) return;

    function fallbackCopy(text) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        setReferralCopied(true);
        setTimeout(() => setReferralCopied(false), 2500);
      } catch (err) {
        console.error("Fallback copy failed:", err);
      }
      document.body.removeChild(textarea);
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(referralCode)
        .then(() => {
          setReferralCopied(true);
          setTimeout(() => setReferralCopied(false), 2500);
        })
        .catch(() => fallbackCopy(referralCode));
    } else {
      fallbackCopy(referralCode);
    }
  }, [referralCode]);

  /* =========================================================
     REFERRAL NUDGE — dismiss in-app banner
  ========================================================= */
  const dismissReferralNudge = useCallback(() => setReferralNudge(null), []);

  /* =========================================================
     FILE UPLOAD
  ========================================================= */
  const handleFileUpload = useCallback((e) => setFiles([...e.target.files]), []);
  const removeFile = useCallback((idx) => setFiles((prev) => prev.filter((_, i) => i !== idx)), []);
  const handleFileButtonClick = useCallback(() => {
    if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
  }, []);

  /* =========================================================
     NEW CHAT
  ========================================================= */
  const startNewChat = useCallback(() => {
    closeSidebarOnMobile();
    cancel();
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
    setInput("");
    setFiles([]);
    setShowScrollBtn(false);
  }, [cancel, closeSidebarOnMobile]);

  /* =========================================================
     LOAD CONVERSATION
  ========================================================= */
  const loadConversation = useCallback(async (conversationId) => {
    closeSidebarOnMobile();
    if (!conversationId || conversationId === "undefined") return;
    try {
      cancel();
      setActiveConversationId(conversationId);
      if (chatsRef.current) chatsRef.current.scrollTop = 0;
      setMessages([{ text: "Loading conversation...", isBot: true, typing: true }]);

      const data = await encryptedFetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        { method: "GET", credentials: "include" }
      );

      const rawMessages = Array.isArray(data) ? data :
        Array.isArray(data?.messages) ? data.messages : [];

      if (rawMessages.length === 0) { setMessages([DEFAULT_BOT_MESSAGE]); return; }

      setMessages(rawMessages.map((msg, idx) => {
        // documentText lives on the user message that uploaded the file,
        // not the assistant message carrying clauseAnalysis — backfill it
        // from the nearest preceding user message so the revised-document
        // flow has something to work against after a reload.
        let documentText = null;
        if (msg.role !== "user") {
          for (let j = idx - 1; j >= 0; j--) {
            if (rawMessages[j].role === "user") {
              documentText = rawMessages[j].documentText || null;
              break;
            }
          }
        }

        return {
          text: msg.content,
          isBot: msg.role !== "user",
          sources: msg.sources ?? [],
          clauseAnalysis: msg.clauseAnalysis ?? null,
          documentText,
          hasSources: Array.isArray(msg.sources) && msg.sources.length > 0,
          hasClauseAnalysis: !!msg.clauseAnalysis,
        };
      }));
    } catch (err) {
      console.error("Error loading conversation:", err);
      setMessages([{ text: "⚠️ Failed to load this conversation.", isBot: true }]);
    }
  }, [cancel, closeSidebarOnMobile]);

  /* =========================================================
     SEND MESSAGE
  ========================================================= */
  const handleSend = useCallback(async () => {
    if (!input.trim() && files.length === 0) return;
    if (!userLocation) { alert("Please select your country first."); return; }

    const query = input.trim();
    setMessages((prev) => [
      ...prev,
      { text: query || "(Document Uploaded)", isBot: false },
      { text: "", isBot: true, typing: true, isStreaming: false },
    ]);
    setInput("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowScrollBtn(false);
    }, 50);
    await ask({ query, country: userLocation, conversationId: activeConversationId, files });
    setFiles([]);
  }, [ask, input, files, userLocation, activeConversationId]);

  /* =========================================================
     RENDER BOT MESSAGE
  ========================================================= */
  const renderBotMessage = useCallback((message, msgIndex) => {

    /* ── Insufficient tokens — show top-up prompt ── */
    if (message.isTokenError) {
      return (
        <div className="token-error-message">
          <p>⚠️ You don't have enough tokens for this action.</p>
          <button
            className="topup-prompt-btn"
            onClick={() => navigate("/upgrade")}
          >
            Top Up Wallet
          </button>
          <p className="token-hint">
            {dailyFreeTokens > 0
              ? `${dailyFreeTokens} free Q&A${dailyFreeTokens > 1 ? "s" : ""} remaining today · Contract reviews need 65 tokens`
              : "Free Q&As exhausted for today · Contract reviews need 65 tokens"}
          </p>
        </div>
      );
    }
    const isWelcomeMessage = message.isWelcome === true;
    const paragraphs = message.text?.split("\n\n").filter((p) => p.trim()) ?? [];
    const middleIndex = Math.floor(paragraphs.length / 2);

    return (
      <>
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            <ReactMarkdown>{paragraph}</ReactMarkdown>

            {showAds && !isWelcomeMessage && message.isBot &&
              !message.typing && !message.isStreaming && index === 0 && (
                <AdRenderer
                  key={`ad-top-${activeConversationId ?? "new"}-${msgIndex}`}
                  position="top"
                  width={400}
                  height={120}
                  className="response-ad-top"
                />
              )}

            {showAds && !isWelcomeMessage && message.isBot &&
              !message.typing && !message.isStreaming && index === middleIndex && (
                <AdRenderer
                  key={`ad-mid-${activeConversationId ?? "new"}-${msgIndex}`}
                  position="middle"
                  width={400}
                  height={100}
                  className="response-ad-middle"
                />
              )}
          </div>
        ))}

        {showAds && !isWelcomeMessage && message.isBot &&
          !message.typing && !message.isStreaming && (
            <AdRenderer
              key={`ad-bottom-${activeConversationId ?? "new"}-${msgIndex}`}
              position="bottom"
              width={400}
              adHeight={110}
              height={120}
              className="response-ad-bottom"
            />
          )}
      </>
    );
  }, [showAds, activeConversationId, dailyFreeTokens, navigate]);

  /* =========================================================
     LOADING SCREEN
  ========================================================= */
  if (!authChecked) {
    return (
      <div className="app-loading">
        <img src={gptLogo} alt="DeeBees" className="loading-logo" />
        <h2>Clauzify</h2>
        <div className="loading-spinner" />
        <p>Preparing your workspace...</p>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div className="App">

      {/* ── Login wall ───────────────────────────────────── */}
      {!isAuthenticated && <AuthModal onAuthenticated={checkAuthentication} />}

      {/* ── Notification prompt ───────────────────────────── */}
      {promptVisible && (
        <NotificationPrompt
          scenario={promptScenario}
          onAllow={handleAllow}
          onDismiss={handleDismiss}
        />
      )}

      {/* ── PDF modal ─────────────────────────────────────── */}
      {pdfModal && (
        <PdfModal
          responseText={pdfModal.text}
          sources={pdfModal.sources}
          logoUrl={gptimglogo}   // ← add this
          onClose={() => setPdfModal(null)}
        />
      )}

      {/* ── Referral nudge (in-app notification) ────────────── */}
      {referralNudge && (
        <div
          className="referral-nudge-toast"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            maxWidth: "320px",
            background: "#1c1c1c",
            border: "1px solid #c8a94a",
            borderRadius: "10px",
            padding: "16px",
            color: "#fff",
            zIndex: 1000,
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <button
            onClick={dismissReferralNudge}
            aria-label="Dismiss"
            style={{
              position: "absolute", top: "8px", right: "10px",
              background: "none", border: "none", color: "#aaa",
              fontSize: "16px", cursor: "pointer",
            }}
          >
            ×
          </button>
          <strong style={{ display: "block", marginBottom: "6px" }}>
            {referralNudge.title}
          </strong>
          <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#ddd" }}>
            {referralNudge.body}
          </p>
          <button
            onClick={() => { handleCopyReferral(); dismissReferralNudge(); }}
            style={{
              padding: "6px 14px", background: "transparent",
              border: "1px solid #c8a94a", borderRadius: "6px",
              color: "#c8a94a", fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}
          >
            🔗 Copy My Referral Code
          </button>
        </div>
      )}

      <button className="sidebarToggle" onClick={toggleSidebar}>☰</button>

      {/* ═══════════════════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════════════════ */}
      <div className={`sideBar ${sidebarOpen ? "open" : "collapsed"}`}>
        <div className="upperSide">
          <div className="uppersideTop">
            <img src={gptLogo} alt="Logo" className="logo" />
          </div>

          <select className="query" value={userLocation}
            onChange={(e) => { setUserLocation(e.target.value); closeSidebarOnMobile(); }}>
            <option value="">-- Select Country --</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
            ))}
          </select>

          <div className="upperSideButton">
            <h2>Previous Chats</h2>
            {Array.isArray(recentConversations) &&
              recentConversations.map((conv) => {
                const convId = conv._id || conv.id;
                return (
                  <button key={convId} className="query" onClick={() => loadConversation(convId)}>
                    <span className="queryText">{conv.title || "Untitled Chat"}</span>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="lowerside">
          <button className="midBtn" onClick={startNewChat}>
            <img src={addBtn} alt="" className="addBtn" />
            New Chat
          </button>

          {/* <div className="ListItems"><img src={home} alt="" />Home</div> */}

          {/* ── Wallet balance display ─────────────────────── */}
          {isAuthenticated && (
            <div className="walletDisplay">
              <span className="walletIcon">🪙</span>
              <span className="walletTokens">
                {walletBalance !== null ? `${walletBalance} tokens` : "—"}
              </span>
              {dailyFreeTokens > 0 && (
                <span className="freeTokenBadge">+{dailyFreeTokens} free</span>
              )}
            </div>
          )}
          {/* ── Referral share button ──────────────────────────── */}
          {isAuthenticated && referralCode && (
            <div
              className="ListItems referralBtn"
              onClick={handleCopyReferral}
              title="Copy your referral code"
            >
              <span>🔗</span>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                <span>{referralCopied ? "Code Copied! ✓" : "Get Your Referral Code"}</span>
                <span style={{ fontSize: "0.7em", opacity: 0.75, fontWeight: 400 }}>
                  Earn 75 Tokens per referral
                </span>
              </div>
            </div>
          )}
          {/* ── Top Up Wallet button ────────────────────────── */}
          <div className="ListItems upgradeBtn" onClick={() => navigate("/upgrade")}>
            <img src={rocket} alt="" />
            Top Up Wallet
          </div>

          <div className="ListItems">
            <img src={userImage || defaultUserIcon} alt="" />
            {userName || userEmail || "Account"}
          </div>

          {isAuthenticated && (
            <div className="ListItems logoutBtn" onClick={handleLogout}>
              <img src={logout} alt="" />
              Sign out
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MAIN CHAT AREA
      ═══════════════════════════════════════════════════ */}
      <div className={`main ${sidebarOpen ? "" : "fullWidth"}`}>
        <div className="chats" ref={chatsRef} onScroll={handleChatsScroll}>
          {messages.map((message, i) => (
            <div key={i} className={message.isBot ? "chat bot" : "chat"}>
              <img
                src={message.isBot ? gptimglogo : (userImage || defaultUserIcon)}
                className="chtimg" alt=""
              />
              <p className="txt">
                {message.typing || (message.isStreaming && !message.text) ? (
                  <div className="typing-dots"><span /><span /><span /></div>
                ) : (
                  <>
                    <div className="bot-message-content">
                      {message.isBot
                        ? renderBotMessage(message, i)
                        : <ReactMarkdown>{message.text}</ReactMarkdown>}
                      {message.isStreaming && message.text && (
                        <span className="stream-cursor" aria-hidden="true" />
                      )}
                    </div>

                    {/* Sources */}
                    {message.sources?.length > 0 && (
                      <span style={{ marginTop: "10px", display: "block" }}>
                        <strong>Sources:</strong>{" "}
                        {message.sources
                          .map((s) =>
                            s.replace(/\.pdf$/i, "")
                              .replace(/â€™/g, "'")
                              .replace(/â€œ/g, '"')
                              .replace(/â€/g, '"')
                              .replace(/âS/g, "'S")
                              .replace(/â/g, "'")
                          )
                          .join(", ")}
                      </span>
                    )}

                    {/* Clause analysis */}
                    {message.clauseAnalysis && typeof message.clauseAnalysis === "object" && (
                      <div style={{ marginTop: "12px" }}>
                        <LegalAnalysisCard
                          clauseAnalysis={message.clauseAnalysis}
                          documentText={message.documentText}
                          onDownloadRevised={(revisedText) =>
                            setPdfModal({ text: revisedText, sources: [] })
                          }
                        />
                      </div>
                    )}

                    {/* ── PDF export button — only on completed bot responses ── */}
                    {message.isBot && !message.isWelcome &&
                      !message.typing && !message.isStreaming &&
                      !message.isTokenError &&
                      message.text && (
                        <button
                          onClick={() => setPdfModal({ text: message.text, sources: message.sources || [] })}
                          style={{
                            marginTop: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            background: "transparent",
                            border: "1px solid #c8a94a",
                            borderRadius: "6px",
                            color: "#c8a94a",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            letterSpacing: "0.3px",
                          }}
                          title="Export this response as a PDF document"
                        >
                          📄 Export as PDF
                        </button>
                      )}
                  </>
                )}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {showScrollBtn && (
          <button className="scroll-to-bottom-btn" onClick={scrollToBottom}
            aria-label="Scroll to latest message" title="Jump to latest">↓</button>
        )}

        <div className="chatfooter">
          {files.length > 0 && (
            <div className="attachment-tray">
              {files.map((file, idx) =>
                file.type.startsWith("image/") ? (
                  <div key={idx} className="attachment-chip image-chip">
                    <img src={URL.createObjectURL(file)} alt={file.name} className="chip-thumb" />
                    <button className="chip-remove" onClick={() => removeFile(idx)}
                      title="Remove" aria-label={`Remove ${file.name}`}>×</button>
                  </div>
                ) : (
                  <div key={idx} className="attachment-chip file-chip">
                    <span className="chip-icon">📄</span>
                    <span className="chip-name">{file.name}</span>
                    <button className="chip-remove" onClick={() => removeFile(idx)}
                      title="Remove" aria-label={`Remove ${file.name}`}>×</button>
                  </div>
                )
              )}
            </div>
          )}

          <div className="inp">
            <input type="file" multiple accept="*/*" ref={fileInputRef}
              style={{ display: "none" }} onChange={handleFileUpload} />

            <button type="button" className="file-label" onClick={handleFileButtonClick}
              style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                width: "50px", height: "50px", fontSize: "30px",
                color: "#fff", cursor: "pointer", borderRadius: "4px",
                background: "none", border: "none",
              }}>+</button>

            <textarea placeholder="Send a message" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isSending) {
                  e.preventDefault(); handleSend();
                }
              }}
              className="chat-input" />

            {isStreaming ? (
              <button className="send stop" onClick={cancel} title="Stop generating">■</button>
            ) : (
              <button className="send" onClick={handleSend} disabled={isSending}>
                {isSending ? <div className="loader" /> : <img src={sendBtn} alt="" />}
              </button>
            )}
          </div>

          <p>~ Africa's Legal Intelligence Pipeline ~</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
