import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  Edit3,
  Search,
  Cpu,
  ChevronLeft,
  Menu,
  Check,
  X,
  Sparkles,
  Download,
  LogOut
} from "lucide-react";
import { ChatThread } from "../types";

interface SidebarProps {
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, newTitle: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onClearAllHistory: () => void;
  onDownloadHTML: () => void;
  user: any;
  onSignOut: () => void;
}

export default function Sidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onRenameThread,
  isSidebarOpen,
  setIsSidebarOpen,
  onClearAllHistory,
  onDownloadHTML,
  user,
  onSignOut,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const saveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editValue.trim()) {
      onRenameThread(id, editValue.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      saveRename(id);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  return (
    <div
      className={`absolute inset-y-0 left-0 z-50 md:relative h-full border-r border-slate-800 bg-[#0b0f19] text-slate-200 transition-all duration-300 flex flex-col ${
        isSidebarOpen ? "w-72" : "w-0 overflow-hidden border-r-0"
      }`}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/60">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/20">
            <Cpu className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-md">Yukthi.AI</span>
            <span className="block text-[10px] font-medium tracking-widest text-cyan-400 uppercase">
              Robotics Core
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(false)}
          className="rounded-lg p-1.5 hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Floating Action / New Chat Button */}
      <div className="p-3.5">
        <button
          onClick={onNewThread}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-sm font-semibold text-cyan-400 hover:bg-slate-800 hover:border-cyan-500/50 hover:text-white shadow-sm hover:shadow-cyan-950/40 transition-all duration-200 group"
        >
          <Plus className="h-4.5 w-4.5 text-cyan-400 group-hover:rotate-90 transition-transform duration-200" />
          <span>New Robotics Task</span>
        </button>
      </div>

      {/* Thread Search */}
      <div className="px-3.5 pb-2">
        <div className="relative">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search past logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-slate-900/80 py-2 pl-9 pr-4 text-xs text-slate-300 placeholder-slate-500 border border-slate-800/80 focus:border-cyan-500/40 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 custom-scrollbar">
        {filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-slate-500">
            <MessageSquare className="h-8 w-8 mb-2 stroke-[1.5] text-slate-600" />
            <p className="text-xs">No active logs found</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer select-none transition-all duration-200 ${
                  isActive
                    ? "bg-slate-800/70 border-l-2 border-cyan-400 text-white shadow-sm shadow-cyan-950/20"
                    : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare
                    className={`h-4 w-4 flex-shrink-0 ${
                      isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-400"
                    }`}
                  />
                  {editingId === thread.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveRename(thread.id)}
                      onKeyDown={(e) => handleKeyDown(e, thread.id)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="w-full bg-slate-950 text-white rounded px-1.5 py-0.5 border border-cyan-500/50 outline-none"
                    />
                  ) : (
                    <span className="truncate font-medium pr-2">{thread.title}</span>
                  )}
                </div>

                {/* Actions (Rename / Delete) */}
                {editingId !== thread.id && (
                  <div className="flex items-center gap-1 opacity-40 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startRename(thread.id, thread.title, e)}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-cyan-400 transition-colors"
                      title="Rename log"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(thread.id);
                      }}
                      className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400 transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer with system status */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-500">
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Telemetry Online
          </span>
          <span className="text-[10px] font-mono tracking-wider">v1.2.0</span>
        </div>

        {user && (
          <div className="mb-3 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800/60 flex flex-col gap-1 min-w-0">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Authorized Gmail</span>
            <span className="text-xs text-slate-300 font-mono font-medium truncate" title={user.email}>{user.email}</span>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={onDownloadHTML}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/10 hover:bg-cyan-950/30 text-cyan-400 hover:text-cyan-300 py-2.5 px-3 font-semibold text-xs transition-all duration-200 shadow-lg shadow-cyan-500/5 group"
            title="Download conversation as a standalone formatted HTML file"
          >
            <Download className="h-3.5 w-3.5 group-hover:scale-110 transition-transform text-cyan-400" />
            <span>Download Chat HTML</span>
          </button>

          <button
            onClick={onClearAllHistory}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-950/45 bg-rose-950/10 hover:bg-rose-950/25 text-rose-400/80 hover:text-rose-300 py-1.5 px-3 font-medium text-[11px] transition-all duration-200"
            title="Clear all stored conversation logs"
          >
            <Trash2 className="h-3 w-3 text-rose-400/70" />
            <span>Clear All History</span>
          </button>

          {user && (
            <button
              onClick={onSignOut}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-950/45 bg-red-950/15 hover:bg-red-950/30 text-red-400 hover:text-red-300 py-1.5 px-3 font-semibold text-xs transition-all duration-200 cursor-pointer"
              title="Terminate secure telemetry session connection"
            >
              <LogOut className="h-3 w-3 text-red-400/80" />
              <span>Disconnect Terminal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
