import '../App.css';
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
import AdBanner from '../components/AdBanner';
import { readAuthCookie } from '../hooks/useAuthCookie';

const API_BASE_URL = process.env.REACT_APP_BASEURL;

const DEFAULT_BOT_MESSAGE = {
  text: " Before you sign anything, upload it here or ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
  isBot: true,
  isWelcome: true,
};

const countries = [
  { name: "Nigeria", flag: "🇳🇬" },
  { name: "Kenya", flag: "🇰🇪" },
  { name: "Ghana", flag: "🇬🇭" },
  { name: "South Africa", flag: "🇿🇦" },
  { name: "United States", flag: "🇺🇸" },
];

function HomePage() {
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatsRef = useRef(null);        // ref on the .chats div for direct scroll
  const navigate = useNavigate();

  /* ── state ────────────────────────────────────────────── */
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [userLocation, setUserLocation] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [userName, setUserName] = useState(null);
  const [userImage, setUserImage] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [recentConversations, setRecentConversations] = useState([]);

  /* ── subscription ─────────────────────────────────────── */
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");

  /* ── messages ─────────────────────────────────────────── */
  const [messages, setMessages] = useState([DEFAULT_BOT_MESSAGE]);

  /*
   * isLiveChat — true only while a new message exchange is in flight.
   * Controls whether stream updates scroll to bottom.
   * Explicitly NOT a useEffect dependency — we call scrollToBottom()
   * imperatively so there is no reactive scroll that fights the user.
   */
  const isLiveChatRef = useRef(false);

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

  /*
   * scrollToBottom — imperative, called only when we explicitly want
   * to snap to the latest message. Never called from a useEffect that
   * watches messages, so it cannot fight user scroll.
   */
  const scrollToBottom = useCallback((behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
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

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) setSidebarOpen((p) => !p);
  };

  /* =========================================================
     FETCH CONVERSATIONS
  ========================================================= */
  const fetchRecentConversations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/conversations`, {
        method: "GET", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const convData = await res.json();
      setRecentConversations(
        Array.isArray(convData) ? convData :
          Array.isArray(convData.conversations) ? convData.conversations : []
      );
    } catch (err) {
      console.error("Error fetching recent conversations:", err);
      setRecentConversations([]);
    }
  };

  /* =========================================================
     AUTH
  ========================================================= */
  const applyUserData = useCallback((data) => {
    setIsAuthenticated(true);
    setUserEmail(data.email ?? data.userEmail ?? null);
    setUserName(data.name ?? null);
    setUserImage(data.photo ?? data.userImage ?? defaultUserIcon);
    setSubscriptionTier(data.subscriptionTier ?? "free");
    setSubscriptionStatus(data.subscriptionStatus ?? "inactive");
  }, []);

  const checkAuthentication = useCallback(async () => {
    const cookie = readAuthCookie();
    if (cookie) {
      applyUserData(cookie);
      setAuthChecked(true);
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
        .catch(() => {});
      return;
    }

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
  }, [applyUserData]);

  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  /* =========================================================
     RENDER BOT MESSAGE
  ========================================================= */
  const renderBotMessage = (message, msgIndex) => {
    const isWelcomeMessage = message.isWelcome === true;
    const paragraphs = message.text?.split("\n\n").filter((p) => p.trim());
    const middleIndex = Math.floor(paragraphs.length / 2);

    return (
      <>
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            <ReactMarkdown>{paragraph}</ReactMarkdown>
            {showAds &&
              !isWelcomeMessage &&
              message.isBot &&
              !message.typing &&
              !message.isStreaming &&
              index === middleIndex && (
                <AdBanner
                  key={`ad-mid-${activeConversationId ?? "new"}-${msgIndex}`}
                  adSlot="7325824814"
                  adFormat="fluid"
                  adLayoutKey="-fb+5w+4e-db+86"
                  height={100}
                  className="response-ad-middle"
                />
              )}
          </div>
        ))}
        {showAds &&
          !isWelcomeMessage &&
          message.isBot &&
          !message.typing &&
          !message.isStreaming && (
            <AdBanner
              key={`ad-bottom-${activeConversationId ?? "new"}-${msgIndex}`}
              adSlot="4473601628"
              adFormat="auto"
              height={80}
              className="response-ad-bottom"
            />
          )}
      </>
    );
  };

  /* =========================================================
     LOGOUT
  ========================================================= */
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST", credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
    isLiveChatRef.current = false;
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserName(null);
    setUserImage(null);
    setSubscriptionTier("free");
    setSubscriptionStatus("inactive");
    setRecentConversations([]);
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
  };

  /* =========================================================
     STREAM — sync live bot message and scroll during streaming.
     scrollToBottom() is called here directly — not via a
     useEffect watching messages — so it only fires during an
     active exchange, never when passively viewing history.
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
    // Only scroll during a live chat the user initiated
    if (isLiveChatRef.current) scrollToBottom();
  }, [streamAnswer, streamSources, streamClause, streamStatus, scrollToBottom]);

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
    isLiveChatRef.current = false;  // exchange finished, unlock scroll
  }, [streamStatus, streamConvoId, isAuthenticated]);

  /* =========================================================
     STREAM — errors
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
    isLiveChatRef.current = false;
  }, [streamStatus, streamError]);

  /* =========================================================
     FILE UPLOAD
  ========================================================= */
  const handleFileUpload = (e) => setFiles([...e.target.files]);
  const handleFileButtonClick = () => {
    if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); }
  };

  /* =========================================================
     NEW CHAT
  ========================================================= */
  const startNewChat = () => {
    toggleSidebar();
    cancel();
    isLiveChatRef.current = false;
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
    setInput("");
    setFiles([]);
  };

  /* =========================================================
     LOAD CONVERSATION
     Scroll to bottom once after load via instant jump (not smooth)
     so the user lands at the latest message, then scroll is free.
     isLiveChatRef stays false so no further auto-scroll happens.
  ========================================================= */
  const loadConversation = async (conversationId) => {
    toggleSidebar();
    if (!conversationId || conversationId === "undefined") return;

    try {
      cancel();
      isLiveChatRef.current = false;
      setActiveConversationId(conversationId);
      setMessages([{ text: "Loading conversation...", isBot: true, typing: true }]);

      const res = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        { method: "GET", credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to load conversation");

      const data = await res.json();
      const rawMessages = Array.isArray(data) ? data :
        Array.isArray(data.messages) ? data.messages : [];

      if (rawMessages.length === 0) { setMessages([DEFAULT_BOT_MESSAGE]); return; }

      setMessages(rawMessages.map((msg) => ({
        text: msg.content,
        isBot: msg.role !== "user",
        sources: msg.sources ?? [],
        clauseAnalysis: msg.clauseAnalysis ?? null,
        hasSources: Array.isArray(msg.sources) && msg.sources.length > 0,
        hasClauseAnalysis: !!msg.clauseAnalysis,
      })));

      /*
       * One-shot jump to bottom so user lands at the latest message.
       * "auto" (instant) not "smooth" so it completes before they
       * can touch the screen — no fighting an in-progress smooth scroll.
       * After this setTimeout resolves, isLiveChatRef is still false
       * so nothing will scroll again until they send a message.
       */
      setTimeout(() => scrollToBottom("auto"), 150);

    } catch (err) {
      console.error("Error loading conversation:", err);
      setMessages([{ text: "⚠️ Failed to load this conversation.", isBot: true }]);
    }
  };

  /* =========================================================
     SEND MESSAGE
     Set isLiveChatRef=true here — the ONLY place — so stream
     updates will scroll to bottom during this exchange only.
  ========================================================= */
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    if (!userLocation) { alert("Please select your country first."); return; }

    const query = input.trim();
    isLiveChatRef.current = true;  // enable scroll-to-bottom for this exchange

    setMessages((prev) => [
      ...prev,
      { text: query || "(Document Uploaded)", isBot: false },
      { text: "", isBot: true, typing: true, isStreaming: false },
    ]);
    scrollToBottom();  // snap to the new user message immediately
    setInput("");
    await ask({ query, country: userLocation, conversationId: activeConversationId, files });
    setFiles([]);
  };

  if (!authChecked) return null;

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div className="App">

      {!isAuthenticated && (
        <AuthModal onAuthenticated={checkAuthentication} />
      )}

      <button className="sidebarToggle" onClick={toggleSidebar}>☰</button>

      {/* ═══════════════════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════════════════ */}
      <div className={`sideBar ${sidebarOpen ? "collapsed" : "open"}`}>
        <div className='upperSide'>
          <div className='uppersideTop'>
            <img src={gptLogo} alt='Logo' className='logo' />
          </div>

          <select
            className='query'
            value={userLocation}
            onChange={(e) => { setUserLocation(e.target.value); toggleSidebar(); }}
          >
            <option value="">-- Select Country --</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
            ))}
          </select>

          <div className='upperSideButton'>
            <h2>Previous Chats</h2>
            {Array.isArray(recentConversations) &&
              recentConversations.map((conv) => {
                const convId = conv._id || conv.id;
                return (
                  <button key={convId} className='query' onClick={() => loadConversation(convId)}>
                    <span className="queryText">{conv.title || "Untitled Chat"}</span>
                  </button>
                );
              })
            }
          </div>
        </div>

        <div className='lowerside'>
          <button className='midBtn' onClick={startNewChat}>
            <img src={addBtn} alt='' className='addBtn' />
            New Chat
          </button>

          <div className='ListItems'>
            <img src={home} alt='' />
            Home
          </div>

          <div className='ListItems upgradeBtn' onClick={() => navigate("/upgrade")}>
            <img src={rocket} alt='' />
            {subscriptionTier === "premium" ? "Pro Active ✓" : "Upgrade to Pro"}
          </div>

          <div className='ListItems'>
            <img src={userImage || defaultUserIcon} alt='' />
            {userName || userEmail || "Account"}
          </div>

          {isAuthenticated && (
            <div className='ListItems logoutBtn' onClick={handleLogout}>
              <img src={logout} alt='' />
              Sign out
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          MAIN CHAT AREA
      ═══════════════════════════════════════════════════ */}
      <div className={`main ${sidebarOpen ? "" : "fullWidth"}`}>

        <div className='chats' ref={chatsRef}>
          {messages.map((message, i) => (
            <div key={i} className={message.isBot ? 'chat bot' : 'chat'}>
              <img
                src={message.isBot ? gptimglogo : (userImage || defaultUserIcon)}
                className='chtimg'
                alt=''
              />
              <p className='txt'>
                {message.typing && !message.isStreaming ? (
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                ) : (
                  <>
                    <div className="bot-message-content">
                      {message.isBot
                        ? renderBotMessage(message, i)
                        : <ReactMarkdown>{message.text}</ReactMarkdown>}
                      {message.isStreaming && (
                        <span className="stream-cursor" aria-hidden="true" />
                      )}
                    </div>

                    {message.sources?.length > 0 && (
                      <span style={{ marginTop: '10px', display: 'block' }}>
                        <strong>Sources:</strong> {message.sources.join(", ")}
                      </span>
                    )}

                    {message.clauseAnalysis && (
                      <span style={{ marginTop: '10px', display: 'block' }}>
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

        {/* ── Chat footer ───────────────────────────────── */}
        <div className='chatfooter'>
          <div className='inp'>
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

            {files.length > 0 && (
              <div className="file-preview">
                {files.map((file, idx) =>
                  file.type.startsWith("image/") ? (
                    <img key={idx} src={URL.createObjectURL(file)} alt='' className="file-thumb" />
                  ) : (
                    <div key={idx} className="file-item">📄 {file.name}</div>
                  )
                )}
              </div>
            )}

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
              <button className='send stop' onClick={cancel} title="Stop generating">■</button>
            ) : (
              <button className='send' onClick={handleSend} disabled={isSending}>
                {isSending ? <div className="loader" /> : <img src={sendBtn} alt='' />}
              </button>
            )}
          </div>

          <p>~ Africa's Legal Intelligence Engine Pipeline ~</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
