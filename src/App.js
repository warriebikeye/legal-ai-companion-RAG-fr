import './App.css';
import { useState, useEffect, useRef } from 'react';
import gptLogo from './assets/DeeBees.svg';
import addBtn from './assets/add-30.png';
import msgicon from './assets/message.svg';
import home from './assets/home.svg';
import saved from './assets/bookmark.svg';
import rocket from './assets/rocket.svg';
import sendBtn from './assets/send.svg';
import usericon from './assets/user-icon.png';
import gptimglogo from './assets/DeeBees.svg';

function App() {
  const messagesEndRef = useRef(null);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [files, setFiles] = useState([]);
  const [userLocation, setUserLocation] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const countries = [
    { name: "Nigeria", flag: "🇳🇬" },
    { name: "Kenya", flag: "🇰🇪" },
    { name: "Ghana", flag: "🇬🇭" },
    { name: "South Africa", flag: "🇿🇦" },
    { name: "United States", flag: "🇺🇸" }
  ];

  const [messages, setMessages] = useState([
    {
      text:" Before you sign anything, upload it here, ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
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

  const handleFileUpload = (e) => setFiles([...e.target.files]);

  const startNewChat = () => {
    setMessages([
      {
        text: " Before you sign anything, upload it here, ask questions. I will show you if any part violates the law. Works for rent, loans, and job offers.",
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
    const userMessage = { text: input || "(Document Uploaded)", isBot: false };
    setMessages(prev => [...prev, userMessage]);
    const typingMsg = { text: "", isBot: true, typing: true };
    setMessages(prev => [...prev, typingMsg]);

    try {
      const formData = new FormData();
      formData.append("query", input);
      formData.append("country", userLocation);
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("https://legal-ai-companion-rag.onrender.com/ask/text", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.typing);

        return [
          ...withoutTyping,
          {
            isBot: true,

            // Main answer
            text: data.answer || "Sorry, I couldn’t get a reply.",

            // Section spacing flags
            hasSources: Array.isArray(data.sources) && data.sources.length > 0,
            hasDocumentText: !!data.documentText,
            hasClauseAnalysis: !!data.clauseAnalysis,

            // Structured sections
            sources: Array.isArray(data.sources) ? data.sources : [],
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
    }

    setInput("");
    setFiles([]);
    setIsSending(false);
  };

  return (
    <div className="App">
      {/* Sidebar toggle button for mobile */}
      <button className="sidebarToggle" onClick={() => setSidebarOpen(prev => !prev)}>
        ☰
      </button>

      <div className={`sideBar ${sidebarOpen ? "collapsed" : "open"}`}>
        <div className='upperSide'>
          <div className='uppersideTop'>
            <img src={gptLogo} alt='Logo' className='logo' />
          </div>

          {/* Country dropdown */}
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
            <button className='query'><img src={msgicon} alt='query' /> what is programming?</button>
            <button className='query'><img src={msgicon} alt='query' /> How to use an API?</button>
            <button className='query'><img src={msgicon} alt='query' /> How to use an API?</button>
            <button className='query'><img src={msgicon} alt='query' /> How to use an API?</button>
            <button className='query'><img src={msgicon} alt='query' /> How to use an API?</button>
            <button className='query'><img src={msgicon} alt='query' /> How to use an API?</button>
            <button className='query'><img src={msgicon} alt='query' /> How to use an API?</button>
          </div>
        </div>

        <div className='lowerside'>
          <button className='midBtn' onClick={startNewChat}>
            <img src={addBtn} alt='New Chat' className='addBtn' />New Chat
          </button>
          <div className='ListItems'><img src={home} alt='Home' className='listitemsimg' />Home</div>
          <div className='ListItems'><img src={saved} alt='saved' className='listitemsimg' />Saved</div>
          <div className='ListItems'><img src={rocket} alt='upgrade' className='listitemsimg' />Upgrade to Pro</div>
        </div>
      </div>

      <div className={`main ${sidebarOpen ? "" : "fullWidth"}`}>
        <div className='chats'>
          {messages.map((message, i) =>
            <div key={i} className={message.isBot ? 'chat bot' : 'chat'}>
              <img src={message.isBot ? gptimglogo : usericon} className='chtimg' alt='' />
              <p className='txt'>
                {message.typing ? (
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                ) : (
                  message.text
                )}
              </p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className='chatfooter'>
          <div className='inp'>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,image/*"
              className="filein"
              style={{ display: "none" }} // Hides the default file input button
              onChange={handleFileUpload}
              id="file-input"
            />
            <label
              htmlFor="file-input"
              style={{
                display: "inline-block",
                padding: "10px",
                background: "transparent",
                color: "#fff",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "25px",
                textAlign: "center"
              }}
            >
              +
            </label>

            {files.length > 0 && (
              <div className="file-preview">
                {files.map((file, idx) => {
                  if (file.type.startsWith("image/")) {
                    const url = URL.createObjectURL(file);
                    return <img key={idx} src={url} alt={file.name} className="file-thumb" />;
                  } else {
                    return <div key={idx} className="file-item">📄 {file.name}</div>;
                  }
                })}
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
              {isSending ? (
                <div className="loader"></div>
              ) : (
                <img src={sendBtn} alt='send' />
              )}
            </button>
          </div>
          <p> ~ Africa’s Legal Intelligence Engine ~</p>
        </div>

      </div>
    </div>
  );
}

export default App;

