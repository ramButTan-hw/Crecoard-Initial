"use client";

import { useState, useRef, useEffect } from "react";
import { Hash, Send, Smile, Paperclip, Phone, Video, Search, Users, AtSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewableUser } from "./UserProfileModal";

const MEMBER_COLORS = ["#5865F2","#57F287","#FEE75C","#EB459E","#ED4245","#3BA55C","#FAA61A","#9B59B6"];
function memberColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return MEMBER_COLORS[h % MEMBER_COLORS.length];
}

interface Message {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  online?: boolean;
}

interface ServerViewProps {
  mode: "server" | "dm";
  serverId?: string | null;
  dmId?: string | null;
  serverName?: string;
  dmUsername?: string;
  dmOnline?: boolean;
  channelName?: string;
  showChannels?: boolean;
  showMembers?: boolean;
  onViewProfile?: (u: ViewableUser) => void;
}

const DEMO_CHANNELS: Record<string, { name: string; messages: Message[] }> = {
  general: {
    name: "general",
    messages: [
      { id: "1", author: "alex_dev", avatar: "A", content: "Hey everyone! Just deployed the new board feature 🎉", timestamp: "Today at 9:41 AM", online: true },
      { id: "2", author: "sarah.m", avatar: "S", content: "Looks amazing! The drag and drop is so smooth now", timestamp: "Today at 9:43 AM" },
      { id: "3", author: "jordan", avatar: "J", content: "Finally got my workout block set up properly. Game changer for tracking clients!", timestamp: "Today at 9:47 AM", online: true },
      { id: "4", author: "alex_dev", avatar: "A", content: "The variable system is 🤌 — built a full budget calculator in like 5 minutes", timestamp: "Today at 10:02 AM", online: true },
    ],
  },
  planning: {
    name: "planning",
    messages: [
      { id: "5", author: "sarah.m", avatar: "S", content: "Q3 roadmap is up on the public board. Everyone take a look", timestamp: "Yesterday at 3:15 PM" },
      { id: "6", author: "jordan", avatar: "J", content: "Left some comments on the feature blocks. The gaming tracker integration is top priority for me", timestamp: "Yesterday at 3:42 PM", online: true },
    ],
  },
  announcements: {
    name: "announcements",
    messages: [
      { id: "7", author: "alex_dev", avatar: "A", content: "PlanCraft v0.2 is live! Blocks can now be expanded into full mini-boards with free-form grids.", timestamp: "Today at 8:00 AM", online: true },
    ],
  },
  feedback: {
    name: "feedback",
    messages: [],
  },
};

const DM_MESSAGES: Record<string, Message[]> = {
  d1: [
    { id: "1", author: "alex_dev", avatar: "A", content: "Hey! Can you share that workout block template?", timestamp: "Today at 11:20 AM", online: true },
    { id: "2", author: "You", avatar: "Y", content: "Sure! Made it public — check the community boards", timestamp: "Today at 11:22 AM" },
    { id: "3", author: "alex_dev", avatar: "A", content: "Perfect, thanks! Love the timer items inside the block", timestamp: "Today at 11:25 AM", online: true },
  ],
  d2: [
    { id: "4", author: "sarah.m", avatar: "S", content: "Hey, do you know how to link variables across blocks?", timestamp: "Yesterday at 4:10 PM" },
    { id: "5", author: "You", avatar: "Y", content: "Not yet, that's a future feature — for now keep them in the same block", timestamp: "Yesterday at 4:13 PM" },
  ],
  d3: [],
};

const DEMO_MEMBERS = [
  { id: "m1", username: "alex_dev", avatar: "A", online: true, role: "Admin" },
  { id: "m2", username: "sarah.m", avatar: "S", online: false, role: "Member" },
  { id: "m3", username: "jordan", avatar: "J", online: true, role: "Member" },
  { id: "m4", username: "riley_k", avatar: "R", online: true, role: "Member" },
  { id: "m5", username: "mia.dev", avatar: "M", online: false, role: "Member" },
];

