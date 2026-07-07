import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Send,
  Paperclip,
  Mic,
  MicOff,
  Cpu,
  Menu,
  Zap,
  Sparkles,
  FileText,
  X,
  BookOpen,
  AlertTriangle,
  Play,
  RotateCcw,
  Volume2,
  Sliders,
  Settings,
  Terminal,
  Compass,
  CheckCircle2,
  Trash2,
  UploadCloud,
  Download,
  Phone
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import VoiceCallOverlay from "./components/VoiceCallOverlay";
import { ChatThread, Message, Attachment, RoboticsContextType, ModelModeType } from "./types";
import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  signOut,
  onAuthStateChanged,
  type User
} from "./firebase";
import LoginScreen from "./components/LoginScreen";

const LOCAL_STORAGE_KEY = "yukthish_ai_threads";

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation & UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Settings & Modes
  const [roboticsContext, setRoboticsContext] = useState<RoboticsContextType>("general");
  const [modelMode, setModelMode] = useState<ModelModeType>("fast");
  const [isLiveChat, setIsLiveChat] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);

  // Upload/Attachments State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Speech to Text (SpeechRecognition)
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Text to Speech (SpeechSynthesis)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [ttsVoice, setTtsVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [ttsRate, setTtsRate] = useState(1.0);

  // Scroll ref
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Save threads to both localStorage cache and Firestore cloud database
  const saveThreadsToStorageAndCloud = async (finalThreadsList: ChatThread[]) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalThreadsList));
    if (user) {
      try {
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, {
          threads: finalThreadsList,
          updatedAt: Date.now()
        }, { merge: true });
      } catch (e) {
        console.error("Error saving threads to Firestore:", e);
      }
    }
  };

  // Save threads to local storage
  const saveThreadsToLocalStorage = (updatedThreads: ChatThread[]) => {
    setThreads(updatedThreads);
    saveThreadsToStorageAndCloud(updatedThreads);
  };

  // Sync auth state and load user threads from Firestore
  useEffect(() => {
    const loadUserThreads = async (userId: string) => {
      try {
        const docRef = doc(db, "users", userId);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().threads) {
          const userThreads = snap.data().threads as ChatThread[];
          setThreads(userThreads);
          if (userThreads.length > 0) {
            setActiveThreadId(userThreads[0].id);
            setRoboticsContext(userThreads[0].roboticsContext || "general");
            setModelMode(userThreads[0].mode || "fast");
          } else {
            initNewThreadWithThreads([]);
          }
        } else {
          // First time login for this user, migrate local cache if exists, or start clean
          const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
          let initialThreads: ChatThread[] = [];
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (parsed && parsed.length > 0) {
                initialThreads = parsed;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }

          if (initialThreads.length === 0) {
            const newId = "thread_" + Date.now();
            const newThread: ChatThread = {
              id: newId,
              title: "New Robotics Task",
              createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              messages: [],
              roboticsContext: "general",
              mode: "fast",
            };
            initialThreads = [newThread];
          }

          // Save initial data to Firestore
          await setDoc(docRef, {
            threads: initialThreads,
            updatedAt: Date.now()
          }, { merge: true });

          setThreads(initialThreads);
          setActiveThreadId(initialThreads[0].id);
          setRoboticsContext(initialThreads[0].roboticsContext || "general");
          setModelMode(initialThreads[0].mode || "fast");
        }
      } catch (error) {
        console.error("Error fetching user data from Firestore:", error);
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setThreads(parsed);
            if (parsed.length > 0) setActiveThreadId(parsed[0].id);
          } catch (e) {}
        }
      }
    };

    let unsubscribe = () => {};

    // Check for custom persistent session first
    const localCustomUser = localStorage.getItem("yukthish_ai_custom_user");
    if (localCustomUser) {
      try {
        const parsedUser = JSON.parse(localCustomUser);
        if (parsedUser && parsedUser.uid && parsedUser.email) {
          setUser(parsedUser);

          const loadCustom = async () => {
            await loadUserThreads(parsedUser.uid);
            setAuthLoading(false);
          };
          loadCustom();
        }
      } catch (e) {
        console.error("Failed to restore custom session:", e);
      }
    } else {
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser && currentUser.emailVerified) {
          setUser(currentUser);
          await loadUserThreads(currentUser.uid);
        } else {
          setUser(null);
          setThreads([]);
          setActiveThreadId("");
        }
        setAuthLoading(false);
      });
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Initialize Speech Synthesis & Recognition on mount
  useEffect(() => {
    // Initialize Speech Synthesis Voices
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        const defaultVoice = voices.find(v => v.lang.includes("en-US") && v.name.includes("Natural")) ||
                             voices.find(v => v.lang.includes("en")) ||
                             voices[0];
        if (defaultVoice) setTtsVoice(defaultVoice);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Initialize Speech Recognition
    const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechClass) {
      const rec = new SpeechClass();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => (prev ? prev + " " + transcript : transcript));
        }
        setIsListening(false);
      };

      rec.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  const initNewThreadWithThreads = (existingThreads: ChatThread[]) => {
    const newId = "thread_" + Date.now();
    const newThread: ChatThread = {
      id: newId,
      title: "New Robotics Task",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [],
      roboticsContext: "general",
      mode: "fast",
    };
    const updated = [newThread, ...existingThreads];
    saveThreadsToLocalStorage(updated);
    setActiveThreadId(newId);
    setRoboticsContext("general");
    setModelMode("fast");
    setAttachments([]);
  };

  // Initialize a new default thread
  const initNewThread = () => {
    const newId = "thread_" + Date.now();
    const newThread: ChatThread = {
      id: newId,
      title: "New Robotics Task",
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [],
      roboticsContext: "general",
      mode: "fast",
    };
    const updated = [newThread, ...threads];
    saveThreadsToLocalStorage(updated);
    setActiveThreadId(newId);
    setRoboticsContext("general");
    setModelMode("fast");
    setAttachments([]);
  };

  // Switch Active Thread
  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    const found = threads.find(t => t.id === id);
    if (found) {
      setRoboticsContext(found.roboticsContext || "general");
      setModelMode(found.mode || "fast");
    }
    // Stop speaking when switching threads
    handleStopSpeaking();
    setAttachments([]);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  // Delete Thread
  const handleDeleteThread = (id: string) => {
    const filtered = threads.filter((t) => t.id !== id);
    if (filtered.length === 0) {
      // Create new clean state if no threads left
      const newId = "thread_" + Date.now();
      const newThread: ChatThread = {
        id: newId,
        title: "New Robotics Task",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        messages: [],
        roboticsContext: "general",
        mode: "fast",
      };
      saveThreadsToLocalStorage([newThread]);
      setActiveThreadId(newId);
    } else {
      saveThreadsToLocalStorage(filtered);
      if (activeThreadId === id) {
        setActiveThreadId(filtered[0].id);
      }
    }
    handleStopSpeaking();
  };

  // Rename Thread Title
  const handleRenameThread = (id: string, newTitle: string) => {
    const updated = threads.map((t) => (t.id === id ? { ...t, title: newTitle } : t));
    saveThreadsToLocalStorage(updated);
  };

  // Add voice call message to active thread
  const handleAddVoiceMessage = (role: "user" | "assistant", text: string) => {
    setThreads((prevThreads) => {
      const updated = prevThreads.map((t) => {
        if (t.id === activeThreadId) {
          const newMsg: Message = {
            id: `msg_voice_${role}_` + Date.now() + "_" + Math.floor(Math.random() * 1000),
            role,
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            mode: modelMode,
            roboticsContext,
          };

          let threadTitle = t.title;
          if (t.messages.length === 0 && role === "user") {
            threadTitle = text.length > 28 ? text.substring(0, 26) + "..." : text;
          }

          return {
            ...t,
            title: threadTitle,
            messages: [...t.messages, newMsg]
          };
        }
        return t;
      });
      saveThreadsToStorageAndCloud(updated);
      return updated;
    });
  };

  // Clear All History
  const handleClearAllHistory = () => {
    if (window.confirm("Are you absolutely sure you want to clear all chat history and telemetry logs? This action cannot be undone.")) {
      const newId = "thread_" + Date.now();
      const newThread: ChatThread = {
        id: newId,
        title: "New Robotics Task",
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        messages: [],
        roboticsContext: "general",
        mode: "fast",
      };
      saveThreadsToLocalStorage([newThread]);
      setActiveThreadId(newId);
      setRoboticsContext("general");
      setModelMode("fast");
      setAttachments([]);
      handleStopSpeaking();
    }
  };

  // Convert thread to a downloadable HTML file
  const downloadChatAsHTML = () => {
    const thread = threads.find((t) => t.id === activeThreadId) || threads[0];
    if (!thread) {
      alert("No active log to export.");
      return;
    }

    const messagesHTML = thread.messages.map((m) => {
      const isAssistant = m.role === "assistant";

      // Escape HTML helper
      const escapeHtml = (text: string) => {
        return text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      };

      // Simple markdown parser for static output
      let formattedText = escapeHtml(m.text);

      // Code blocks formatter (```language ... ```)
      formattedText = formattedText.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<div class="my-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          <div class="flex items-center justify-between bg-slate-900 px-4 py-1.5 text-[10px] font-mono text-slate-400">
            <span>${lang || 'code'}</span>
            <span>Read-Only</span>
          </div>
          <pre class="p-4 overflow-x-auto text-xs text-cyan-300 font-mono"><code class="block whitespace-pre">${code.trim()}</code></pre>
        </div>`;
      });

      // Inline code formatter (`code`)
      formattedText = formattedText.replace(/`([^`]+)`/g, '<code class="bg-slate-950 text-cyan-400 px-1.5 py-0.5 rounded font-mono text-xs border border-slate-800/60">$1</code>');

      // Bold formatter (**bold**)
      formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');

      // Paragraph splitter
      formattedText = formattedText.split('\n\n').map(p => {
        const trimmed = p.trim();
        if (trimmed.startsWith('<div') || trimmed.startsWith('<pre') || trimmed.startsWith('<li')) {
          return trimmed;
        }
        return `<p class="my-2 leading-relaxed text-slate-300">${trimmed}</p>`;
      }).join('\n');

      return `
        <div class="p-6 border-b border-slate-800/40 ${isAssistant ? 'bg-slate-900/10' : 'bg-[#0a0d16]/10'}">
          <div class="max-w-4xl mx-auto">
            <div class="flex items-center gap-2 mb-2 text-xs text-slate-500 select-none">
              <span class="font-bold tracking-wider text-slate-400 uppercase">
                ${isAssistant ? 'Yukthi.AI' : 'Developer'}
              </span>
              <span>•</span>
              <span>${m.timestamp || new Date().toLocaleTimeString()}</span>
              ${m.mode ? `
                <span>•</span>
                <span class="px-1.5 py-0.5 rounded uppercase font-bold text-[9px] font-mono bg-cyan-500/10 text-cyan-400">
                  ${m.mode === "fast" ? "Flash AI" : "Detailed AI"}
                </span>
              ` : ''}
            </div>
            <div class="mt-2 text-slate-200">
              ${formattedText}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Yukthi.AI - ${thread.title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #070913;
    }
    code, pre {
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen flex flex-col antialiased">
  <!-- Top Navigation -->
  <header class="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-800 bg-[#0a0d16]/90 backdrop-blur px-6">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/10">
        <div class="flex h-full w-full items-center justify-center rounded-xl bg-[#0d111d]">
          <svg class="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
          </svg>
        </div>
      </div>
      <div>
        <h1 class="text-sm font-bold text-white tracking-tight">Yukthi.AI</h1>
        <p class="text-[10px] text-cyan-400 font-mono font-medium tracking-widest uppercase">Robotics Core Export</p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button onclick="window.print()" class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-all">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
        </svg>
        <span>Print / Save to PDF</span>
      </button>
    </div>
  </header>

  <!-- Title Section -->
  <section class="border-b border-slate-800/60 bg-[#0d111d] py-12 px-6">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center gap-2 text-xs text-slate-500 font-mono mb-2 uppercase tracking-wider">
        <span>Log Export</span>
        <span>•</span>
        <span>${thread.createdAt || 'Standard Time'}</span>
        <span>•</span>
        <span>${thread.roboticsContext || 'general'} context</span>
      </div>
      <h2 class="text-3xl font-extrabold tracking-tight text-white">${thread.title}</h2>
      <p class="mt-2 text-slate-400 text-sm">Archived conversation with Yukthi.AI specialized robotics co-pilot.</p>
    </div>
  </section>

  <!-- Messages Content -->
  <main class="flex-1 bg-[#0d111d]/50">
    ${messagesHTML || `
      <div class="flex flex-col items-center justify-center py-20 px-4 text-center">
        <svg class="h-12 w-12 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
        </svg>
        <p class="text-slate-400 font-medium">No messages in this chat thread log.</p>
      </div>
    `}
  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800/60 bg-[#0a0d16] py-6 px-6 text-center text-xs text-slate-500 font-mono">
    <p>© ${new Date().getFullYear()} Yukthi.AI Robotics Core System. All rights reserved.</p>
  </footer>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeTitle = thread.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    link.download = `yukthi-ai-chat-${safeTitle || 'export'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auto scroll to chat bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  // Handle Speech-To-Text toggling
  const handleToggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported or permitted in this browser configuration.");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      setIsListening(true);
      recognition.start();
    }
  };

  // Handle Speech Synthesis Speak
  const handleSpeak = (messageId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser environment.");
      return;
    }

    // Stop current synthesis
    window.speechSynthesis.cancel();

    // Clean text of markdown backticks / markdown formatting to sound natural
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "[Code block omitted]")
      .replace(/\*\*|__/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*#\-]/g, "");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (ttsVoice) {
      utterance.voice = ttsVoice;
    }
    utterance.pitch = ttsPitch;
    utterance.rate = ttsRate;

    utterance.onend = () => {
      setSpeakingMsgId(null);
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setSpeakingMsgId(null);
    };

    setSpeakingMsgId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  // Stop synthesis speaking
  const handleStopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
  };

  // Drag and Drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // File Upload Handling
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
    }
  };

  const handleFilesSelected = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();

      // Check if file is image or text/code
      const isImg = file.type.startsWith("image/");
      const isText = file.type.startsWith("text/") ||
                     file.name.endsWith(".json") ||
                     file.name.endsWith(".py") ||
                     file.name.endsWith(".cpp") ||
                     file.name.endsWith(".h") ||
                     file.name.endsWith(".ino") ||
                     file.name.endsWith(".urdf") ||
                     file.name.endsWith(".yaml") ||
                     file.name.endsWith(".launch");

      if (isImg) {
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const newAtt: Attachment = {
            id: "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
            name: file.name,
            type: file.type,
            size: file.size,
            base64Data,
          };
          setAttachments((prev) => [...prev, newAtt]);
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        reader.onloadend = () => {
          const textContent = reader.result as string;
          // Determine generic extension for language helper
          let language = "text";
          if (file.name.endsWith(".py")) language = "python";
          else if (file.name.endsWith(".cpp") || file.name.endsWith(".h") || file.name.endsWith(".ino")) language = "cpp";
          else if (file.name.endsWith(".urdf") || file.name.endsWith(".xml")) language = "xml";
          else if (file.name.endsWith(".json")) language = "json";
          else if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) language = "yaml";

          const newAtt: Attachment = {
            id: "att_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
            name: file.name,
            type: file.type || "text/plain",
            size: file.size,
            base64Data: "",
            textContent,
            language
          };
          setAttachments((prev) => [...prev, newAtt]);
        };
        reader.readAsText(file);
      } else {
        alert(`File format of '${file.name}' is not supported. Please upload images or code/text configurations.`);
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  // Submit Prompt to Server / Stream Response
  const handleSubmit = async (e?: React.FormEvent, presetPrompt?: string) => {
    if (e) e.preventDefault();

    const promptToSend = presetPrompt || inputText;
    if (!promptToSend.trim() && attachments.length === 0) return;

    // Reset input fields
    setInputText("");
    const attachmentsToSubmit = [...attachments];
    setAttachments([]);

    // Get current thread
    const currentThread = threads.find((t) => t.id === activeThreadId);
    if (!currentThread) return;

    // 1. Create and append User Message
    const userMsg: Message = {
      id: "msg_user_" + Date.now(),
      role: "user",
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments: attachmentsToSubmit,
      mode: modelMode,
      roboticsContext,
    };

    const updatedMessages = [...currentThread.messages, userMsg];

    // Auto rename empty title thread on first user message
    let threadTitle = currentThread.title;
    if (currentThread.messages.length === 0) {
      threadTitle = promptToSend.length > 28 ? promptToSend.substring(0, 26) + "..." : promptToSend;
    }

    const updatedThread: ChatThread = {
      ...currentThread,
      title: threadTitle,
      messages: updatedMessages,
      roboticsContext,
      mode: modelMode,
    };

    const updatedThreadsList = threads.map((t) => (t.id === activeThreadId ? updatedThread : t));
    saveThreadsToLocalStorage(updatedThreadsList);

    setIsLoading(true);
    scrollToBottom();

    // 2. Formulate Assistant Placeholder Message in state
    const assistantMsgId = "msg_ast_" + Date.now();
    let responseText = "";

    try {
      // Call Server Streaming endpoint
      const endpoint = isLiveChat ? "/api/chat/live" : "/api/chat/stream";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages,
          mode: modelMode,
          roboticsContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) {
        throw new Error("Could not initialize text decoder / reader stream.");
      }

      // Initialize the assistant message placeholder
      const initialAssistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        text: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setThreads((prevThreads) =>
        prevThreads.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [...updatedMessages, initialAssistantMsg]
            };
          }
          return t;
        })
      );

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");

        // Save last line fragment if incomplete
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                responseText += `\n**[Error from Engine: ${data.error}]**`;
              } else if (data.text) {
                responseText += data.text;
              }

              // Realtime throttle state update
              setThreads((prevThreads) =>
                prevThreads.map((t) => {
                  if (t.id === activeThreadId) {
                    return {
                      ...t,
                      messages: t.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, text: responseText } : m
                      )
                    };
                  }
                  return t;
                })
              );
            } catch (e) {
              // Ignore line fragment JSON errors
            }
          }
        }
      }

      // Final complete save using functional update to prevent stale closures
      setThreads((prevThreads) => {
        const finalThreadsList = prevThreads.map((t) => {
          if (t.id === activeThreadId) {
            const finalMessages = t.messages.map((m) =>
              m.id === assistantMsgId ? { ...m, text: responseText || "Engine completed empty run." } : m
            );
            return {
              ...t,
              title: threadTitle,
              messages: finalMessages,
            };
          }
          return t;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalThreadsList));
        saveThreadsToStorageAndCloud(finalThreadsList);
        return finalThreadsList;
      });

    } catch (err: any) {
      console.error("Streaming submit error:", err);
      // Append static error message if failed
      const errorAssistantMsg: Message = {
        id: "msg_ast_err_" + Date.now(),
        role: "assistant",
        text: `### System Alert: Critical Engine Fault\n\nFailed to establish continuous stream connection.\n\n* **Details**: ${err.message || "Generic networking or API block."}\n* **Diagnostics Checklist**:\n  1. Ensure your telemetry channel credentials are valid.\n  2. Check if the maximum rate of telemetry operations per minute has been exceeded.\n  3. Verify the platform system health is optimal and try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setThreads((prevThreads) => {
        const withErrorList = prevThreads.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [...updatedMessages, errorAssistantMsg]
            };
          }
          return t;
        });
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(withErrorList));
        saveThreadsToStorageAndCloud(withErrorList);
        return withErrorList;
      });
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("yukthish_ai_custom_user");
      await signOut(auth);
      setUser(null);
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen bg-[#070913] items-center justify-center text-slate-100 flex-col gap-4">
        <div className="absolute inset-0 cyber-grid opacity-15"></div>
        <div className="h-12 w-12 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2 animate-spin">
          <Cpu className="h-6 w-6 text-cyan-400" />
        </div>
        <p className="text-xs font-mono text-cyan-400 tracking-widest uppercase animate-pulse">Initializing Yukthi Core OS...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#070913] text-slate-100 overflow-hidden font-sans select-none">

      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar component wrapper */}
      <Sidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={initNewThread}
        onDeleteThread={handleDeleteThread}
        onRenameThread={handleRenameThread}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        onClearAllHistory={handleClearAllHistory}
        onDownloadHTML={downloadChatAsHTML}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Main Workspace Frame */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex-1 flex flex-col h-full overflow-hidden relative"
      >

        {/* Drag and Drop Overlay Mask */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#0d111d]/90 backdrop-blur-sm z-40 flex flex-col items-center justify-center border-4 border-dashed border-cyan-500/50 m-4 rounded-3xl animate-pulse">
            <UploadCloud className="h-16 w-16 text-cyan-400 mb-4" />
            <p className="text-xl font-bold text-white">Drop Files for Robotics Compiler</p>
            <p className="text-sm text-slate-400 mt-1">Accepts schemas, parameters, code (.ino, .py, .cpp, .urdf) and images</p>
          </div>
        )}

        {/* Global Nav Bar / Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-800/60 bg-[#0a0d16] px-4 md:px-6 z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-xl p-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-all mr-1"
                title="Open system logs"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <span className="font-bold text-slate-200 tracking-wide">Yukthi.AI</span>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* Live Chat Button */}
            <button
              onClick={() => setIsLiveChat(!isLiveChat)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 md:px-3 py-2 text-xs font-bold transition-all shadow-md ${
                isLiveChat
                  ? "border-green-500/50 bg-green-500/20 text-white shadow-green-500/20"
                  : "border-green-500/20 bg-green-950/10 text-green-400 hover:text-white hover:bg-green-500/20 shadow-green-500/5"
              }`}
              title="Live Search Grounding with Gemini 2.0 Flash-Lite"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Live Chat {isLiveChat ? "(On)" : "(Off)"}</span>
            </button>

            {/* Premium Voice-to-Voice Call Button */}
            <button
              onClick={() => setIsCallActive(true)}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-950/10 px-2.5 md:px-3 py-2 text-xs font-bold text-cyan-400 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all shadow-md shadow-cyan-500/5"
              title="Start Live Voice Call (Talk like a friend)"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Voice Call</span>
            </button>

            {/* Settings Launcher */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="System & Voice Settings"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Floating Active Specialized Indicator */}
        {roboticsContext !== "general" && (
          <div className="bg-cyan-500/10 border-b border-cyan-500/20 px-6 py-1.5 flex items-center gap-2 text-[10.5px] font-semibold text-cyan-300 tracking-wide select-none z-10">
            <Cpu className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
            <span>
              Specialized robotics filters are active for:
              <strong className="uppercase ml-1 bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-800/40 text-cyan-100">{roboticsContext}</strong>.
            </span>
          </div>
        )}

        {/* Chat Scrollable Area */}
        <ChatArea
          messages={activeThread?.messages || []}
          isLoading={isLoading}
          onSendPreset={(prompt) => handleSubmit(undefined, prompt)}
          speakingMsgId={speakingMsgId}
          onSpeak={handleSpeak}
          onStopSpeaking={handleStopSpeaking}
        />
        <div ref={chatBottomRef} />

        {/* Absolute Input Control Panel Footer */}
        <footer className="border-t border-slate-800/60 bg-[#0a0d16]/95 backdrop-blur px-4 py-4 md:px-8 z-10 select-none">
          <form onSubmit={handleSubmit} className="mx-auto max-w-4xl flex flex-col gap-3">

            {/* Speech Soundwave visualizer active */}
            {speakingMsgId && (
              <div className="flex items-center justify-between bg-cyan-950/15 border border-cyan-500/15 rounded-2xl px-4 py-3 animate-pulse shadow-inner">
                <div className="flex items-center gap-3">
                  <div className="flex items-end gap-[3px] h-6 w-10">
                    <div className="w-[3px] bg-cyan-400 rounded-full soundwave-bar-1"></div>
                    <div className="w-[3px] bg-cyan-400 rounded-full soundwave-bar-2"></div>
                    <div className="w-[3px] bg-cyan-400 rounded-full soundwave-bar-3"></div>
                    <div className="w-[3px] bg-cyan-400 rounded-full soundwave-bar-4"></div>
                    <div className="w-[3px] bg-cyan-400 rounded-full soundwave-bar-5"></div>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-cyan-400 font-mono uppercase tracking-wider">Yukthi Synthesis Active</span>
                    <p className="text-[9.5px] text-slate-400 leading-none">Vocalizing robotics analysis model...</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleStopSpeaking}
                  className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-500/20 transition-all uppercase tracking-wide"
                >
                  Stop Audio
                </button>
              </div>
            )}

            {/* Attachment Chips Display */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 max-h-32 overflow-y-auto custom-scrollbar">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 p-1.5 hover:border-slate-700 transition-all select-none"
                  >
                    {att.type.startsWith("image/") ? (
                      <img
                        src={att.base64Data}
                        alt={att.name}
                        className="h-7 w-7 rounded object-cover bg-slate-950"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-slate-950 text-cyan-400">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="min-w-0 pr-1">
                      <p className="text-[10px] font-medium text-slate-300 truncate max-w-[120px]">{att.name}</p>
                      <p className="text-[8px] text-slate-500 font-mono">{(att.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      className="rounded hover:bg-slate-800 text-slate-500 hover:text-white p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input Row Box */}
            <div className="relative flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-1.5 focus-within:border-cyan-500/60 focus-within:ring-2 focus-within:ring-cyan-500/10 transition-all duration-300 shadow-xl shadow-black/45">

              {/* Attachment Clip Button */}
              <button
                type="button"
                onClick={triggerFileSelect}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Upload Robotics Files/Images"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept="image/*,text/*,.json,.py,.cpp,.h,.ino,.urdf,.yaml,.launch"
                className="hidden"
              />

              {/* Main Prompt Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  roboticsContext === "ros" ? "Ask about ROS 2 topics, publishers, launch files..." :
                  roboticsContext === "arduino" ? "Query register drivers, hardware PWM or timers..." :
                  roboticsContext === "kinematics" ? "Solve jacobians, forward/inverse kinematic solvers..." :
                  roboticsContext === "simulation" ? "Generate URDF configurations or physics solver constants..." :
                  "Ask Yukthi.AI anything about Robotics..."
                }
                disabled={isLoading}
                className="flex-1 bg-transparent px-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-0"
              />

              {/* Speech-to-Text Recording Button */}
              <button
                type="button"
                onClick={handleToggleListening}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all relative ${
                  isListening
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
                title={isListening ? "Listening... Click to stop" : "Use microphone / Speech-To-Text"}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5 text-rose-400 animate-pulse" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                    </span>
                  </>
                ) : (
                  <Mic className="h-5 w-5" />
                )}
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white shadow-md shadow-cyan-950/40 hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all"
                title="Send task"
              >
                <Send className="h-4 w-4 rotate-0" />
              </button>
            </div>

            {/* Premium Robotics Diagnostics Ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 text-[10px] text-slate-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-slate-600 animate-pulse" />
                  Context: <strong className="font-mono text-cyan-400 uppercase tracking-wide">{roboticsContext}</strong>
                </span>
                <span className="hidden sm:inline text-slate-700">|</span>
                <span className="hidden sm:flex items-center gap-1">
                  Engine: <span className="text-slate-400 font-mono">{modelMode === "fast" ? "Yukthi Core" : "Yukthi Ultra"}</span>
                </span>
                <span className="hidden md:inline text-slate-700">|</span>
                <span className="hidden md:flex items-center gap-1">
                  Latency: <span className="text-slate-400 font-mono">{modelMode === "fast" ? "< 0.3s" : "Deep reasoning"}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                <span>Diagnostics: <span className="font-mono text-emerald-400 font-bold uppercase">Optimal</span></span>
              </div>
            </div>
          </form>
        </footer>
      </div>

      {/* Voice & Speech synthesis settings overlay modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm select-none">
          <div className="w-full max-w-md bg-slate-950 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/40 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-center gap-2.5 text-white">
                <Settings className="h-4.5 w-4.5 text-cyan-400" />
                <span className="font-bold text-sm tracking-wide">System & Voice Settings</span>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Content inputs */}
            <div className="p-5 space-y-6">

              {/* Core Processing Presets */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-slate-500" />
                  Engine Speed & Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setModelMode("fast")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 transition-all ${
                      modelMode === "fast"
                        ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-sm shadow-cyan-950/20"
                        : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    <span className="text-xs font-bold">Standard Core</span>
                  </button>
                  <button
                    onClick={() => setModelMode("detailed")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 transition-all ${
                      modelMode === "detailed"
                        ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-sm shadow-indigo-950/20"
                        : "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-900"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-bold">Advanced Core</span>
                  </button>
                </div>
              </div>

              {/* Context Switcher */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-slate-500" />
                  Robotics Specialization Context
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["general", "ros", "arduino", "kinematics", "simulation"] as RoboticsContextType[]).map((ctx) => (
                    <button
                      key={ctx}
                      onClick={() => setRoboticsContext(ctx)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all border ${
                        roboticsContext === ctx
                          ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-950/20"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {ctx === "ros" ? "ROS 2" : ctx === "arduino" ? "MCU" : ctx}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Changes the AI's system prompt to focus on specific domains.</p>
              </div>

              <div className="h-px bg-slate-800/80 w-full" />

              {/* Voice select list */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                  Output Synth Voice
                </label>
                <select
                  value={ttsVoice?.name || ""}
                  onChange={(e) => {
                    const selected = availableVoices.find(v => v.name === e.target.value);
                    if (selected) setTtsVoice(selected);
                  }}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 text-xs px-3.5 py-2.5 text-slate-300 focus:border-cyan-500/50 outline-none"
                >
                  {availableVoices.length === 0 ? (
                    <option>No browser synthesizer voices available</option>
                  ) : (
                    availableVoices.map((voice, idx) => (
                      <option key={idx} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Pitch Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-slate-400">Voice Pitch</span>
                  <span className="text-cyan-400 font-mono">{ttsPitch.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={ttsPitch}
                  onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-900 rounded-lg appearance-none"
                />
              </div>

              {/* Speed / Rate Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-slate-400">Synthesis Speed Rate</span>
                  <span className="text-cyan-400 font-mono">{ttsRate.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-900 rounded-lg appearance-none"
                />
              </div>

              {/* Info panel */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-3.5 flex items-start gap-2.5 text-[11px] leading-relaxed text-slate-400">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200">Browser Audio Permissions:</span>
                  {' '}Ensure your microphone permissions are allowed in the browser settings and that active playback is not muted on your host OS.
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 bg-slate-950 border-t border-slate-800 flex justify-end sticky bottom-0 z-10">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 hover:brightness-115 px-4 py-2 text-xs font-semibold text-white transition-all shadow-md shadow-cyan-950/20"
              >
                Apply Profile & Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Call Overlay Component */}
      <VoiceCallOverlay
        isOpen={isCallActive}
        onClose={() => setIsCallActive(false)}
        roboticsContext={roboticsContext}
        modelMode={modelMode}
        ttsVoice={ttsVoice}
        ttsPitch={ttsPitch}
        ttsRate={ttsRate}
        activeThreadId={activeThreadId}
        threads={threads}
        onAddMessage={handleAddVoiceMessage}
      />

    </div>
  );
}
