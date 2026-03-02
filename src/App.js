import './App.css';
import { useState, useEffect, useRef } from 'react';
import gptLogo from './assets/DeeBees.svg';
import addBtn from './assets/add-30.png';
import msgicon from './assets/message.svg';
import home from './assets/home.svg';
import saved from './assets/bookmark.svg';
import rocket from './assets/rocket.svg';
import sendBtn from './assets/send.svg';
import gptimglogo from './assets/DeeBees.svg';
import ggllogo from './assets/gglepro.jpg';
import defaultUserIcon from './assets/user-icon.png';

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

  const countries = [
    { name: "Nigeria", flag: "🇳🇬" },
    { name: "Kenya", flag: "🇰🇪" },
    { name: "Ghana", flag: "🇬🇭" },
    { name: "South Africa", flag: "🇿🇦" },
    { name: "United States", flag: "🇺🇸" }
  ];

  const [messages, setMessages] = useState([{
    text: " Before you sign anything, upload it here or ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
    isBot: true,
  }]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const autoDetectCountry = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const detected = data.country_name;
        const found = countries.find(c => c.name === detected);
        if (found) setUserLocation(found.name);
      } catch (err) {
        console.warn("Auto-location failed:", err);
      }
    };
    autoDetectCountry();
  }, []);

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

        if (data.isAuthenticated) {
          fetchRecentConversations();
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      }
    };

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

    checkAuthentication();
  }, []);

  const handleFileUpload = (e) => setFiles([...e.target.files]);

  const startNewChat = () => {
    setActiveConversationId(null);
    setMessages([{
      text: " Before you sign anything, upload it here or ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
      isBot: true,
    }]);
    setInput("");
    setFiles([]);
  };

  // ✅ FIXED HERE
  const loadConversation = async (conversationId) => {
    if (!conversationId) return;

    try {
      setActiveConversationId(conversationId);
      setMessages([{ text: "Loading conversation...", isBot: true, typing: true }]);

      const res = await fetch(
        `${API_BASE_URL}/conversations/${conversationId}/messages`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("Failed to load conversation");

      const data = await res.json();

      if (!data.success || !Array.isArray(data.messages)) {
        throw new Error("Malformed server response");
      }

      const formattedMessages = data.messages.map(msg => ({
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
        { text: "⚠️ Failed to load this conversation.", isBot: true }
      ]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    if (!userLocation) {
      alert("Please select your country first.");
      return;
    }

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
      files.forEach((file) => formData.append("files", file));

      const response = await fetch(`${API_BASE_URL}/ask/text`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      setInput("");
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => !msg.typing);
        return [
          ...withoutTyping,
          {
            isBot: true,
            text: data.answer || "Sorry, I couldn’t get a reply.",
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
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => !msg.typing);
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
    }

    setFiles([]);
    setIsSending(false);
  };

  return (
    <div className="App">
      {/* UI unchanged */}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default App;