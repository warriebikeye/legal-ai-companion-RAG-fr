import '../App.css';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import gptLogo from '../assets/DeeBees.svg';
import addBtn from '../assets/add-30.png';
import home from '../assets/home.svg';
import saved from '../assets/bookmark.svg';
import rocket from '../assets/rocket.svg';
import sendBtn from '../assets/send.svg';
import gptimglogo from '../assets/DeeBees.svg';
import ggllogo from '../assets/gglepro.jpg';
import defaultUserIcon from '../assets/user-icon.png';

/* =========================================================
   CHANGE 1 — import the streaming hook
========================================================= */
import { useRAGStream } from '../hooks/useRAGStream';

const API_BASE_URL = process.env.REACT_APP_BASEURL;

/* =========================================================
   DEFAULT BOT MESSAGE
========================================================= */

const DEFAULT_BOT_MESSAGE = {
  text: " Before you sign anything, upload it here or ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
  isBot: true,
};

/* =========================================================
   LOGGER
========================================================= */

const log = (step, data = null) => {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[APP] [${timestamp}] ${step}`, data);
  } else {
    console.log(`[APP] [${timestamp}] ${step}`);
  }
};

function HomePage() {
  const messagesEndRef = useRef(null);

  /* =========================================================
     STATES
  ========================================================= */

  const [input, setInput] = useState("");
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [userLocation, setUserLocation] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [userImage, setUserImage] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [recentConversations, setRecentConversations] = useState([]);

  /* =========================================================
     SUBSCRIPTION
  ========================================================= */

  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [subscriptionExpiry, setSubscriptionExpiry] = useState(null);

  /* =========================================================
     MESSAGES
  ========================================================= */

  const [messages, setMessages] = useState([DEFAULT_BOT_MESSAGE]);

  /* =========================================================
     CHANGE 2 — replace isSending with the stream hook
     The hook gives us: ask, cancel, answer, sources,
     clauseAnalysis, status, conversationId, isStreaming
  ========================================================= */
  const {
    ask,
    cancel,
    answer: streamAnswer,
    sources: streamSources,
    clauseAnalysis: streamClause,
    status: streamStatus,
    error: streamError,
    conversationId: streamConvoId,
  } = useRAGStream();

  // Derived booleans that replace isSending
  const isSending  = streamStatus === "preparing" || streamStatus === "streaming";
  const isStreaming = streamStatus === "streaming";

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
     AUTO SCROLL
  ========================================================= */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* =========================================================
     COUNTRY DETECTION
  ========================================================= */

  useEffect(() => {
    const autoDetectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const detected = data.country_name;
        const found = countries.find((c) => c.name === detected);
        if (found) setUserLocation(found.name);
      } catch (err) {
        console.warn("Auto-location failed:", err);
      }
    };

    autoDetectCountry();
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen((prev) => !prev);
    }
  };

  /* =========================================================
     FETCH CONVERSATIONS
  ========================================================= */

  const fetchRecentConversations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/conversations`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch conversations");

      const convData = await res.json();

      if (Array.isArray(convData)) {
        setRecentConversations(convData);
      } else if (Array.isArray(convData.conversations)) {
        setRecentConversations(convData.conversations);
      } else {
        setRecentConversations([]);
      }
    } catch (err) {
      console.error("Error fetching recent conversations:", err);
      setRecentConversations([]);
    }
  };

  /* =========================================================
     AUTH CHECK
  ========================================================= */

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          setIsAuthenticated(false);
          return;
        }

        const data = await res.json();

        setIsAuthenticated(Boolean(data.isAuthenticated));
        setUserEmail(data.userEmail || null);
        setUserImage(data.userImage || defaultUserIcon);
        setSubscriptionTier(data.subscriptionTier || "free");
        setSubscriptionExpiry(data.subscriptionExpiry || null);

        if (data.isAuthenticated) {
          await fetchRecentConversations();
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuthentication();
  }, []);

  /* =========================================================
     CHANGE 3 — sync the live streaming bot message
     As streamAnswer grows token by token, we update the last
     bot message in place so the user sees text appearing live.
     This effect runs every time streamAnswer or streamStatus changes.
  ========================================================= */

  useEffect(() => {
    if (streamStatus === "idle" || streamStatus === "done") return;

    setMessages((prev) => {
      // Find and update the last bot message (the streaming placeholder)
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);

      if (lastBotIdx === -1) return prev;

      updated[lastBotIdx] = {
        ...updated[lastBotIdx],
        text: streamAnswer || "",
        typing: streamStatus === "preparing",   // show dots while preparing
        isStreaming: streamStatus === "streaming", // used for cursor below
        sources: streamSources || [],
        clauseAnalysis: streamClause || null,
        hasSources: (streamSources || []).length > 0,
        hasClauseAnalysis: !!streamClause,
      };

      return updated;
    });
  }, [streamAnswer, streamSources, streamClause, streamStatus]);

  /* =========================================================
     CHANGE 4 — once stream is done, sync conversationId +
     refresh the sidebar conversations list
  ========================================================= */

  useEffect(() => {
    if (streamStatus !== "done") return;

    // Clear the blinking cursor on the last bot message
    setMessages((prev) => {
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);
      if (lastBotIdx === -1) return prev;
      updated[lastBotIdx] = {
        ...updated[lastBotIdx],
        isStreaming: false,
        typing: false,
      };
      return updated;
    });

    if (streamConvoId) {
      setActiveConversationId(streamConvoId);
    }

    if (isAuthenticated) {
      fetchRecentConversations();
    }
  }, [streamStatus, streamConvoId, isAuthenticated]);

  /* =========================================================
     CHANGE 5 — surface stream errors into the chat
  ========================================================= */

  useEffect(() => {
    if (streamStatus !== "error" || !streamError) return;

    setMessages((prev) => {
      const updated = [...prev];
      const lastBotIdx = updated.map((m) => m.isBot).lastIndexOf(true);
      if (lastBotIdx === -1) return prev;
      updated[lastBotIdx] = {
        isBot: true,
        text: `⚠️ ${streamError}`,
        typing: false,
        isStreaming: false,
        sources: [],
        clauseAnalysis: null,
      };
      return updated;
    });
  }, [streamStatus, streamError]);

  /* =========================================================
     FILE UPLOAD
  ========================================================= */

  const handleFileUpload = (e) => {
    const uploadedFiles = [...e.target.files];
    setFiles(uploadedFiles);
  };

  /* =========================================================
     NEW CHAT
  ========================================================= */

  const startNewChat = () => {
    toggleSidebar();
    cancel(); // CHANGE 6 — cancel any in-flight stream
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
    setInput("");
    setFiles([]);
  };

  /* =========================================================
     LOAD CONVERSATION
  ========================================================= */

  const loadConversation = async (conversationId) => {
    toggleSidebar();
    if (!conversationId || conversationId === "undefined") {
      console.warn("loadConversation called with invalid id:", conversationId);
      return;
    }

    try {
      cancel(); // CHANGE 7 — cancel stream before switching conversation
      setActiveConversationId(conversationId);

      setMessages([
        { text: "Loading conversation...", isBot: true, typing: true },
      ]);

      const res = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        { method: "GET", credentials: "include" }
      );

      if (!res.ok) throw new Error("Failed to load conversation");

      const data = await res.json();

      const rawMessages = Array.isArray(data)
        ? data
        : Array.isArray(data.messages)
          ? data.messages
          : [];

      if (rawMessages.length === 0) {
        setMessages([DEFAULT_BOT_MESSAGE]);
        return;
      }

      const formattedMessages = rawMessages.map((msg) => ({
        text: msg.content,
        isBot: msg.role !== "user",
        sources: msg.sources ?? [],
        clauseAnalysis: msg.clauseAnalysis ?? null,
        hasSources: Array.isArray(msg.sources) && msg.sources.length > 0,
        hasClauseAnalysis: !!msg.clauseAnalysis,
      }));

      setMessages(formattedMessages);

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Error loading conversation:", err);
      setMessages([
        { text: "⚠️ Failed to load this conversation.", isBot: true },
      ]);
    }
  };

  /* =========================================================
     CHANGE 8 — handleSend: replace fetch() with ask()
     The old fetch + setMessages pattern is gone.
     Now we:
       1. Append user message
       2. Append an empty bot placeholder (typing dots)
       3. Call ask() — the hook drives all subsequent updates
          via the effects above
  ========================================================= */

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;

    if (!userLocation) {
      alert("Please select your country first.");
      return;
    }

    const query = input.trim();

    // Append user message + empty bot placeholder immediately
    setMessages((prev) => [
      ...prev,
      { text: query || "(Document Uploaded)", isBot: false },
      { text: "", isBot: true, typing: true, isStreaming: false },
    ]);

    setInput("");

    // Start the stream — the useRAGStream effects take over from here
    await ask({
      query,
      country: userLocation,
      conversationId: activeConversationId,
      files,
    });

    setFiles([]);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="App">
      <button className="sidebarToggle" onClick={toggleSidebar}>
        ☰
      </button>

      <div className={`sideBar ${sidebarOpen ? "collapsed" : "open"}`}>

        <div className='upperSide'>

          <div className='uppersideTop'>
            <img src={gptLogo} alt='Logo' className='logo' />
          </div>

          <select
            className='query'
            value={userLocation}
            onChange={(e) => {
              setUserLocation(e.target.value);
              toggleSidebar();
            }}
          >
            <option value="">-- Select Country --</option>
            {countries.map((c) => (
              <option key={c.name} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>

          <div className='upperSideButton'>
            {isAuthenticated ? (
              <>
                <h2>Previous Chats</h2>

                {Array.isArray(recentConversations) &&
                  recentConversations.map((conv) => {
                    const convId = conv._id || conv.id;

                    return (
                      <button
                        key={convId}
                        className='query'
                        onClick={() => loadConversation(convId)}
                      >
                        <span className="queryText">
                          {conv.title || "Untitled Chat"}
                        </span>
                      </button>
                    );
                  })}
              </>
            ) : (
              <button
                className="queryxx google-sign-in"
                onClick={() =>
                  (window.location.href = `${API_BASE_URL}/auth/google`)
                }
              >
                Sign in with Google
                <img src={ggllogo} alt="Google Logo" className="google-logo" />
              </button>
            )}
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

          <div
            className='ListItems upgradeBtn'
            onClick={() => navigate("/upgrade")}
          >
            <img src={rocket} alt='' />
            {subscriptionTier === "premium" ? "Pro Active" : "Upgrade to Pro"}
          </div>

          <div className='ListItems'>
            <img
              src={isAuthenticated && userImage ? userImage : saved}
              alt=''
            />
            {isAuthenticated ? userEmail : "Saved"}
          </div>
        </div>
      </div>

      <div className={`main ${sidebarOpen ? "" : "fullWidth"}`}>

        <div className='chats'>
          {messages.map((message, i) => (
            <div
              key={i}
              className={message.isBot ? 'chat bot' : 'chat'}
            >
              <img
                src={message.isBot ? gptimglogo : userImage || defaultUserIcon}
                className='chtimg'
                alt=''
              />

              <p className='txt'>
                {message.typing && !message.isStreaming ? (
                  /* Waiting for first token — show animated dots */
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  <>
                    <div className="bot-message-content">
                      <ReactMarkdown>{message.text}</ReactMarkdown>

                      {/* CHANGE 9 — blinking cursor while streaming */}
                      {message.isStreaming && (
                        <span className="stream-cursor" aria-hidden="true" />
                      )}
                    </div>

                    {/* Sources — appear as soon as meta event arrives */}
                    {message.sources && message.sources.length > 0 && (
                      <span style={{ marginTop: '10px', display: 'block' }}>
                        <strong>Sources:</strong>{" "}
                        {message.sources.join(", ")}
                      </span>
                    )}

                    {/* Clause analysis — appears after stream finishes */}
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

        <div className='chatfooter'>
          <div className='inp'>

            <input
              type="file"
              multiple
              accept=".pdf,.txt,image/*"
              className="filein"
              style={{ display: "none" }}
              onChange={handleFileUpload}
              id="file-input"
            />

            <label
              htmlFor="file-input"
              className="file-label"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "50px",
                height: "50px",
                fontSize: "30px",
                cursor: "pointer",
                borderRadius: "4px",
              }}
            >
              +
            </label>

            {files.length > 0 && (
              <div className="file-preview">
                {files.map((file, idx) =>
                  file.type.startsWith("image/") ? (
                    <img
                      key={idx}
                      src={URL.createObjectURL(file)}
                      alt=''
                      className="file-thumb"
                    />
                  ) : (
                    <div key={idx} className="file-item">
                      📄 {file.name}
                    </div>
                  )
                )}
              </div>
            )}

            <input
              type='text'
              placeholder='Send a message'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isSending && handleSend()}
            />

            {/* CHANGE 10 — Stop button while streaming, Send otherwise */}
            {isStreaming ? (
              <button className='send stop' onClick={cancel} title="Stop generating">
                ■
              </button>
            ) : (
              <button
                className='send'
                onClick={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <div className="loader"></div>
                ) : (
                  <img src={sendBtn} alt='' />
                )}
              </button>
            )}

          </div>

          <p>~ Africa's Legal Intelligence Engine ~</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;