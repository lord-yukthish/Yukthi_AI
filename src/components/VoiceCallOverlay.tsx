import React, { useState, useEffect, useRef } from "react";
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Cpu,
  Sparkles,
  Loader2,
  Radio,
  ArrowRight
} from "lucide-react";

interface VoiceCallOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  roboticsContext: string;
  modelMode: string;
  ttsVoice: SpeechSynthesisVoice | null;
  ttsPitch: number;
  ttsRate: number;
  activeThreadId: string;
  threads: any[];
  onAddMessage: (role: "user" | "assistant", text: string) => void;
}

type CallState = "connecting" | "listening" | "thinking" | "speaking" | "muted" | "ended";

export default function VoiceCallOverlay({
  isOpen,
  onClose,
  roboticsContext,
  modelMode,
  ttsVoice,
  ttsPitch,
  ttsRate,
  activeThreadId,
  threads,
  onAddMessage
}: VoiceCallOverlayProps) {
  const [callState, setCallState] = useState<CallState>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [aiResponseText, setAiResponseText] = useState("");
  const [connectionTime, setConnectionTime] = useState("00:00");

  const recognitionRef = useRef<any>(null);
  const speechTimeoutRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<any>(null);
  const secondsRef = useRef(0);
  const isCallActiveRef = useRef(false);

  // Connection timer
  useEffect(() => {
    if (isOpen) {
      isCallActiveRef.current = true;
      secondsRef.current = 0;
      setConnectionTime("00:00");
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        const mins = Math.floor(secondsRef.current / 60).toString().padStart(2, "0");
        const secs = (secondsRef.current % 60).toString().padStart(2, "0");
        setConnectionTime(`${mins}:${secs}`);
      }, 1000);
    } else {
      isCallActiveRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen]);

  // Audio Loop Initiation
  useEffect(() => {
    if (!isOpen) return;

    // Initialize speech synthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Initialize speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => {
        if (isMuted) {
          setCallState("muted");
        } else {
          setCallState("listening");
        }
      };

      rec.onresult = async (event: any) => {
        const text = event.results[0][0].transcript;
        if (text && text.trim()) {
          setUserTranscript(text);
          await handleProcessVoiceQuery(text);
        } else {
          // Restart listening if speech was empty
          restartListeningGracefully();
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech recognition error in call overlay:", event.error);
        if (event.error === "no-speech") {
          // Just resume listening
          restartListeningGracefully();
        } else {
          // For other errors, restart listening after a brief delay
          restartListeningGracefully();
        }
      };

      rec.onend = () => {
        // Only restart if call is active and we are still in listening state (e.g. timeout without speech)
        if (isCallActiveRef.current && !activeUtteranceRef.current && (callState === "listening" || callState === "connecting")) {
          restartListeningGracefully();
        }
      };

      recognitionRef.current = rec;
    } else {
      console.error("SpeechRecognition is not supported in this browser.");
    }

    // Play welcome greeting
    speakGreeting();

    return () => {
      isCallActiveRef.current = false;
      stopAllAudioAndSpeech();
    };
  }, [isOpen]);

  // Handle Mute toggle
  useEffect(() => {
    if (!isOpen) return;
    if (isMuted) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setCallState("muted");
    } else {
      if (callState === "muted") {
        restartListeningGracefully();
      }
    }
  }, [isMuted]);

  const stopAllAudioAndSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    activeUtteranceRef.current = null;
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
  };

  const speakGreeting = () => {
    const greetings = [
      "Yukthi core live connection online. How can I assist you with your robotics development today?",
      "Live connection established. Go ahead, I am listening.",
      "Live robotics advisor activated. What system are we debugging today?"
    ];
    const greetingText = greetings[Math.floor(Math.random() * greetings.length)];
    setAiResponseText(greetingText);
    speakResponse(greetingText);
  };

  const speakResponse = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setCallState("listening");
      return;
    }

    stopAllAudioAndSpeech();
    setCallState("speaking");

    // Clear code blocks or markdown backticks for friendly voice synthesis
    const voiceFriendlyText = text
      .replace(/```[\s\S]*?```/g, "[Code block omitted for brevity]")
      .replace(/\*\*|__/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*#\-]/g, "");

    const utterance = new SpeechSynthesisUtterance(voiceFriendlyText);
    if (ttsVoice) {
      utterance.voice = ttsVoice;
    }
    utterance.pitch = ttsPitch;
    utterance.rate = ttsRate;

    utterance.onend = () => {
      activeUtteranceRef.current = null;
      if (isCallActiveRef.current && !isMuted) {
        setCallState("listening");
        startListeningGracefully();
      } else if (isMuted) {
        setCallState("muted");
      }
    };

    utterance.onerror = (e) => {
      console.error("Call voice synthesis error:", e);
      activeUtteranceRef.current = null;
      if (isCallActiveRef.current && !isMuted) {
        setCallState("listening");
        startListeningGracefully();
      }
    };

    activeUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const startListeningGracefully = () => {
    if (isMuted || !isCallActiveRef.current) return;
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {
      // Already running or failed to start, ignore
    }
  };

  const restartListeningGracefully = () => {
    if (!isCallActiveRef.current || isMuted) return;
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);

    speechTimeoutRef.current = setTimeout(() => {
      if (isCallActiveRef.current && !activeUtteranceRef.current && !isMuted) {
        try {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        } catch (e) {}
        setTimeout(() => {
          if (isCallActiveRef.current && !activeUtteranceRef.current && !isMuted) {
            startListeningGracefully();
          }
        }, 150);
      }
    }, 400);
  };

  const handleProcessVoiceQuery = async (query: string) => {
    if (!isCallActiveRef.current) return;

    stopAllAudioAndSpeech();
    setCallState("thinking");

    // Sync user message to active thread
    onAddMessage("user", query);

    try {
      // Fetch thread messages from current active thread to preserve context
      const thread = threads.find((t) => t.id === activeThreadId);
      const messagesWithNewUser = thread ? [...thread.messages, {
        id: "msg_voice_temp_user_" + Date.now(),
        role: "user",
        text: query,
        timestamp: new Date().toLocaleTimeString()
      }] : [{
        id: "msg_voice_temp_user_" + Date.now(),
        role: "user",
        text: query,
        timestamp: new Date().toLocaleTimeString()
      }];

      // Call streaming API but consume it completely for the final response text
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messagesWithNewUser,
          mode: modelMode,
          roboticsContext,
        }),
      });

      if (!response.ok) {
        throw new Error(`Voice channel error status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      if (!reader) throw new Error("Voice stream closed early.");

      let textBuffer = "";
      let completeResponse = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });
        const lines = textBuffer.split("\n");
        textBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                completeResponse += data.text;
              }
            } catch (e) {}
          }
        }
      }

      if (!isCallActiveRef.current) return;

      const finalReply = completeResponse || "Yukthi was unable to compute a response. Please try speaking again.";
      setAiResponseText(finalReply);

      // Sync assistant response to active thread
      onAddMessage("assistant", finalReply);

      // Speak response to user
      speakResponse(finalReply);

    } catch (err: any) {
      console.error("Call processing error:", err);
      if (isCallActiveRef.current) {
        const errorReply = "Core telemetry timeout. Please check your system configuration.";
        setAiResponseText(errorReply);
        onAddMessage("assistant", errorReply);
        speakResponse(errorReply);
      }
    }
  };

  const handleHangup = () => {
    isCallActiveRef.current = false;
    setCallState("ended");
    stopAllAudioAndSpeech();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-between bg-[#04060c] text-white overflow-hidden select-none">
      {/* Background Holographic Glows */}
      <div className="absolute inset-0 bg-radial-gradient from-cyan-950/20 via-[#04060c] to-[#04060c] opacity-80 pointer-events-none" />
      <div className="absolute -top-[40%] left-[10%] h-[70vw] w-[70vw] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-[40%] right-[10%] h-[70vw] w-[70vw] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none animate-pulse [animation-delay:2s]" />

      {/* Cybernetic Tech Grid */}
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />

      {/* Call Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-slate-900/60 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#090d16]">
              <Cpu className="h-5 w-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              Yukthi Voice Channel
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h1>
            <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Live Voice Session</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 rounded-full bg-slate-900/80 border border-slate-800/80 px-3.5 py-1.5 font-mono text-xs font-semibold text-slate-300">
            <Radio className="h-3 w-3 text-cyan-400 animate-pulse" />
            <span>{connectionTime}</span>
          </div>
        </div>
      </header>

      {/* Main Holographic Call Ring / Pulse Screen */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">

        {/* Animated Soundwave Rings */}
        <div className="relative flex items-center justify-center h-64 w-64 md:h-80 md:w-80">

          {/* Concentric pulsing backdrops */}
          <div className={`absolute inset-0 rounded-full border border-cyan-500/10 transition-all duration-1000 ${
            callState === "listening" ? "scale-105 opacity-100 bg-cyan-500/[0.01]" :
            callState === "speaking" ? "scale-110 opacity-100 bg-indigo-500/[0.01]" :
            callState === "thinking" ? "scale-95 opacity-50 bg-purple-500/[0.01]" : "scale-75 opacity-0"
          }`} />
          <div className={`absolute inset-4 rounded-full border border-cyan-500/15 transition-all duration-700 ${
            callState === "listening" ? "scale-110 opacity-100 bg-cyan-500/[0.02] animate-ping" :
            callState === "speaking" ? "scale-105 opacity-100 bg-indigo-500/[0.02]" :
            callState === "thinking" ? "scale-100 opacity-60 bg-purple-500/[0.02]" : "scale-75 opacity-0"
          }`} />
          <div className={`absolute inset-8 rounded-full border border-cyan-500/20 transition-all duration-500 ${
            callState === "listening" ? "scale-100 opacity-100" :
            callState === "speaking" ? "scale-115 opacity-100 animate-pulse" :
            callState === "thinking" ? "scale-90 opacity-75" : "scale-75 opacity-0"
          }`} />

          {/* Central Active Holographic Sphere */}
          <div className={`absolute h-40 w-40 md:h-48 md:w-48 rounded-full p-1.5 transition-all duration-500 flex items-center justify-center shadow-2xl ${
            callState === "listening" ? "bg-gradient-to-tr from-cyan-600 via-cyan-500 to-teal-400 shadow-cyan-500/20" :
            callState === "speaking" ? "bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-500 shadow-indigo-500/20" :
            callState === "thinking" ? "bg-gradient-to-tr from-purple-600 via-violet-500 to-fuchsia-500 shadow-purple-500/20 animate-spin" :
            callState === "muted" ? "bg-slate-800 border border-slate-700 shadow-black/40" :
            "bg-slate-900 border border-slate-800"
          }`}>
            <div className="h-full w-full rounded-full bg-[#070914] flex flex-col items-center justify-center relative overflow-hidden group">

              {/* Spinning/pulsing interior glow */}
              <div className={`absolute inset-0 bg-radial-gradient from-cyan-500/20 to-transparent transition-opacity duration-500 ${
                callState === "listening" ? "opacity-100" : "opacity-0"
              }`} />
              <div className={`absolute inset-0 bg-radial-gradient from-indigo-500/20 to-transparent transition-opacity duration-500 ${
                callState === "speaking" ? "opacity-100" : "opacity-0"
              }`} />

              {/* Status Graphic/Icon inside Sphere */}
              {callState === "listening" && <Mic className="h-10 w-10 md:h-12 md:w-12 text-cyan-400 animate-pulse relative z-10" />}
              {callState === "speaking" && <Volume2 className="h-10 w-10 md:h-12 md:w-12 text-indigo-400 animate-bounce relative z-10" />}
              {callState === "thinking" && <Loader2 className="h-10 w-10 md:h-12 md:w-12 text-purple-400 animate-spin relative z-10" />}
              {callState === "muted" && <MicOff className="h-10 w-10 md:h-12 md:w-12 text-rose-400 relative z-10" />}
              {callState === "connecting" && <Loader2 className="h-10 w-10 md:h-12 md:w-12 text-cyan-500 animate-spin relative z-10" />}
            </div>
          </div>
        </div>

        {/* Current Connection Status */}
        <div className="mt-8 text-center">
          <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Current Channel State</div>
          <div className={`text-xl font-black tracking-tight mt-1 transition-all ${
            callState === "listening" ? "text-cyan-400" :
            callState === "speaking" ? "text-indigo-400" :
            callState === "thinking" ? "text-purple-400" :
            callState === "muted" ? "text-rose-400" :
            "text-slate-400"
          }`}>
            {callState === "connecting" && "ESTABLISHING CRYPTO LINK..."}
            {callState === "listening" && "YUKTHI IS LISTENING..."}
            {callState === "speaking" && "YUKTHI IS TALKING..."}
            {callState === "thinking" && "CORE PROCESSOR THINKING..."}
            {callState === "muted" && "MICROPHONE MUTED"}
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto h-5">
            {callState === "listening" && "Go ahead, talk freely..."}
            {callState === "speaking" && "Vocalizing solution core..."}
            {callState === "thinking" && "Querying robotics diagnostics..."}
            {callState === "muted" && "Tap Unmute Mic to talk again"}
          </p>
        </div>

        {/* Live Conversation Transcript Panel */}
        <div className="w-full max-w-2xl mt-12 bg-slate-950/60 border border-slate-900/80 rounded-2xl p-5 shadow-inner backdrop-blur-sm relative overflow-hidden group/trans">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />

          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase mb-3.5 tracking-wider flex items-center gap-1.5 select-none">
            <Radio className="h-3 w-3 text-cyan-400/80" />
            <span>Telemetry Subtitles</span>
          </div>

          <div className="space-y-4 max-h-40 overflow-y-auto custom-scrollbar text-sm pr-1">
            {/* User Transcript Line */}
            {userTranscript && (
              <div className="flex gap-2 items-start text-slate-300">
                <span className="font-mono text-[10px] font-bold text-cyan-500/70 bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-500/10 uppercase select-none mt-0.5">DEV</span>
                <span className="leading-relaxed font-medium">{userTranscript}</span>
              </div>
            )}

            {/* AI Response Subtitle */}
            {aiResponseText && (
              <div className="flex gap-2 items-start text-slate-200 border-t border-slate-900/50 pt-3">
                <span className="font-mono text-[10px] font-bold text-indigo-400/80 bg-indigo-950/30 px-1.5 py-0.5 rounded border border-indigo-500/10 uppercase select-none mt-0.5">CORE</span>
                <span className="leading-relaxed text-slate-300 font-sans">{aiResponseText}</span>
              </div>
            )}

            {!userTranscript && !aiResponseText && (
              <div className="text-center py-6 text-slate-600 font-medium italic text-xs select-none">
                Start speaking to populate voice stream logs...
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Call Actions Toolbar Footer */}
      <footer className="relative z-10 flex items-center justify-center gap-6 py-10 border-t border-slate-900/60 bg-slate-950/20 backdrop-blur-md">

        {/* Toggle Mute Button */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 shadow-lg ${
            isMuted
              ? "bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25 shadow-rose-950/20"
              : "bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        {/* End Call Hangup Button */}
        <button
          onClick={handleHangup}
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-600 to-red-500 text-white hover:from-rose-500 hover:to-red-400 shadow-xl shadow-red-950/30 transition-all duration-300 hover:scale-105 active:scale-95 group"
          title="End live voice call"
        >
          <PhoneOff className="h-7 w-7 group-hover:animate-bounce" />
        </button>

        {/* Force Listening Refresh / Manual Trigger Button */}
        <button
          onClick={() => {
            if (!isMuted && callState !== "thinking" && callState !== "speaking") {
              restartListeningGracefully();
            }
          }}
          disabled={callState === "thinking" || callState === "speaking" || isMuted}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all duration-300 shadow-lg ${
            callState === "listening"
              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
              : "bg-slate-900/80 border-slate-800 text-slate-500 cursor-not-allowed"
          }`}
          title="Refresh listener mic lock"
        >
          <ArrowRight className={`h-6 w-6 ${callState === "listening" ? "animate-pulse" : ""}`} />
        </button>
      </footer>
    </div>
  );
}
