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
//import AdBanner from '../components/AdBanner';
import AdsterraBanner from '../components/AdsterraBanner';
import { readAuthCookie } from '../hooks/useAuthCookie';

const API_BASE_URL = process.env.REACT_APP_BASEURL;

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
  { name: "United States", flag: "🇺🇸" },
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

  /* ── derived ──────────────────────────────────────────── */
  const showAds = isAuthenticated && subscriptionTier === "free";

  /* ── stream hook ──────────────────────────────────────── */
  const {
    ask, cancel,
    answer: streamAnswer,
    sources: streamSources,
    clauseAnalysis: streamClause,
    status: streamStatus,
    error: streamError,
    conversationId: streamConvoId,
  } = useRAGStream();

  const isSending = streamStatus === "preparing" || streamStatus === "streaming";
  const isStreaming = streamStatus === "streaming";

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
     - isNearBottom: true when user is within 120px of the bottom
     - scrollToBottom: smoothly jumps to bottom, hides the button
     - handleChatsScroll: fired on every scroll event; hides the
       button once the user manually reaches the bottom
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
     SMART SCROLL — runs whenever messages update.
     If the user is already near the bottom, scroll them along.
     If they've scrolled up to read history, show the arrow
     instead so we don't hijack their position.
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
     NOTE: encryptedFetch already returns the final, decrypted
     JSON data (NOT a fetch Response). Do not call `.ok` or
     `.json()` on its result — and on non-2xx responses it
     throws, so use try/catch.
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
     AUTH HELPERS
  ========================================================= */
  const applyUserData = useCallback((data) => {
    setIsAuthenticated(true);
    setUserEmail(data.email ?? data.userEmail ?? null);
    setUserName(data.name ?? null);
    setUserImage(data.photo ?? data.userImage ?? defaultUserIcon);
    setSubscriptionTier(data.subscriptionTier ?? "free");
    setSubscriptionStatus(data.subscriptionStatus ?? "inactive");
  }, []);

  /* =========================================================
     AUTH CHECK — cookie-first, then /auth/me fallback
  ========================================================= */
  const checkAuthentication = useCallback(async () => {
    // ── Step 1: try cookie (zero network cost) ──────────────
    const cookie = readAuthCookie();
    if (cookie) {
      applyUserData(cookie);
      setAuthChecked(true);

      // Fire-and-forget: load conversations + silently refresh
      fetchRecentConversations();
      fetch(`${API_BASE_URL}/auth/me`, { method: "GET", credentials: "include" })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.isAuthenticated) applyUserData({
            email: data.userEmail,
            name: data.name,
            photo: data.userImage,
            subscriptionTier: data.subscriptionTier,
            subscriptionStatus: data.subscriptionStatus,
          });
        })
        .catch(() => { /* silent — cookie data already shown */ });
      return;
    }

    // ── Step 2: no cookie — hit the server ──────────────────
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET", credentials: "include",
      });

      if (!res.ok) {
        setIsAuthenticated(false);
        setAuthChecked(true);
        return;
      }

      const data = await res.json();

      if (data.isAuthenticated) {
        applyUserData({
          email: data.userEmail,
          name: data.name,
          photo: data.userImage,
          subscriptionTier: data.subscriptionTier,
          subscriptionStatus: data.subscriptionStatus,
        });
        await fetchRecentConversations();
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking authentication:", error);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  }, [applyUserData, fetchRecentConversations]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  /* =========================================================
     RESIZE — keep sidebar open on desktop
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
        hasSources: (streamSources || []).length > 0,
        hasClauseAnalysis: !!streamClause,
      };
      return updated;
    });
  }, [streamAnswer, streamSources, streamClause, streamStatus]);

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
  }, [streamStatus, streamConvoId, isAuthenticated, fetchRecentConversations]);

  /* =========================================================
     STREAM — error
  ========================================================= */
  useEffect(() => {
    if (streamStatus !== "error" || !streamError) return;
    setMessages((prev) => {
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);
      if (lastBotIdx === -1) return prev;
      updated[lastBotIdx] = {
        isBot: true, text: `⚠️ ${streamError}`,
        typing: false, isStreaming: false, sources: [], clauseAnalysis: null,
      };
      return updated;
    });
  }, [streamStatus, streamError]);

  /* =========================================================
     LOGOUT
  ========================================================= */
  const handleLogout = useCallback(async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST", credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserName(null);
    setUserImage(null);
    setSubscriptionTier("free");
    setSubscriptionStatus("inactive");
    setRecentConversations([]);
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
  }, []);

  /* =========================================================
     FILE UPLOAD
  ========================================================= */
  const handleFileUpload = useCallback((e) => setFiles([...e.target.files]), []);

  const removeFile = useCallback(
    (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx)),
    []
  );

  const handleFileButtonClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
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
     NOTE: encryptedFetch returns final decrypted JSON data
     directly — do not call `.ok` or `.json()` on it.
  ========================================================= */
  const loadConversation = useCallback(async (conversationId) => {
    closeSidebarOnMobile();
    if (!conversationId || conversationId === "undefined") return;

    try {
      cancel();
      setActiveConversationId(conversationId);
      // Reset scroll position so isNearBottom() returns false after load,
      // guaranteeing the ↓ arrow always appears instead of auto-scrolling.
      if (chatsRef.current) chatsRef.current.scrollTop = 0;
      setMessages([{ text: "Loading conversation...", isBot: true, typing: true }]);

      const data = await encryptedFetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        { method: "GET", credentials: "include" }
      );

      const rawMessages = Array.isArray(data) ? data :
        Array.isArray(data?.messages) ? data.messages : [];

      if (rawMessages.length === 0) { setMessages([DEFAULT_BOT_MESSAGE]); return; }

      setMessages(rawMessages.map((msg) => ({
        text: msg.content,
        isBot: msg.role !== "user",
        sources: msg.sources ?? [],
        clauseAnalysis: msg.clauseAnalysis ?? null,
        hasSources: Array.isArray(msg.sources) && msg.sources.length > 0,
        hasClauseAnalysis: !!msg.clauseAnalysis,
      })));

      // Let the smart scroll useEffect decide — show arrow instead of force-scrolling
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
    // Scroll to bottom when the user sends a message
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
    const isWelcomeMessage = message.isWelcome === true;
    const paragraphs = message.text?.split("\n\n").filter((p) => p.trim()) ?? [];
    const middleIndex = Math.floor(paragraphs.length / 2);

    return (
      <>
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            <ReactMarkdown>{paragraph}</ReactMarkdown>

            {/* TOP AD — after first paragraph */}
            {showAds && !isWelcomeMessage && message.isBot &&
              !message.typing && !message.isStreaming && index === 0 && (
                // <AdBanner
                //   key={`ad-top-${activeConversationId ?? "new"}-${msgIndex}`}
                //   adSlot="4638051915"
                //   adFormat="auto"
                //   height={120}
                //   className="response-ad-top"
                // />
                <AdsterraBanner
                  key={`ad-top-${activeConversationId ?? "new"}-${msgIndex}`}
                  variant="native"
                  height={120}
                  className="response-ad-top"
                />
              )}

            {/* MID AD — at middle paragraph */}
            {showAds && !isWelcomeMessage && message.isBot &&
              !message.typing && !message.isStreaming && index === middleIndex && (
                // <AdBanner
                //   key={`ad-mid-${activeConversationId ?? "new"}-${msgIndex}`}
                //   adSlot="7325824814"
                //   adFormat="fluid"
                //   adLayoutKey="-fb+5w+4e-db+86"
                //   height={100}
                //   className="response-ad-middle"
                // />
                <AdsterraBanner
                  key={`ad-mid-${activeConversationId ?? "new"}-${msgIndex}`}
                  variant="social-bar"
                  height={100}
                  className="response-ad-middle"
                />
              )}
          </div>
        ))}

        {/* BOTTOM AD */}
        {showAds && !isWelcomeMessage && message.isBot &&
          !message.typing && !message.isStreaming && (
            // <AdBanner
            //   key={`ad-bottom-${activeConversationId ?? "new"}-${msgIndex}`}
            //   adSlot="4473601628"
            //   adFormat="auto"
            //   height={80}
            //   className="response-ad-bottom"
            // />
            <AdsterraBanner
              key={`ad-bottom-${activeConversationId ?? "new"}-${msgIndex}`}
              variant="banner"
              width={320}
              adHeight={100}
              height={90}
              className="response-ad-bottom"
            />
          )}
      </>
    );
  }, [showAds, activeConversationId]);

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
      {!isAuthenticated && (
        <AuthModal onAuthenticated={checkAuthentication} />
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

          <select
            className="query"
            value={userLocation}
            onChange={(e) => {
              setUserLocation(e.target.value);
              closeSidebarOnMobile();
            }}
          >
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

        {/* ── Lower sidebar ─────────────────────────────── */}
        <div className="lowerside">

          <button className="midBtn" onClick={startNewChat}>
            <img src={addBtn} alt="" className="addBtn" />
            New Chat
          </button>

          <div className="ListItems">
            <img src={home} alt="" />
            Home
          </div>

          <div className="ListItems upgradeBtn" onClick={() => navigate("/upgrade")}>
            <img src={rocket} alt="" />
            {subscriptionTier === "premium" ? "Pro Active ✓" : "Upgrade to Pro"}
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
                className="chtimg"
                alt=""
              />

              <p className="txt">
                {message.typing || (message.isStreaming && !message.text) ? (
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
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

                    {message.sources?.length > 0 && (
                      <span style={{ marginTop: "10px", display: "block" }}>
                        <strong>Sources:</strong> {message.sources.join(", ")}
                      </span>
                    )}

                    {message.clauseAnalysis && (
                      <span style={{ marginTop: "10px", display: "block" }}>
                        <strong>Clause Analysis:</strong>{" "}
                        {typeof message.clauseAnalysis === "string"
                          ? message.clauseAnalysis
                          : JSON.stringify(message.clauseAnalysis)}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Scroll-to-bottom button ───────────────────── */}
        {showScrollBtn && (
          <button
            className="scroll-to-bottom-btn"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            title="Jump to latest"
          >
            ↓
          </button>
        )}

        {/* ── Chat footer ───────────────────────────────── */}
        <div className="chatfooter">

          {/* ── Attachment tray ── */}
          {files.length > 0 && (
            <div className="attachment-tray">
              {files.map((file, idx) =>
                file.type.startsWith("image/") ? (
                  <div key={idx} className="attachment-chip image-chip">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="chip-thumb"
                    />
                    <button
                      className="chip-remove"
                      onClick={() => removeFile(idx)}
                      title="Remove"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div key={idx} className="attachment-chip file-chip">
                    <span className="chip-icon">📄</span>
                    <span className="chip-name">{file.name}</span>
                    <button
                      className="chip-remove"
                      onClick={() => removeFile(idx)}
                      title="Remove"
                      aria-label={`Remove ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          <div className="inp">

            <input
              type="file"
              multiple
              accept="*/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />

            <button
              type="button"
              className="file-label"
              onClick={handleFileButtonClick}
              style={{
                display: "flex", justifyContent: "center", alignItems: "center",
                width: "50px", height: "50px", fontSize: "30px",
                color: "#fff", cursor: "pointer", borderRadius: "4px",
                background: "none", border: "none",
              }}
            >
              +
            </button>

            <textarea
              placeholder="Send a message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isSending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="chat-input"
            />

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
