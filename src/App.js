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

/* =========================================================
   ✅ FIX: Centralized environment-aware API base URL
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

  const countries = [
    { name: "Nigeria", flag: "🇳🇬" },
    { name: "Kenya", flag: "🇰🇪" },
    { name: "Ghana", flag: "🇬🇭" },
    { name: "South Africa", flag: "🇿🇦" },
    { name: "United States", flag: "🇺🇸" }
  ];

  const [messages, setMessages] = useState([
    {
      text: " Before you sign anything, upload it here or ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
      isBot: true,
    }
  ]);

  // Auto-scroll chats
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch user location using GeoIP
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

  // =========================================================
  // ✅ FIX: Auth check now uses API_BASE_URL
  // =========================================================
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
        console.log(API_BASE_URL)
        console.log(data);
        setIsAuthenticated(Boolean(data.isAuthenticated));
        setUserEmail(data.userEmail || null);
        setUserImage(data.userImage || defaultUserIcon);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsAuthenticated(false);
      }
    };

    checkAuthentication();
  }, []);

  const handleFileUpload = (e) => setFiles([...e.target.files]);

  const startNewChat = () => {
    setMessages([
      {
        text: " Before you sign anything, upload it here or ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
        isBot: true,
      }
    ]);
    setInput("");
    setFiles([]);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      files.forEach((file) => formData.append("files", file));

      // =========================================================
      // ✅ FIX: Message request uses API_BASE_URL
      // =========================================================
      const response = await fetch(`${API_BASE_URL}/ask/text`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

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

    setInput("");
    setFiles([]);
    setIsSending(false);
  };

  return (
    <div className="App">
      <button className="sidebarToggle" onClick={() => setSidebarOpen(prev => !prev)}>
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
            onChange={(e) => setUserLocation(e.target.value)}
          >
            <option value="">-- Select Country --</option>
            {countries.map(c => (
              <option key={c.name} value={c.name}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>

          <div className='upperSideButton'>
            {isAuthenticated ? (
              <>
                <button className='query'><img src={msgicon} alt='' /> what is programming?</button>
                <button className='query'><img src={msgicon} alt='' /> How to use an API?</button>
                <button className='query'><img src={msgicon} alt='' /> How to use an API?</button>
              </>
            ) : (
              <button
                className="queryxx google-sign-in"
                // =========================================================
                // ✅ FIX: Google OAuth redirect uses API_BASE_URL
                // =========================================================
                onClick={() => window.location.href = `${API_BASE_URL}/auth/google`}
              >
                Sign in with Google
                <img src={ggllogo} alt="Google Logo" className="google-logo" />
              </button>
            )}
          </div>
        </div>

        <div className='lowerside'>
          <button className='midBtn' onClick={startNewChat}>
            <img src={addBtn} alt='' className='addBtn' />New Chat
          </button>
          <div className='ListItems'><img src={home} alt='' /> Home</div>
          <div className='ListItems'><img src={rocket} alt='' /> Upgrade to Pro</div>
          <div className='ListItems'>
            <img src={isAuthenticated && userImage ? userImage : saved} alt='' /> 
            {isAuthenticated ? userEmail : "Saved"}
          </div>
        </div>
      </div>

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
                {message.typing ? (
                  <div className="typing-dots"><span></span><span></span><span></span></div>
                ) : (
                  message.text
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
            <label htmlFor="file-input" className="file-label">+</label>

            {files.length > 0 && (
              <div className="file-preview">
                {files.map((file, idx) =>
                  file.type.startsWith("image/")
                    ? <img key={idx} src={URL.createObjectURL(file)} alt='' className="file-thumb" />
                    : <div key={idx} className="file-item">📄 {file.name}</div>
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

            <button className='send' onClick={handleSend} disabled={isSending}>
              {isSending ? <div className="loader"></div> : <img src={sendBtn} alt='' />}
            </button>
          </div>
          <p> ~ Africa’s Legal Intelligence Engine ~</p>
        </div>
      </div>
    </div>
  );
}

export default App;
