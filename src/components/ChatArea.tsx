import React, { useState } from "react";
import {
  Bot,
  User,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Cpu,
  Code,
  FileText,
  Maximize2,
  Minimize2,
  ChevronRight,
  Workflow,
  AlertCircle,
  X
} from "lucide-react";
import { Message, Attachment, RoboticsContextType } from "../types";
import { motion, AnimatePresence } from "framer-motion";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  onSendPreset: (text: string) => void;
  speakingMsgId: string | null;
  onSpeak: (messageId: string, text: string) => void;
  onStopSpeaking: () => void;
}

// Preset prompts for robotics developers
const ROBOTICS_PRESETS = [
  {
    title: "ESP32 Controller",
    desc: "PID controller for brushless DC motor",
    prompt: "Write an Arduino ESP32 C++ code that implements a precise PID controller for a brushless DC motor using PWM and feedback from an incremental encoder. Use non-blocking timers.",
    icon: Cpu,
    color: "from-cyan-500/20 to-teal-500/20 text-cyan-400 border-cyan-500/30",
  },
  {
    title: "ROS 2 Kinematics Node",
    desc: "IK solver node for 3-DOF arm",
    prompt: "Create a ROS 2 Python node that subscribes to target JointStates, solves Inverse Kinematics for a 3-DOF planar robotic arm, and publishes joint positions. Include standard node declarations and logging.",
    icon: Workflow,
    color: "from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30",
  },
  {
    title: "URDF Robotic Rover",
    desc: "Differential drive robot XML code",
    prompt: "Synthesize a clean and complete URDF XML file for a 4-wheeled differential drive mobile rover. Include links, joints (revolute/continuous), inertial properties, and Gazebo controller plugins.",
    icon: Code,
    color: "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30",
  },
  {
    title: "IMU Kalman Filter",
    desc: "ESP32 sensor fusion logic",
    prompt: "Write a C++ class for an ESP32 micro-controller that implements a basic complementary filter or complementary Kalman filter to fuse 3-axis accelerometer and 3-axis gyroscope data from an MPU6050 via I2C, yielding smooth pitch and roll angles.",
    icon: FileText,
    color: "from-rose-500/20 to-red-500/20 text-rose-400 border-rose-500/30",
  }
];

