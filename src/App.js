import './App.css';
import { useState, useEffect, useRef } from 'react'; 
import gptLogo from './assets/chatgpt.svg';
import addBtn from './assets/add-30.png'; 
import msgicon from './assets/message.svg';
import home from './assets/home.svg';
import saved from './assets/bookmark.svg';
import rocket from './assets/rocket.svg';
import sendBtn from './assets/send.svg';
import usericon from './assets/user-icon.png';
import gptimglogo from './assets/chatgptLogo.svg';

function App() {
  const messagesEndRef = useRef(null);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false); // ⭐ sending/loading state
  const [files, setFiles] = useState([]); // ⭐ uploaded files
  const [messages, setMessages] = useState([
    {
      text: "Hi i am a state of the legal companion created by Warri Ebikeye Cyprian , I am designed to provide you with legal information and generate human-like text based on the input i receive. You can ask me questions, have conversations, seek informations about the Law of your country. Let me know how i can help you",
      isBot: true,
    }
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ⭐ file upload handler
  const handleFileUpload = (e) => {
    setFiles([...e.target.files]);
  };

  // ⭐ handle send with FormData + loading
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;

    setIsSending(true); // ⭐ start loading

    const userMessage = { text: input || "(Document Uploaded)", isBot: false };
    setMessages((prev) => [...prev, userMessage]);

    const typingMsg = { text: "", isBot: true, typing: true };
    setMessages((prev) => [...prev, typingMsg]);

    try {
      const formData = new FormData();
      formData.append("query", input);
      formData.append("country", "nigeria");

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("https://legal-ai-companion-rag.onrender.com/ask/text", {
        method: "POST",
        body: formData, 
      });

      const data = await response.json();

      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.typing);
        return [
          ...withoutTyping,
          { text: data.answer || "Sorry, I couldn’t get a reply.", isBot: true }
        ];
      });

    } catch (error) {
      console.error("Error fetching:", error);
      setMessages((prev) => {
        const withoutTyping = prev.filter((msg) => !msg.typing);
        return [
          ...withoutTyping,
          { text: "⚠️ There was an error connecting to the server.", isBot: true }
        ];
      });
    }

    setInput("");
    setFiles([]); 
    setIsSending(false); // ⭐ end loading
  };

  return (
    <div className="App">
      <div className='sideBar'>
        <div className='upperSide'>
          <div className='uppersideTop'>
            <img src={gptLogo} alt='Logo' className='logo'/>
            <span className='brand'>DeeBee -Your legal AI</span>
          </div>
          <button className='midBtn'>
            <img src={addBtn} alt='New Chat' className='addBtn'/>New Chat
          </button>
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
          <div className='ListItems'><img src={home} alt='Home' className='listitemsimg' />Home</div>
          <div className='ListItems'><img src={saved} alt='saved' className='listitemsimg' />Saved</div>
          <div className='ListItems'><img src={rocket} alt='upgrade' className='listitemsimg' />Upgrade to Pro</div>
        </div>
      </div>

      <div className='main'>
        <div className='chats'>
          {messages.map((message, i) =>
            <div key={i} className={message.isBot ? 'chat bot' : 'chat'}>
              <img src={message.isBot ? gptimglogo : usericon} className='chtimg' alt=''/>
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

            {/* ⭐ file upload input */}
            <input 
              type="file"
              multiple
              accept=".pdf,.txt,image/*"
              onChange={handleFileUpload}
              style={{ marginBottom: "8px" }}
            />

            {/* ⭐ file preview */}
            {files.length > 0 && (
              <div className="file-preview">
                {files.map((file, idx) => {
                  if (file.type.startsWith("image/")) {
                    // ⭐ show image thumbnail
                    const url = URL.createObjectURL(file);
                    return <img key={idx} src={url} alt={file.name} className="file-thumb" />;
                  } else {
                    // ⭐ show icon + name for non-images
                    return <p key={idx}>📄 {file.name}</p>;
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

            {/* ⭐ send button with loading spinner */}
            <button className='send' onClick={handleSend} disabled={isSending}>
              {isSending ? (
                <div className="loader"></div> // ⭐ loading animation
              ) : (
                <img src={sendBtn} alt='send'/>
              )}
            </button>
          </div>

          <p>Warri's legal AI pipeline was created to showcase my Mern skills to recruiters.</p>
        </div>
      </div>
    </div>  
  );
}

export default App;