export function ServerView({ mode, serverId, dmId, serverName, dmUsername, dmOnline, channelName = "general", showChannels = true, showMembers = false, onViewProfile }: ServerViewProps) {
  const [activeChannel, setActiveChannel] = useState(channelName);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const channels = Object.keys(DEMO_CHANNELS);
  const currentChannel = DEMO_CHANNELS[activeChannel] ?? DEMO_CHANNELS.general;
  const messages = mode === "dm" ? (DM_MESSAGES[dmId ?? "d1"] ?? []) : currentChannel.messages;
  const title = mode === "dm" ? (dmUsername ?? "Direct Message") : `#${currentChannel.name}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setInput("");
    // In real app: persist to Supabase
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Channel list (servers only, toggleable) */}
      {mode === "server" && showChannels && (
        <div className="w-[200px] flex-shrink-0 border-r border-[var(--border)] overflow-y-auto" style={{ background: "var(--surface-raised)" }}>
          <div className="px-3 py-3 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{serverName ?? "Server"}</p>
          </div>
          <div className="p-2">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Text Channels</p>
            {channels.map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors text-left",
                  activeChannel === ch
                    ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/50 hover:text-[var(--text-primary)]"
                )}
              >
                <Hash size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
                {ch}
                {ch === "announcements" && <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">1</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Chat header */}
        <div className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-4" style={{ background: "var(--surface-raised)" }}>
          {mode === "dm" ? (
            <>
              <div className="relative">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                  {dmUsername?.[0]?.toUpperCase() ?? "?"}
                </span>
                <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-raised)]", dmOnline ? "bg-green-500" : "bg-[var(--text-muted)]")} />
              </div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
              <span className="text-xs text-[var(--text-muted)]">{dmOnline ? "Online" : "Offline"}</span>
            </>
          ) : (
            <>
              <Hash size={18} className="text-[var(--text-muted)]" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">{currentChannel.name}</span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1">
            {mode === "dm" && (
              <>
                <button className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"><Phone size={15} /></button>
                <button className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"><Video size={15} /></button>
              </>
            )}
            {mode === "server" && (
              <button className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"><Users size={15} /></button>
            )}
            <button className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"><Search size={15} /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-raised)] text-3xl">
                {mode === "dm" ? "💬" : "#"}
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {mode === "dm" ? `Beginning of your DM with ${dmUsername}` : `Welcome to #${activeChannel}`}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                {mode === "dm" ? "Send a message to start the conversation." : "This is the start of this channel."}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isConsecutive = idx > 0 && messages[idx - 1].author === msg.author;
              return (
                <MessageBubble key={msg.id} msg={msg} consecutive={isConsecutive} />
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2">
            <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0">
              <Paperclip size={18} />
            </button>
            <input
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder={`Message ${title}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0">
              <AtSign size={18} />
            </button>
            <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0">
              <Smile size={18} />
            </button>
            <button
              onClick={sendMessage}
              className={cn("flex-shrink-0 rounded-lg p-1.5 transition-colors", input.trim() ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]" : "text-[var(--text-muted)]")}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Members panel (servers only, toggleable) */}
      {mode === "server" && showMembers && (
        <div className="w-[200px] flex-shrink-0 border-l border-[var(--border)] overflow-y-auto" style={{ background: "var(--surface-raised)" }}>
          <div className="px-3 py-3 border-b border-[var(--border)]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Online — {DEMO_MEMBERS.filter((m) => m.online).length}
            </p>
          </div>
          <div className="p-2 flex flex-col gap-0.5">
            {DEMO_MEMBERS.filter((m) => m.online).map((m) => (
              <MemberRow key={m.id} member={m} onViewProfile={onViewProfile} />
            ))}
            <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Offline — {DEMO_MEMBERS.filter((m) => !m.online).length}
            </p>
            {DEMO_MEMBERS.filter((m) => !m.online).map((m) => (
              <MemberRow key={m.id} member={m} onViewProfile={onViewProfile} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, onViewProfile }: { member: typeof DEMO_MEMBERS[number]; onViewProfile?: (u: ViewableUser) => void }) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors text-left"
      onClick={() => onViewProfile?.({ displayName: member.username, avatarChar: member.avatar, color: memberColor(member.username), online: member.online })}
    >
      <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
        {member.avatar}
        <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-raised)]", member.online ? "bg-green-500" : "bg-[var(--text-muted)]")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{member.username}</p>
        <p className="truncate text-[10px] text-[var(--text-muted)]">{member.role}</p>
      </div>
    </button>
  );
}

function MessageBubble({ msg, consecutive }: { msg: Message; consecutive: boolean }) {
  const isYou = msg.author === "You";
  return (
    <div className={cn("group flex items-start gap-3 rounded-lg px-2 py-1 hover:bg-[var(--surface-overlay)]/40 transition-colors", consecutive ? "mt-0.5" : "mt-4")}>
      {!consecutive ? (
        <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", isYou ? "bg-green-600" : "bg-[var(--accent)]")}>
          {msg.avatar}
        </div>
      ) : (
        <div className="w-9 flex-shrink-0" />
      )}
      <div className="flex flex-1 flex-col min-w-0">
        {!consecutive && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">{msg.author}</span>
            <span className="text-[10px] text-[var(--text-muted)]">{msg.timestamp}</span>
          </div>
        )}
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed break-words">{msg.content}</p>
      </div>
    </div>
  );
}