export default function ChatArea({
  messages,
  isLoading,
  onSendPreset,
  speakingMsgId,
  onSpeak,
  onStopSpeaking,
}: ChatAreaProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<{ name: string; content: string } | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Safe custom renderer for Markdown/Code Blocks
  const renderMessageText = (text: string, messageId: string) => {
    if (!text) return null;

    // Split text into code blocks and normal paragraphs
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith("```")) {
        // Code Block
        const lines = part.split("\n");
        const header = lines[0].slice(3).trim();
        const language = header || "code";
        const codeContent = lines.slice(1, -1).join("\n");
        const blockId = `${messageId}-code-${index}`;

        return (
          <div key={index} className="my-5 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/90 font-mono text-[12.5px] shadow-xl shadow-black/45 relative group/code">
            {/* Ambient edge highlight */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-cyan-500/0 via-cyan-500/40 to-indigo-500/0 opacity-0 group-hover/code:opacity-100 transition-opacity duration-300" />

            {/* Code Block Header */}
            <div className="flex items-center justify-between bg-slate-900/60 px-4 py-2 border-b border-slate-800/80 text-slate-400 select-none">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                <span className="text-[10px] font-bold text-cyan-400/90 tracking-widest uppercase">{language}</span>
              </div>
              <button
                onClick={() => handleCopy(codeContent, blockId)}
                className="flex items-center gap-1 rounded-lg bg-slate-900 border border-slate-800/80 px-2.5 py-1 text-[11px] hover:bg-slate-800 hover:text-white hover:border-slate-700 transition-all font-sans font-medium"
              >
                {copiedId === blockId ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            {/* Scrollable Code Box */}
            <div className="overflow-x-auto p-4.5 leading-relaxed text-slate-200 max-h-[520px] custom-scrollbar bg-[#06080e]/40 select-text">
              <pre><code className="font-mono block whitespace-pre">{codeContent}</code></pre>
            </div>
          </div>
        );
      } else {
        // Standard text, handle simple bolding and inline code formatting
        const textLines = part.split("\n");
        return textLines.map((line, lIdx) => {
          if (line.trim() === "") {
            return <div key={lIdx} className="h-2" />;
          }

          // Check if bullet point
          const isBullet = line.trim().startsWith("* ") || line.trim().startsWith("- ");
          const isNumbered = /^\d+\.\s/.test(line.trim());

          let content = line;
          if (isBullet) content = line.trim().substring(2);
          if (isNumbered) {
            const match = line.trim().match(/^(\d+\.\s)(.*)/);
            if (match) content = match[2];
          }

          // Parse bold (**text**) and inline code (`code`)
          const elements: React.ReactNode[] = [];
          const regex = /(\*\*.*?\*\*|`.*?`)/g;
          const segments = content.split(regex);

          segments.forEach((seg, sIdx) => {
            if (seg.startsWith("**") && seg.endsWith("**")) {
              elements.push(<strong key={sIdx} className="font-bold text-white text-[14px]">{seg.slice(2, -2)}</strong>);
            } else if (seg.startsWith("`") && seg.endsWith("`")) {
              elements.push(
                <code key={sIdx} className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 font-mono text-xs text-cyan-400">
                  {seg.slice(1, -1)}
                </code>
              );
            } else {
              elements.push(seg);
            }
          });

          if (isBullet) {
            return (
              <ul key={lIdx} className="list-disc list-inside pl-4 text-slate-300 leading-relaxed text-[13.5px] my-1 font-sans">
                <li>{elements}</li>
              </ul>
            );
          }

          if (isNumbered) {
            const num = line.trim().match(/^(\d+)/)?.[1] || "1";
            return (
              <div key={lIdx} className="flex gap-2 pl-4 text-slate-300 leading-relaxed text-[13.5px] my-1 font-sans">
                <span className="text-cyan-400 font-bold font-mono">{num}.</span>
                <div>{elements}</div>
              </div>
            );
          }

          // Header levels
          if (line.trim().startsWith("### ")) {
            return <h4 key={lIdx} className="text-sm font-semibold text-white tracking-wide mt-3 mb-1">{line.trim().slice(4)}</h4>;
          }
          if (line.trim().startsWith("## ")) {
            return <h3 key={lIdx} className="text-md font-bold text-cyan-400 tracking-wide mt-4 mb-1.5">{line.trim().slice(3)}</h3>;
          }

          return (
            <p key={lIdx} className="text-slate-300 leading-relaxed text-[13.5px] font-sans my-1.5">
              {elements}
            </p>
          );
        });
      }
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 bg-[#070913] cyber-grid custom-scrollbar relative">
      {/* Floating Ambient Glow Orbs */}
      {messages.length === 0 && (
        <>
          <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none pulse-glow" />
          <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none pulse-glow [animation-delay:1.5s]" />
        </>
      )}

      <div className="mx-auto max-w-4xl space-y-6 relative z-10">

        {/* Empty State Banner */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500 p-0.5 shadow-xl shadow-cyan-500/10 mb-6"
            >
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-[#0d111d]">
                <Bot className="h-8 w-8 text-cyan-400 animate-pulse" />
              </div>
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0d111d] bg-emerald-500 animate-ping" />
            </motion.div>

            <motion.h1
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-2xl font-extrabold tracking-tight text-white md:text-3xl"
            >
              System Initialized: <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">Yukthi.AI</span>
            </motion.h1>

            <motion.p
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="mt-3 max-w-lg text-slate-400 text-sm leading-relaxed"
            >
              A high-speed development interface for robotics systems engineering. Solves kinematics, microcontrollers, ROS node layouts, and physics simulations in seconds.
            </motion.p>

            {/* Quick Presets Grid */}
            <div className="mt-10 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 text-left">
              {ROBOTICS_PRESETS.map((preset, idx) => {
                const IconComp = preset.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 + idx * 0.08, duration: 0.4 }}
                    onClick={() => onSendPreset(preset.prompt)}
                    className={`cursor-pointer rounded-2xl border p-4 bg-slate-900/40 hover:bg-slate-900/90 hover:border-cyan-500/40 transition-all duration-200 group flex flex-col justify-between h-32 hover:shadow-lg hover:shadow-cyan-950/10 ${preset.color.split(" ").slice(-1)[0]}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-xl bg-slate-900 border ${preset.color.split(" ").slice(-1)[0]}`}>
                        <IconComp className="h-5 w-5" />
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <div className="mt-3">
                      <h3 className="font-semibold text-xs text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                        {preset.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{preset.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pb-20">
            {messages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={message.id}
                  className={`flex gap-4 ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  {/* Left Avatar for Bot */}
                  {isAssistant && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 shadow shadow-cyan-950/20">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-md ${
                    isAssistant
                      ? "bg-slate-900/60 border border-slate-800/80 text-slate-200 rounded-tl-sm"
                      : "bg-[#1d273f] border border-slate-700/40 text-slate-100 rounded-tr-sm"
                  }`}>

                    {/* Username Header */}
                    <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500 select-none">
                      <span className="font-bold tracking-wider text-slate-400 uppercase">
                        {isAssistant ? "Yukthi.AI" : "Developer"}
                      </span>
                      <span>•</span>
                      <span>{message.timestamp}</span>

                      {/* Display mode badges */}
                      {message.mode && (
                        <>
                          <span>•</span>
                          <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[8px] font-mono ${
                            message.mode === "fast" ? "bg-cyan-500/10 text-cyan-400" : "bg-indigo-500/10 text-indigo-400"
                          }`}>
                            {message.mode === "fast" ? "Flash AI" : "Detailed AI"}
                          </span>
                        </>
                      )}
                      {message.roboticsContext && message.roboticsContext !== "general" && (
                        <>
                          <span>•</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[8px] font-bold uppercase font-mono">
                            {message.roboticsContext}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Attachment Previews in User Message */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2.5 mb-3.5 select-none">
                        {message.attachments.map((att) => {
                          const isImg = att.type.startsWith("image/");
                          return (
                            <div
                              key={att.id}
                              onClick={() => {
                                if (isImg) setViewingImage(att.base64Data);
                                else if (att.textContent) {
                                  setExpandedFile({ name: att.name, content: att.textContent });
                                }
                              }}
                              className="flex items-center gap-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 p-1.5 cursor-pointer hover:shadow-lg transition-all text-left max-w-xs"
                            >
                              {isImg ? (
                                <img
                                  src={att.base64Data}
                                  alt={att.name}
                                  className="h-9 w-9 rounded-lg object-cover bg-slate-900 border border-slate-800"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-cyan-400">
                                  <Code className="h-4.5 w-4.5" />
                                </div>
                              )}
                              <div className="min-w-0 pr-1.5">
                                <p className="text-[11px] font-medium text-slate-300 truncate w-32">{att.name}</p>
                                <p className="text-[9px] text-slate-500 font-mono">
                                  {(att.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Main Content Text */}
                    <div className="space-y-1">
                      {renderMessageText(message.text, message.id)}
                    </div>

                    {/* Assistant Footer Buttons (TTS & Copy) */}
                    {isAssistant && (
                      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3.5 select-none">
                        <div className="flex items-center gap-1">
                          {/* Speak Response Button */}
                          {speakingMsgId === message.id ? (
                            <button
                              onClick={onStopSpeaking}
                              className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 text-[11px] font-medium text-rose-400 hover:bg-rose-500/20 transition-all"
                              title="Stop speaking"
                            >
                              <Square className="h-3 w-3 fill-rose-400 stroke-none" />
                              <span className="font-mono text-[9px] tracking-wider uppercase">Speaking</span>
                              <span className="flex h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                            </button>
                          ) : (
                            <button
                              onClick={() => onSpeak(message.id, message.text)}
                              className="flex items-center gap-1.5 rounded-lg hover:bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white transition-all"
                              title="Read response aloud"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              <span>Listen</span>
                            </button>
                          )}

                          {/* Copy entire answer */}
                          <button
                            onClick={() => handleCopy(message.text, message.id)}
                            className="flex items-center gap-1.5 rounded-lg hover:bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white transition-all"
                            title="Copy response to clipboard"
                          >
                            {copiedId === message.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                <span className="text-emerald-400 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>

                        <span className="flex items-center gap-1 text-[10px] font-mono text-slate-600">
                          <Sparkles className="h-3 w-3 text-cyan-500/40" />
                          Yukthi.AI v1.2
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Avatar for User */}
                  {!isAssistant && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 border border-slate-700/50 text-slate-300">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 shadow shadow-cyan-950/20">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="max-w-[85%] rounded-2xl bg-slate-900/60 border border-slate-800/80 px-5 py-4 rounded-tl-sm shadow-md">
                  <div className="flex items-center gap-2 mb-2 text-[10px] text-slate-500 select-none">
                    <span className="font-bold tracking-wider text-slate-400 uppercase">Yukthi.AI</span>
                    <span>•</span>
                    <span>Compiling response...</span>
                  </div>
                  <div className="flex items-center gap-2.5 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-Screen Image Lightbox */}
      <AnimatePresence>
        {viewingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 cursor-zoom-out"
          >
            <button className="absolute top-4 right-4 rounded-full bg-slate-900 border border-slate-800 p-2 text-slate-400 hover:text-white">
              <Minimize2 className="h-5 w-5" />
            </button>
            <img
              src={viewingImage}
              alt="Expanded view"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl border border-slate-800"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded File Text Viewer Modal */}
      <AnimatePresence>
        {expandedFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="w-full max-w-4xl max-h-[85vh] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
                <div className="flex items-center gap-2 text-cyan-400 font-mono text-sm">
                  <FileText className="h-4.5 w-4.5" />
                  <span className="font-semibold">{expandedFile.name}</span>
                </div>
                <button
                  onClick={() => setExpandedFile(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950 select-text">
                <pre><code>{expandedFile.content}</code></pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
