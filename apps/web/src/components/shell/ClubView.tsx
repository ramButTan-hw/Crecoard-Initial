"use client";

import { useState, useRef, useEffect } from "react";
import {
  LayoutGrid, MessageCircle, Calendar, ImageIcon,
  Hash, Send, Smile, Paperclip, AtSign, Users,
  ChevronRight, Zap, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/boardStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClubData {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  bannerGradient: string;
  pulse: "active" | "buzzing" | "quiet";
  memberCount?: number;
}

type RoomType = "lobby" | "boards" | "chat" | "events" | "media";

interface Room {
  id: RoomType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface Message {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  online?: boolean;
}

const ROOMS: Room[] = [
  { id: "boards",  label: "Board Room", icon: <LayoutGrid size={15} />,    description: "Plan and build together" },
  { id: "chat",    label: "Chat",       icon: <Hash size={15} />,           description: "Fast banter" },
  { id: "events",  label: "Events",     icon: <Calendar size={15} />,       description: "RSVP + planning" },
  { id: "media",   label: "Media",      icon: <ImageIcon size={15} />,      description: "Drops and clips" },
];

const DEMO_MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: "1", author: "alex_dev",  avatar: "A", content: "Just pushed the new gradient system — everyone check the design board 🎨", timestamp: "Today at 9:41 AM", online: true },
    { id: "2", author: "sarah.m",   avatar: "S", content: "Looks incredible. The board room is going to be so much better for our reviews", timestamp: "Today at 9:43 AM" },
    { id: "3", author: "jordan",    avatar: "J", content: "Added a variable block for the brand color tokens — link your API and it auto-pulls", timestamp: "Today at 10:02 AM", online: true },
  ],
  c2: [
    { id: "4", author: "priya",     avatar: "P", content: "Roadmap board is live. Sprint 3 items are locked in 🚀", timestamp: "Today at 8:15 AM", online: true },
    { id: "5", author: "marcus",    avatar: "M", content: "Bumped the deck for investor review. Slide 7 is the one", timestamp: "Today at 8:47 AM" },
  ],
  c3: [
    { id: "6", author: "dev_maya",  avatar: "D", content: "Shipped the embed widget. Works with any iframe src now", timestamp: "Yesterday at 6:30 PM", online: true },
    { id: "7", author: "t0m_wr",    avatar: "T", content: "Nice — I've got the API item pulling from our monitoring endpoint already", timestamp: "Yesterday at 6:52 PM" },
    { id: "8", author: "dev_maya",  avatar: "D", content: "Timer blocks + countdown on the incident board = actual magic for oncall", timestamp: "Yesterday at 7:00 PM", online: true },
  ],
};

// ─── Main component ────────────────────────────────────────────────────────────

