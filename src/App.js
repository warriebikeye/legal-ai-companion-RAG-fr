import './App.css';
import { useState, useEffect, useRef } from 'react';
import gptLogo from './assets/DeeBees.svg';
import addBtn from './assets/add-30.png';
import home from './assets/home.svg';
import saved from './assets/bookmark.svg';
import rocket from './assets/rocket.svg';
import sendBtn from './assets/send.svg';
import gptimglogo from './assets/DeeBees.svg';
import ggllogo from './assets/gglepro.jpg';
import defaultUserIcon from './assets/user-icon.png';

/* =========================================================
   API Base URL
========================================================= */
const API_BASE_URL = process.env.REACT_APP_BASEURL;

function App() {
  const messagesEndRef = useRef(null);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [userLocation, setUserLocation] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [userImage, setUserImage] = useState(null);

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [recentConversations, setRecentConversations] = useState([]);

  const [messages, setMessages] = useState([{
    text: "Before you sign anything, upload it here or ask questions.",
    isBot: true,
  }]);

  /* =========================================================
     Restore conversation after refresh
  ========================================================= */
  useEffect(() => {
    const savedId = localStorage.getItem("activeConversationId");
    if (savedId && savedId !== "undefined") {
      setActiveConversationId(savedId);
    }
  }, []);

  /* =========================================================
     Auto-scroll chats
  ========================================================= */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* =========================================================
     Detect country
  ========================================================= */
  useEffect(() => {
    const autoDetectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data.country_name) setUserLocation(data.country_name);
      } catch {}
    };
    autoDetectCountry();
  }, []);

  /* =========================================================
     Auth + Fetch Conversations
  ========================================================= */
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          credentials: "include"
        });

        if (!res.ok) return;

        const data = await res.json();

        setIsAuthenticated(Boolean(data.isAuthenticated));
        setUserEmail(data.userEmail || null);
        setUserImage(data.userImage || defaultUserIcon);

        if (data.isAuthenticated) fetchRecentConversations();

      } catch (err) {
        console.error(err);
      }
    };

    init();
  }, []);

  /* =========================================================
     Normalize conversations (CRITICAL FIX)
  ========================================================= */
  const fetchRecentConversations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/conversations`, {
        credentials: "include"
      });

      const data = await res.json();

      const array =
        Array.isArray(data) ? data :
        Array.isArray(data.conversations) ? data.conversations :
        [];

      const normalized = array.map(conv => ({
        id: conv.id || conv._id || conv.conversationId,
        title: conv.title || "Untitled Chat"
      }));

      setRecentConversations(normalized);

    } catch (err) {
      console.error("Conversation fetch failed:", err);
      setRecentConversations([]);
    }
  };

  /* =========================================================
     Start New Chat
  ========================================================= */
  const startNewChat = () => {
    setActiveConversationId(null);
    localStorage.removeItem("activeConversationId");

    setMessages([{
      text: "Before you sign anything, upload it here or ask questions.",
      isBot: true,
    }]);

    setInput("");
    setFiles([]);
  };

  /* =========================================================
     Load Conversation (SAFE)
  ========================================================= */
  const loadConversation = async (conversationId) => {
    if (!conversationId || conversationId === "undefined") return;

    try {
      setActiveConversationId(conversationId);
      localStorage.setItem("activeConversationId", conversationId);

      setMessages([{ text: "Loading...", isBot: true, typing: true }]);

      const res = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        { credentials: "include" }
      );

      const data = await res.json();

      const formatted = data.map(msg => ({
        text: msg.content,
        isBot: msg.role !== "user",
        sources: msg.sources ?? [],
        clauseAnalysis: msg.clauseAnalysis ?? null
      }));

      setMessages(formatted);

    } catch (err) {
      console.error(err);
      setMessages([{ text: "Failed to load conversation.", isBot: true }]);
    }
  };

  /* =========================================================
     Send Message (captures new conversation ID)
  ========================================================= */
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;

    setIsSending(true);

    setMessages(prev => [
      ...prev,
      { text: input || "(Document Uploaded)", isBot: false },
      { text: "", isBot: true, typing: true }
    ]);

    try {
      const formData = new FormData();
      formData.append("query", input);
      formData.append("country", userLocation);

      if (activeConversationId) {
        formData.append("conversationId", activeConversationId);
      }

      files.forEach(f => formData.append("files", f));

      const res = await fetch(`${API_BASE_URL}/ask/text`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const data = await res.json();

      /* 🔥 IMPORTANT FIX */
      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
        localStorage.setItem("activeConversationId", data.conversationId);
        fetchRecentConversations();
      }

      setMessages(prev => {
        const clean = prev.filter(m => !m.typing);
        return [...clean, {
          isBot: true,
          text: data.answer || "No response."
        }];
      });

      setInput("");

    } catch (err) {
      console.error(err);
    }

    setFiles([]);
    setIsSending(false);
  };

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="App">

      <div className={`sideBar ${sidebarOpen ? "collapsed" : "open"}`}>
        <img src={gptLogo} alt="" className='logo' />

        {isAuthenticated ? (
          <>
            <h3>Previous Chats</h3>
            {recentConversations.map(conv => (
              <button key={conv.id} onClick={() => loadConversation(conv.id)}>
                {conv.title}
              </button>
            ))}
          </>
        ) : (
          <button onClick={() => window.location.href = `${API_BASE_URL}/auth/google`}>
            Sign in with Google
            <img src={ggllogo} alt="" />
          </button>
        )}

        <button onClick={startNewChat}>
          <img src={addBtn} alt="" /> New Chat
        </button>
      </div>

      <div className="main">
        <div className='chats'>
          {messages.map((m, i) => (
            <div key={i} className={m.isBot ? 'chat bot' : 'chat'}>
              <img src={m.isBot ? gptimglogo : (userImage || defaultUserIcon)} alt='' />
              <p>{m.typing ? "..." : m.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className='chatfooter'>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder='Send a message'
          />
          <button onClick={handleSend} disabled={isSending}>
            <img src={sendBtn} alt='' />
          </button>
        </div>
      </div>

    </div>
  );
}

export default App;