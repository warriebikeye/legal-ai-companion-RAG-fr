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
   ENV CONFIG
========================================================= */

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
  const [isSending, setIsSending] = useState(false);
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
    setSidebarOpen((prev) => !prev);
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
    setActiveConversationId(null);
    setMessages([DEFAULT_BOT_MESSAGE]);
    setInput("");
    setFiles([]);
  };

  /* =========================================================
     LOAD CONVERSATION
     FIX: guard against undefined conversationId
          and handle { success, messages } response shape
  ========================================================= */

  const loadConversation = async (conversationId) => {
    // ✅ FIX 1: guard — don't call API if id is missing
    toggleSidebar();
    if (!conversationId || conversationId === "undefined") {
      console.warn("loadConversation called with invalid id:", conversationId);
      return;
    }

    try {
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

      // ✅ FIX 2: handle both array response and { success, messages } shape
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
     SEND MESSAGE
  ========================================================= */

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;

    if (!userLocation) {
      alert("Please select your country first.");
      return;
    }

    try {
      setIsSending(true);

      setMessages((prev) => [
        ...prev,
        { text: input || "(Document Uploaded)", isBot: false },
        { text: "", isBot: true, typing: true },
      ]);

      const formData = new FormData();
      formData.append("query", input);
      formData.append("country", userLocation);

      if (activeConversationId) {
        formData.append("conversationId", activeConversationId);
      }

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(`${API_BASE_URL}/ask/text`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      // ✅ FIX 3: always update conversationId from server response
      if (data.conversationId) {
        setActiveConversationId(data.conversationId);
      }

      if (isAuthenticated) {
        await fetchRecentConversations();
      }

      setInput("");

      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.typing);

        return [
          ...withoutTyping,
          {
            isBot: true,
            text: data.answer || "Sorry, I couldn't get a reply.",
            hasSources: Array.isArray(data.sources) && data.sources.length > 0,
            hasDocumentText: !!data.documentText,
            hasClauseAnalysis: !!data.clauseAnalysis,
            sources: data.sources ?? [],
            documentText: data.documentText ?? null,
            clauseAnalysis: data.clauseAnalysis ?? null,
          },
        ];
      });
    } catch (error) {
      console.error("Error fetching:", error);

      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.typing);

        return [
          ...withoutTyping,
          {
            isBot: true,
            text: "⚠️ There was an error connecting to the server.",
            hasSources: false,
            hasDocumentText: false,
            hasClauseAnalysis: false,
            sources: [],
            documentText: null,
            clauseAnalysis: null,
          },
        ];
      });
    } finally {
      setFiles([]);
      setIsSending(false);
    }
  };

  return (
    <div className="App">
      <button
        className="sidebarToggle"
        onClick={toggleSidebar}
      >
        ☰
      </button>
      {/* <button
        className="sidebarToggle"
        onClick={() => setSidebarOpen((prev) => !prev)}
      >
        ☰
      </button> */}

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
                    // ✅ FIX 4: use conv._id (MongoDB) not conv.id
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
                src={
                  message.isBot
                    ? gptimglogo
                    : userImage || defaultUserIcon
                }
                className='chtimg'
                alt=''
              />

              <p className='txt'>
                {message.typing ? (
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  <>
                    <div className="bot-message-content">
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>

                    {message.clauseAnalysis && (
                      <span style={{ marginTop: '10px', display: 'block' }}>
                        <strong>Clause Analysis:</strong>{" "}
                        {typeof message.clauseAnalysis === "string"
                          ? message.clauseAnalysis
                          : JSON.stringify(message.clauseAnalysis)}
                      </span>
                    )}

                    {message.sources && message.sources.length > 0 && (
                      <span style={{ marginTop: '10px', display: 'block' }}>
                        <strong>Sources:</strong>{" "}
                        {message.sources.join(", ")}
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
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />

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

          </div>

          <p>~ Africa's Legal Intelligence Engine ~</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;