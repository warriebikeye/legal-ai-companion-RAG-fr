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
   * shouldAutoScroll controls whether new content snaps to bottom.
   *
   * TRUE  → during active chat (user sent a message, bot is replying)
   * FALSE → when loading a past conversation (user should be free to scroll)
   *
   * We never set it true inside the auto-scroll useEffect itself,
   * only at the point where the user actually triggers a new message.
   */
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);

  /* ── derived: show ads only to free-tier users ────────── */
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
     AUTO SCROLL
     Only fires when shouldAutoScroll is true — i.e. the user
     just sent a message and we want to follow the bot reply.
     Loading a conversation sets shouldAutoScroll=false so the
     user lands at the bottom once but can freely scroll up.
  ========================================================= */
  useEffect(() => {
    if (!shouldAutoScroll) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, shouldAutoScroll]);

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
    setIsAuthenticated(false);
    setUserEmail(null);
    setUserName(null);
    setUserImage(null);
    setSubscriptionTier("free");
    setSubscriptionStatus("inactive");
    setRecentConversations([]);
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
    setShouldAutoScroll(false);
  };

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
    // Stream finished — we can relax auto-scroll lock now.
    // User can scroll freely; next send will re-enable it.
    setShouldAutoScroll(false);
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
    setShouldAutoScroll(false);
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
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
    setInput("");
    setFiles([]);
    setShouldAutoScroll(false);
  };

  /* =========================================================
     LOAD CONVERSATION
     1. Set shouldAutoScroll=false so the user can scroll freely
        once the history loads.
     2. After messages render, do ONE programmatic scroll to bottom
        so they land at the most recent message (normal chat UX).
     3. Never lock scroll again until the user sends a new message.
  ========================================================= */
  const loadConversation = async (conversationId) => {
    toggleSidebar();
    if (!conversationId || conversationId === "undefined") return;

    try {
      cancel();
      // Disable auto-scroll before setting messages so the
      // useEffect above does not fire during the load.
      setShouldAutoScroll(false);
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
       * Single one-off scroll to bottom after the conversation loads.
       * We do this manually with a timeout (to let React paint first)
       * rather than through shouldAutoScroll, so it only fires once
       * and the user can immediately scroll up after.
       */
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);

    } catch (err) {
      console.error("Error loading conversation:", err);
      setMessages([{ text: "⚠️ Failed to load this conversation.", isBot: true }]);
    }
  };

  /* =========================================================
     SEND MESSAGE
     Enable auto-scroll here — the user initiated a new exchange
     so we should follow the reply as it streams in.
  ========================================================= */
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    if (!userLocation) { alert("Please select your country first."); return; }

    const query = input.trim();

    // Lock scroll to bottom for the duration of this exchange.
    setShouldAutoScroll(true);

    setMessages((prev) => [
      ...prev,
      { text: query || "(Document Uploaded)", isBot: false },
      { text: "", isBot: true, typing: true, isStreaming: false },
    ]);
    setInput("");
    await ask({ query, country: userLocation, conversationId: activeConversationId, files });
    setFiles([]);
  };

  /* =========================================================
     HOLD RENDER UNTIL AUTH CHECK DONE
  ========================================================= */
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

        <div className='chats'>
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
