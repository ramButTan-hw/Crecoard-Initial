"use client";

import { useState } from "react";
import { Hash, MessageCircle, Plus, ChevronLeft, ChevronRight, Users, Settings, Home } from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import { cn } from "@/lib/utils";

interface Server { id: string; name: string; icon: string; unread?: number }
interface DM { id: string; username: string; avatar: string; online: boolean; unread?: number }

const DEMO_SERVERS: Server[] = [
  { id: "s1", name: "Design Team", icon: "D", unread: 3 },
  { id: "s2", name: "Startup Hub", icon: "S" },
  { id: "s3", name: "Dev Community", icon: "⚡", unread: 12 },
];

const DEMO_DMS: DM[] = [
  { id: "d1", username: "alex_dev", avatar: "A", online: true, unread: 2 },
  { id: "d2", username: "sarah.m", avatar: "S", online: false },
  { id: "d3", username: "jordan", avatar: "J", online: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: "board" | "server" | "dm";
  activeServerId: string | null;
  activeDmId: string | null;
  onViewChange: (v: "board" | "server" | "dm") => void;
  onServerSelect: (id: string) => void;
  onDmSelect: (id: string) => void;
  onSettingsOpen: () => void;
}

export function Sidebar({ collapsed, onToggle, activeView, activeServerId, activeDmId, onViewChange, onServerSelect, onDmSelect, onSettingsOpen }: SidebarProps) {
  const activeServer = DEMO_SERVERS.find((s) => s.id === activeServerId);
  const hasAppBg = useBoardStore((s) => !!s.appBg.image);

  return (
    <div className={cn("flex h-full flex-shrink-0 transition-all duration-200", collapsed ? "w-[60px]" : "w-[240px]")} style={{ background: hasAppBg ? "transparent" : "var(--sidebar)" }}>
      {/* Server icons strip */}
      <div className="flex w-[60px] flex-shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] py-3">
        {/* Home / Boards */}
        <SidebarIcon label="Boards" active={activeView === "board"} onClick={() => onViewChange("board")}>
          <Home size={20} />
        </SidebarIcon>

        <div className="my-1 h-px w-8 bg-[var(--border)]" />

        {/* Server icons */}
        {DEMO_SERVERS.map((srv) => (
          <SidebarIcon key={srv.id} label={srv.name} active={activeView === "server" && activeServerId === srv.id} unread={srv.unread} onClick={() => onServerSelect(srv.id)}>
            <span className="text-sm font-bold">{srv.icon}</span>
          </SidebarIcon>
        ))}

        <SidebarIcon label="Add server" onClick={() => {}}>
          <Plus size={20} className="text-[var(--text-muted)]" />
        </SidebarIcon>

        <div className="flex-1" />

        <SidebarIcon label="Settings" onClick={onSettingsOpen}>
          <Settings size={18} className="text-[var(--text-muted)]" />
        </SidebarIcon>
      </div>

      {/* Expanded panel */}
      {!collapsed && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {activeView === "board" ? "PlanCraft" : activeView === "server" ? (activeServer?.name ?? "Server") : "Direct Messages"}
            </span>
            <button onClick={onToggle} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]">
              <ChevronLeft size={16} />
            </button>
          </div>

          {activeView === "board" ? (
            <BoardsSidebarContent activeDmId={activeDmId} onDmSelect={onDmSelect} />
          ) : activeView === "server" ? (
            <ServerSidebarContent />
          ) : (
            <DmsSidebarContent activeDmId={activeDmId} onDmSelect={onDmSelect} />
          )}
        </div>
      )}

      {/* Collapsed toggle */}
      {collapsed && (
        <button onClick={onToggle} className="absolute left-[52px] top-1/2 -translate-y-1/2 z-10 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] shadow">
          <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

function BoardsSidebarContent({ activeDmId, onDmSelect }: { activeDmId: string | null; onDmSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      <SectionHeader label="Direct Messages" icon={<MessageCircle size={12} />} />
      {DEMO_DMS.map((dm) => (
        <button key={dm.id} onClick={() => onDmSelect(dm.id)} className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors text-left", activeDmId === dm.id ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/60 hover:text-[var(--text-primary)]")}>
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white flex-shrink-0">
            {dm.avatar}
            <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--sidebar)]", dm.online ? "bg-green-500" : "bg-[var(--text-muted)]")} />
          </span>
          <span className="flex-1 truncate">{dm.username}</span>
          {dm.unread && <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs font-bold text-white">{dm.unread}</span>}
        </button>
      ))}
    </div>
  );
}

function DmsSidebarContent({ activeDmId, onDmSelect }: { activeDmId: string | null; onDmSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      <SectionHeader label="Direct Messages" icon={<MessageCircle size={12} />} />
      {DEMO_DMS.map((dm) => (
        <button key={dm.id} onClick={() => onDmSelect(dm.id)} className={cn("flex items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors text-left", activeDmId === dm.id ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/60 hover:text-[var(--text-primary)]")}>
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white flex-shrink-0">
            {dm.avatar}
            <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--sidebar)]", dm.online ? "bg-green-500" : "bg-[var(--text-muted)]")} />
          </span>
          <span className="flex-1 truncate">{dm.username}</span>
          {dm.unread && <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-xs font-bold text-white">{dm.unread}</span>}
        </button>
      ))}
    </div>
  );
}

function ServerSidebarContent() {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      <SectionHeader label="Text Channels" icon={<Hash size={12} />} />
      {["general", "announcements", "planning", "feedback"].map((ch) => (
        <button key={ch} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors text-left">
          <Hash size={14} className="flex-shrink-0" />
          <span>{ch}</span>
        </button>
      ))}
      <SectionHeader label="Members" icon={<Users size={12} />} />
      {[{ id: "d1", avatar: "A", username: "alex_dev", online: true }, { id: "d2", avatar: "S", username: "sarah.m", online: false }, { id: "d3", avatar: "J", username: "jordan", online: true }].map((m) => (
        <button key={m.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors text-left">
          <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white flex-shrink-0">
            {m.avatar}
            <span className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[var(--sidebar)]", m.online ? "bg-green-500" : "bg-[var(--text-muted)]")} />
          </span>
          <span className="flex-1 truncate">{m.username}</span>
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="mt-2 mb-1 flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {icon}{label}
    </div>
  );
}

function SidebarIcon({ children, label, active, unread, onClick }: { children: React.ReactNode; label: string; active?: boolean; unread?: number; onClick: () => void }) {
  return (
    <div className="relative group">
      <button onClick={onClick} title={label} className={cn("relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-150 text-[var(--text-secondary)]", active ? "rounded-xl bg-[var(--accent)] text-white" : "bg-[var(--surface-raised)] hover:rounded-xl hover:bg-[var(--accent)] hover:text-white")}>
        {children}
        {unread && <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>
      <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50">{label}</div>
    </div>
  );
}
