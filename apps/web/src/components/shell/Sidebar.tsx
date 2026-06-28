"use client";

import { useState } from "react";
import {
  Hash, MessageCircle, Plus, ChevronLeft, ChevronRight,
  Users, Settings, Home, LayoutTemplate, Globe2,
  ChevronDown, X, UserPlus,
} from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import { useHasAppBg } from "@/lib/useHasAppBg";
import { MOCK_SERVERS, MOCK_SERVER_MEMBERS } from "@/lib/mockServerData";
import { cn } from "@/lib/utils";

interface DM { id: string; username: string; avatar: string; online: boolean; unread?: number }

const SERVER_ACCENT_COLORS: Record<string, string> = {
  s1: "#8b5cf6",
  s2: "#10b981",
  s3: "#58a6ff",
};

const DEMO_DMS: DM[] = [
  { id: "d1", username: "alex_dev", avatar: "A", online: true,  unread: 2 },
  { id: "d2", username: "sarah.m",  avatar: "S", online: false },
  { id: "d3", username: "jordan",   avatar: "J", online: true },
];

// ── Presence dot (Finding #6 — consistent presence) ──────────────────────────
function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        online ? "bg-green-500" : "bg-[var(--text-muted)]"
      )}
    />
  );
}

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
  onTemplatesOpen: () => void;
}