export function ClubView({ club, onOpenBoard }: { club: ClubData; onOpenBoard: (boardId: string) => void }) {
  const [activeRoom, setActiveRoom] = useState<RoomType>("lobby");

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: room navigation */}
      <div className="w-[200px] flex-shrink-0 flex flex-col overflow-hidden border-r border-[var(--border)]" style={{ background: "var(--surface-raised)" }}>
        {/* Club banner header */}
        <div className="relative flex-shrink-0 h-14 flex items-end px-3 pb-2.5" style={{ background: club.bannerGradient }}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10">
            <p className="text-[13px] font-bold text-white leading-tight">{club.name}</p>
            <p className="text-[10px] text-white/70 leading-tight">{club.tagline}</p>
          </div>
        </div>

        {/* Lobby button */}
        <button
          onClick={() => setActiveRoom("lobby")}
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-[13px] transition-colors text-left",
            activeRoom === "lobby"
              ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/60 hover:text-[var(--text-primary)]"
          )}
        >
          <Zap size={14} className="flex-shrink-0" />
          <span className="font-medium">Lobby</span>
        </button>

        <div className="mx-3 my-1 h-px bg-[var(--border)]" />

        {/* Room list */}
        <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Rooms</p>
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {ROOMS.map((room) => (
            <button
              key={room.id}
              onClick={() => setActiveRoom(room.id)}
              className={cn(
                "group flex items-center gap-2 rounded px-2 py-1.5 text-[13px] transition-colors text-left",
                activeRoom === room.id
                  ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/60 hover:text-[var(--text-primary)]"
              )}
            >
              <span className="flex-shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">{room.icon}</span>
              <span className="flex-1 truncate">{room.label}</span>
            </button>
          ))}
        </div>

        {/* Members section */}
        <div className="mx-3 my-1 h-px bg-[var(--border)]" />
        <button className="flex items-center gap-2 px-3 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <Users size={14} className="flex-shrink-0" />
          <span className="font-medium">Members</span>
          {club.memberCount && <span className="ml-auto text-[10px] text-[var(--text-muted)]">{club.memberCount}</span>}
        </button>
      </div>

      {/* Right: room content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeRoom === "lobby"  && <ClubLobby  club={club} onOpenBoard={onOpenBoard} onEnterRoom={setActiveRoom} />}
        {activeRoom === "chat"   && <ChatRoom   clubId={club.id} />}
        {activeRoom === "boards" && <BoardRoom  onOpenBoard={onOpenBoard} />}
        {activeRoom === "events" && <EventRoom  clubName={club.name} />}
        {activeRoom === "media"  && <MediaRoom  />}
      </div>
    </div>
  );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────

function ClubLobby({ club, onOpenBoard, onEnterRoom }: { club: ClubData; onOpenBoard: (id: string) => void; onEnterRoom: (r: RoomType) => void }) {
  const boards = useBoardStore((s) => s.boards);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero banner */}
      <div className="relative h-28 flex-shrink-0" style={{ background: club.bannerGradient }}>
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative z-10 flex h-full items-end px-6 pb-4 gap-3">
          <span className="text-5xl drop-shadow-md">{club.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">{club.name}</h1>
            <p className="text-sm text-white/70">{club.tagline}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1">
            <span className={cn("h-2 w-2 rounded-full", club.pulse === "active" ? "bg-green-400" : club.pulse === "buzzing" ? "bg-amber-400" : "bg-[var(--text-muted)]")} />
            <span className="text-xs text-white/80 font-medium capitalize">{club.pulse}</span>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Boards lobby */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Your Boards</h2>
            <button
              onClick={() => onEnterRoom("boards")}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              See all <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {boards.slice(0, 4).map((board) => (
              <button
                key={board.id}
                onClick={() => onOpenBoard(board.id)}
                className="group relative rounded-xl overflow-hidden border border-[var(--border)] hover:border-[var(--accent)]/60 transition-all duration-150 text-left"
                style={{ background: board.backgroundColor ?? "#1a1b1e" }}
              >
                {/* Board thumbnail background */}
                <div className="h-16 w-full" style={{ background: board.backgroundImage ? `url(${board.backgroundImage}) center/cover` : undefined }} />
                {/* Board info bar */}
                <div className="flex items-center gap-2 px-2.5 py-1.5" style={{ background: "rgba(0,0,0,0.45)" }}>
                  <span className="flex-1 truncate text-xs font-medium text-white">{board.name}</span>
                  {board.collabEnabled && (
                    <span className="flex items-center gap-0.5 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />LIVE
                    </span>
                  )}
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-[var(--accent)]/0 group-hover:ring-[var(--accent)]/40 transition-all pointer-events-none" />
                {activeBoardId === board.id && (
                  <div className="absolute top-1.5 right-1.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-white">OPEN</div>
                )}
              </button>
            ))}
            {boards.length === 0 && (
              <button
                onClick={() => onEnterRoom("boards")}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-6 text-sm text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] transition-colors"
              >
                <Plus size={16} /> Create your first board
              </button>
            )}
          </div>
        </section>

        {/* Room cards */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Rooms</h2>
          <div className="grid grid-cols-2 gap-2">
            {ROOMS.map((room) => (
              <button
                key={room.id}
                onClick={() => onEnterRoom(room.id)}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-left hover:border-[var(--accent)]/40 hover:bg-[var(--surface-overlay)] transition-all duration-150"
              >
                <span className="text-[var(--text-muted)]">{room.icon}</span>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-tight">{room.label}</p>
                  <p className="text-[10px] text-[var(--text-muted)] leading-tight truncate">{room.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Board Room ───────────────────────────────────────────────────────────────

function BoardRoom({ onOpenBoard }: { onOpenBoard: (id: string) => void }) {
  const boards = useBoardStore((s) => s.boards);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Board Room</h2>
        <p className="text-xs text-[var(--text-muted)]">Click a board to open it on the canvas</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {boards.map((board) => (
          <button
            key={board.id}
            onClick={() => onOpenBoard(board.id)}
            className="group relative rounded-xl overflow-hidden border border-[var(--border)] hover:border-[var(--accent)]/60 transition-all duration-150 text-left"
            style={{ background: board.backgroundColor ?? "#1a1b1e" }}
          >
            <div className="h-24 w-full relative" style={{ background: board.backgroundImage ? `url(${board.backgroundImage}) center/cover` : undefined }}>
              {activeBoardId === board.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--accent)]/20">
                  <span className="rounded-full bg-[var(--accent)] px-2 py-1 text-[10px] font-bold text-white">OPEN</span>
                </div>
              )}
            </div>
            <div className="px-2.5 py-2" style={{ background: "rgba(0,0,0,0.5)" }}>
              <p className="text-xs font-semibold text-white truncate">{board.name}</p>
              <p className="text-[10px] text-white/50">{board.boxes.length} block{board.boxes.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-[var(--accent)]/0 group-hover:ring-[var(--accent)]/40 transition-all pointer-events-none" />
          </button>
        ))}
        {boards.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-3xl">📋</span>
            <p className="text-sm font-semibold text-[var(--text-primary)]">No boards yet</p>
            <p className="text-xs text-[var(--text-muted)]">Switch to the Board view to create one</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Room ────────────────────────────────────────────────────────────────

function ChatRoom({ clubId }: { clubId: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => DEMO_MESSAGES[clubId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: "You", avatar: "Y", content: input.trim(), timestamp: "Just now" },
    ]);
    setInput("");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-[var(--border)] px-4" style={{ background: "var(--surface-raised)" }}>
        <Hash size={16} className="text-[var(--text-muted)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">chat</span>
        <span className="text-xs text-[var(--text-muted)]">— fast banter</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="text-4xl">💬</span>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Start the conversation</p>
            <p className="text-xs text-[var(--text-muted)]">Be the first to say something.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isConsecutive = idx > 0 && messages[idx - 1].author === msg.author;
            return <ChatMessage key={msg.id} msg={msg} consecutive={isConsecutive} />;
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2">
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"><Paperclip size={17} /></button>
          <input
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Message #chat"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"><AtSign size={17} /></button>
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"><Smile size={17} /></button>
          <button
            onClick={send}
            className={cn("flex-shrink-0 rounded-lg p-1.5 transition-colors", input.trim() ? "bg-[var(--accent)] text-white hover:opacity-90" : "text-[var(--text-muted)]")}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({ msg, consecutive }: { msg: Message; consecutive: boolean }) {
  const isYou = msg.author === "You";
  return (
    <div className={cn("group flex items-start gap-3 rounded-lg px-2 py-1 hover:bg-[var(--surface-overlay)]/40 transition-colors", consecutive ? "mt-0.5" : "mt-3")}>
      {!consecutive ? (
        <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", isYou ? "bg-green-600" : "bg-[var(--accent)]")}>
          {msg.avatar}
        </div>
      ) : (
        <div className="w-8 flex-shrink-0" />
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

// ─── Event Room ───────────────────────────────────────────────────────────────

function EventRoom({ clubName }: { clubName: string }) {
  const events = [
    { id: "1", title: "Sprint Planning", date: "Thu Jun 26, 2:00 PM", rsvp: 6, total: 8, going: true },
    { id: "2", title: "Design Review", date: "Fri Jun 27, 4:00 PM", rsvp: 3, total: 5, going: false },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Events</h2>
        <p className="text-xs text-[var(--text-muted)]">RSVP and auto-generate a planning board</p>
      </div>
      <div className="flex flex-col gap-3">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{ev.title}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{ev.date}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">{ev.rsvp}/{ev.total} going</p>
              </div>
              <button className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors flex-shrink-0", ev.going ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 hover:text-[var(--accent)]")}>
                {ev.going ? "Going ✓" : "RSVP"}
              </button>
            </div>
          </div>
        ))}
        <button className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-4 text-sm text-[var(--text-muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)] transition-colors">
          <Plus size={15} /> New event
        </button>
      </div>
    </div>
  );
}

// ─── Media Room ───────────────────────────────────────────────────────────────

function MediaRoom() {
  const drops = [
    { id: "1", author: "alex_dev", label: "Brand kit v3.png", type: "image", emoji: "🖼️", ago: "2h ago" },
    { id: "2", author: "sarah.m",  label: "Q3 retrospective.pdf", type: "file", emoji: "📄", ago: "Yesterday" },
    { id: "3", author: "jordan",   label: "Screen recording — timer blocks", type: "video", emoji: "🎬", ago: "2d ago" },
    { id: "4", author: "alex_dev", label: "Moodboard.png", type: "image", emoji: "🖼️", ago: "3d ago" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--text-primary)]">Media</h2>
        <p className="text-xs text-[var(--text-muted)]">Drops, clips, and images — pin to any board in one click</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {drops.map((d) => (
          <div key={d.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 flex items-center gap-2.5">
            <span className="text-2xl flex-shrink-0">{d.emoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">{d.label}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{d.author} · {d.ago}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