export function Sidebar({
  collapsed, onToggle, activeView, activeServerId, activeDmId,
  onViewChange, onServerSelect, onDmSelect, onSettingsOpen, onTemplatesOpen,
}: SidebarProps) {
  const activeServer = MOCK_SERVERS.find((s) => s.id === activeServerId);
  const hasAppBg = useHasAppBg();

  // Finding #1 — Add server modal state
  const [showAddServer, setShowAddServer] = useState(false);

  // Create-server form state
  const [newServerName, setNewServerName] = useState("");
  const [newServerIcon, setNewServerIcon] = useState("");
  const [newServerPublic, setNewServerPublic] = useState(false);

  // Join via invite state
  const [inviteCode, setInviteCode] = useState("");

  // Finding #2 — Search filter for discovery
  const [serverSearch, setServerSearch] = useState("");

  const filteredServers = serverSearch.trim()
    ? MOCK_SERVERS.filter((s) =>
        s.name.toLowerCase().includes(serverSearch.toLowerCase())
      )
    : MOCK_SERVERS;

  return (
    <div
      className={cn("flex h-full flex-shrink-0 transition-all duration-200", collapsed ? "w-[60px]" : "w-[240px]")}
      style={{ background: hasAppBg ? "transparent" : "var(--sidebar)" }}
    >
      {/* ── Icon strip ── */}
      <div className="group/strip relative flex w-[60px] flex-shrink-0 flex-col items-center gap-1 border-r border-[var(--border)] py-3">

        {/* Home / Boards */}
        <SidebarIcon label="Boards" active={activeView === "board"} onClick={() => onViewChange("board")}>
          <Home size={20} />
        </SidebarIcon>

        <SidebarIcon label="Templates" onClick={onTemplatesOpen}>
          <LayoutTemplate size={18} />
        </SidebarIcon>

        <div className="my-1 h-px w-8 bg-[var(--border)]" />

        {/* Servers — wired to MOCK_SERVERS for rich data */}
        {MOCK_SERVERS.map((srv) => (
          <SidebarIcon
            key={srv.id}
            label={srv.name}
            onlineCount={srv.onlineCount}
            isPublic={srv.isPublic}
            active={activeView === "server" && activeServerId === srv.id}
            unread={(srv as { unread?: number }).unread}
            onClick={() => onServerSelect(srv.id)}
          >
            <span className="text-sm font-bold">{srv.icon}</span>
          </SidebarIcon>
        ))}

        {/* Add server — Finding #1: opens modal */}
        <button
          title="Add server"
          onClick={() => setShowAddServer(true)}
          className="group/add mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] transition-all duration-150 hover:rounded-xl hover:border-solid hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
        >
          <Plus size={18} />
        </button>

        <div className="flex-1" />

        {/* Settings */}
        <SidebarIcon label="Settings" onClick={onSettingsOpen}>
          <Settings size={18} />
        </SidebarIcon>

        {/* Collapse toggle — only visible on group-hover of the strip */}
        {collapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] shadow-lg opacity-0 transition-all duration-150 group-hover/strip:opacity-100 hover:text-[var(--text-primary)]"
            aria-label="Expand sidebar"
          >
            <ChevronRight size={13} />
          </button>
        )}
      </div>

      {/* ── Expanded panel ── */}
      {!collapsed && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeView === "server" ? (
            <div className="flex-shrink-0">
              {/* Server banner */}
              <div
                className="relative h-16 flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${SERVER_ACCENT_COLORS[activeServerId ?? ""] ?? "#d59ee8"}55 0%, ${SERVER_ACCENT_COLORS[activeServerId ?? ""] ?? "#d59ee8"}18 100%)`,
                }}
              >
                <div className="absolute top-2 right-2 flex items-center gap-0.5">
                  <button
                    onClick={() => {}}
                    title="Invite people"
                    className="rounded p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <UserPlus size={13} />
                  </button>
                  <button
                    onClick={onToggle}
                    className="rounded p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <ChevronLeft size={15} />
                  </button>
                </div>
                {/* Server icon overlapping bottom of banner */}
                <div className="absolute -bottom-4 left-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold shadow border-2"
                    style={{ background: "var(--surface-raised)", borderColor: "var(--sidebar)" }}
                  >
                    {activeServer?.icon ?? "?"}
                  </div>
                </div>
              </div>
              {/* Server name row */}
              <div className="pl-14 pr-3 pt-1.5 pb-2.5 border-b border-[var(--border)]">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">{activeServer?.name ?? "Server"}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{activeServer?.onlineCount ?? 0} online</p>
              </div>
            </div>
          ) : (
            <div className="flex h-12 items-center justify-between border-b border-[var(--border)] px-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {activeView === "board" ? "PlanCraft" : "Direct Messages"}
              </span>
              <button
                onClick={onToggle}
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          )}

          {activeView === "board" ? (
            <DmList activeDmId={activeDmId} onDmSelect={onDmSelect} />
          ) : activeView === "server" ? (
            <ServerSidebarContent activeServerId={activeServerId} />
          ) : (
            <DmList activeDmId={activeDmId} onDmSelect={onDmSelect} />
          )}
        </div>
      )}

      {/* ── Add Server Modal (Findings #1 & #2) ── */}
      {showAddServer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddServer(false)}
          />
          {/* Modal */}
          <div
            className="fixed left-1/2 top-1/2 z-[201] w-[480px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] shadow-2xl"
            style={{ background: "var(--surface-raised)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Add a Server</h2>
              <button
                onClick={() => setShowAddServer(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5 space-y-5">

              {/* Finding #2 — Search + discover servers */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Discover Servers
                </p>
                <input
                  type="text"
                  placeholder="Search servers…"
                  value={serverSearch}
                  onChange={(e) => setServerSearch(e.target.value)}
                  className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
                <div className="grid grid-cols-1 gap-2">
                  {filteredServers.map((srv) => (
                    <div
                      key={srv.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--accent)]/50"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--surface-overlay)] text-lg">
                        {srv.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{srv.name}</p>
                          {srv.isPublic && (
                            <span className="flex-shrink-0 text-[var(--text-muted)]">
                              <Globe2 size={11} />
                            </span>
                          )}
                        </div>
                        {srv.description && (
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{srv.description}</p>
                        )}
                        <p className="text-[10px] text-[var(--text-muted)]">{srv.memberCount} members</p>
                      </div>
                      <button
                        onClick={() => {
                          onServerSelect(srv.id);
                          setShowAddServer(false);
                        }}
                        className="flex-shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
                      >
                        Join
                      </button>
                    </div>
                  ))}
                  {filteredServers.length === 0 && (
                    <p className="py-4 text-center text-xs text-[var(--text-muted)]">No servers match your search.</p>
                  )}
                </div>
              </div>

              <div className="h-px bg-[var(--border)]" />

              {/* Create a Server card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Create a Server</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Server Name</label>
                  <input
                    type="text"
                    placeholder="My Awesome Server"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Icon (emoji)</label>
                  <input
                    type="text"
                    placeholder="🚀"
                    value={newServerIcon}
                    onChange={(e) => setNewServerIcon(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNewServerPublic((v) => !v)}
                    className={cn(
                      "flex h-5 w-9 items-center rounded-full border transition-colors",
                      newServerPublic
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface-overlay)]"
                    )}
                  >
                    <span
                      className={cn(
                        "ml-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        newServerPublic ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {newServerPublic ? "Public" : "Private"}
                  </span>
                </div>
                <button
                  onClick={() => setShowAddServer(false)}
                  className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors"
                >
                  Create
                </button>
              </div>

              <div className="h-px bg-[var(--border)]" />

              {/* Join via invite card */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Join via Invite</p>
                <input
                  type="text"
                  placeholder="Enter invite code…"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                />
                <button
                  onClick={() => setShowAddServer(false)}
                  className="w-full rounded-lg border border-[var(--accent)] py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared DM list ────────────────────────────────────────────────────────────

function DmList({ activeDmId, onDmSelect }: { activeDmId: string | null; onDmSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
      <SectionHeader label="Direct Messages" icon={<MessageCircle size={12} />} />
      {DEMO_DMS.map((dm) => (
        <button
          key={dm.id}
          onClick={() => onDmSelect(dm.id)}
          className={cn(
            "group flex h-9 items-center gap-2 rounded-lg border-l-2 pl-2 pr-2 text-sm transition-colors text-left",
            activeDmId === dm.id
              ? "border-[var(--accent)] bg-[var(--surface-overlay)] text-[var(--text-primary)]"
              : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/60 hover:text-[var(--text-primary)]"
          )}
        >
          <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
            {dm.avatar}
            {/* Finding #6 — consistent presence dot */}
            <span className="absolute -bottom-0.5 -right-0.5">
              <PresenceDot online={dm.online} />
            </span>
          </span>
          <span className="flex-1 truncate">{dm.username}</span>
          {dm.unread && (
            <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {dm.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Server sidebar content ────────────────────────────────────────────────────

function ServerSidebarContent({ activeServerId }: { activeServerId: string | null }) {
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);

  const members = MOCK_SERVER_MEMBERS[activeServerId ?? ""] ?? [];
  const server = MOCK_SERVERS.find((s) => s.id === activeServerId);

  const selectBox = useBoardStore((s) => s.selectBox);
  const setPanOffset = useBoardStore((s) => s.setPanOffset);
  const zoom = useBoardStore((s) => s.zoom);
  const serverBoards = useBoardStore((s) => s.serverBoards);

  const board = server ? serverBoards[server.boardId] : undefined;
  const chatBoxes = (board?.boxes ?? []).filter((box) =>
    box.items.some((item) => item.type === "chat")
  );

  const handleChannelClick = (box: { id: string; x: number; y: number; width: number; height: number }) => {
    setActiveBoxId(box.id);
    selectBox(box.id);
    const viewportW = window.innerWidth - 240;
    const viewportH = window.innerHeight;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    setPanOffset({ x: viewportW / 2 - cx * zoom, y: viewportH / 2 - cy * zoom });
  };

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
      <SectionHeader
        label="Text Channels"
        icon={<Hash size={12} />}
        isOpen={channelsOpen}
        onToggle={() => setChannelsOpen((v) => !v)}
      />
      {channelsOpen && chatBoxes.length === 0 && (
        <p className="px-2 py-2 text-[11px] text-[var(--text-muted)] italic">No channels yet</p>
      )}
      {channelsOpen && chatBoxes.map((box) => {
        const channelName = box.items.find((i) => i.type === "chat")?.chatChannelName ?? box.title.replace(/^#/, "");
        const isActive = activeBoxId === box.id;
        return (
          <button
            key={box.id}
            onClick={() => handleChannelClick(box)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg border-l-2 pl-2 pr-2 text-sm transition-colors text-left",
              isActive
                ? "border-[var(--accent)] bg-[var(--surface-overlay)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
            )}
          >
            <Hash size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
            <span className="flex-1 truncate">{channelName}</span>
          </button>
        );
      })}

      <SectionHeader
        label="Members"
        icon={<Users size={12} />}
        isOpen={membersOpen}
        onToggle={() => setMembersOpen((v) => !v)}
      />
      {membersOpen && members.map((m) => (
        <button
          key={m.userId}
          className="flex min-h-[2.25rem] items-center gap-2 rounded-lg border-l-2 border-transparent pl-2 pr-2 py-1 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] text-left"
        >
          <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
            {m.avatar}
            <span className="absolute -bottom-0.5 -right-0.5"><PresenceDot online={m.online} /></span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-[var(--text-primary)]">{m.username}</p>
            {m.status && <p className="truncate text-[10px] text-[var(--text-muted)]">{m.status}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Section header (Finding #4 — toggleable) ──────────────────────────────────

interface SectionHeaderProps {
  label: string;
  icon: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
}

function SectionHeader({ label, icon, isOpen, onToggle }: SectionHeaderProps) {
  const hasToggle = onToggle !== undefined;
  return (
    <button
      onClick={onToggle}
      className={cn(
        "mt-2 mb-1 flex w-full items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]",
        hasToggle && "hover:text-[var(--text-secondary)] transition-colors"
      )}
      disabled={!hasToggle}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {hasToggle && (
        isOpen
          ? <ChevronDown size={10} className="flex-shrink-0" />
          : <ChevronRight size={10} className="flex-shrink-0" />
      )}
    </button>
  );
}

// ── Sidebar icon (server strip) ───────────────────────────────────────────────

interface SidebarIconProps {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  unread?: number;
  onlineCount?: number;
  isPublic?: boolean;
  onClick: () => void;
}

function SidebarIcon({ children, label, active, unread, onlineCount, isPublic, onClick }: SidebarIconProps) {
  return (
    <div className="relative group/icon">
      {/* Left-edge active pill */}
      <span
        className={cn(
          "absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-[var(--text-primary)] transition-all duration-150",
          active ? "h-8 opacity-100" : "h-2 opacity-0 group-hover/icon:opacity-60"
        )}
      />

      <button
        onClick={onClick}
        title={label}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-150",
          active
            ? "rounded-xl bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30"
            : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:rounded-xl hover:bg-[var(--accent)] hover:text-white"
        )}
      >
        {children}

        {/* Public globe badge */}
        {isPublic && !unread && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text-muted)]">
            <Globe2 size={9} />
          </span>
        )}

        {/* Unread count — top-right, capped at 9+ */}
        {unread != null && unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Tooltip — two lines when onlineCount available */}
      <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 z-50 opacity-0 group-hover/icon:opacity-100 transition-opacity duration-100">
        <div className="whitespace-nowrap rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] px-2.5 py-1.5 shadow-xl">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{label}</p>
          {onlineCount != null && (
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{onlineCount} online</p>
          )}
        </div>
      </div>
    </div>
  );
}
