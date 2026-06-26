"use client";

import { useState } from "react";
import {
  UserCircle2, Users, Plus, Menu,
  Layers, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_SERVERS } from "@/lib/mockServerData";

interface BottomBarProps {
  activeView: "board" | "server" | "dm" | "friends";
  activeServerId: string | null;
  onViewChange: (v: "board" | "server" | "dm" | "friends") => void;
  onServerSelect: (id: string) => void;
  onSettingsOpen: () => void;
  onTemplatesOpen: () => void;
  showMembers: boolean;
  onToggleMembers: () => void;
}

export function BottomBar({
  activeView, activeServerId,
  onViewChange, onServerSelect,
  onSettingsOpen, onTemplatesOpen,
  showMembers, onToggleMembers,
}: BottomBarProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showServerGrid, setShowServerGrid] = useState(false);

  return (
    <>
      {/* Profile popup backdrop */}
      {showProfile && (
        <div className="fixed inset-0 z-[998]" onClick={() => setShowProfile(false)} />
      )}

      {/* Profile popup — floats above the bar */}
      {showProfile && (
        <div
          className="fixed z-[999] flex flex-col gap-0.5 rounded-2xl border border-[var(--border)] p-2 shadow-2xl"
          style={{ bottom: 60, left: 12, background: "var(--surface-raised)", minWidth: 168 }}
        >
          <PopupBtn label="Edit profile" onClick={() => setShowProfile(false)} />
          <PopupBtn label="Settings" onClick={() => { setShowProfile(false); onSettingsOpen(); }} />
          <PopupBtn label="Status" onClick={() => setShowProfile(false)} />
          <div className="my-1 h-px bg-[var(--border)]" />
          <PopupBtn label="Templates" onClick={() => { setShowProfile(false); onTemplatesOpen(); }} />
        </div>
      )}

      {/* Server grid modal */}
      {showServerGrid && (
        <ServerGridModal
          servers={MOCK_SERVERS.map((s) => ({ id: s.id, name: s.name, icon: s.icon, online: s.onlineCount }))}
          onServerSelect={(id) => { setShowServerGrid(false); onServerSelect(id); }}
          onClose={() => setShowServerGrid(false)}
        />
      )}

      {/* Bottom bar */}
      <div
        className="flex h-[52px] flex-shrink-0 items-center gap-1 border-t border-[var(--border)] px-3"
        style={{ background: "var(--surface-raised)", position: "relative", zIndex: 1 }}
      >
        {/* Profile avatar */}
        <button
          onClick={() => setShowProfile((v) => !v)}
          title="Profile"
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all duration-150",
            showProfile
              ? "ring-2 ring-[var(--accent)] text-[var(--accent)]"
              : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--accent)] hover:text-white"
          )}
        >
          <UserCircle2 size={20} />
        </button>

        <Divider />

        {/* Boards */}
        <BarBtn
          label="Personal Boards"
          active={activeView === "board"}
          onClick={() => onViewChange("board")}
          icon={<Layers size={18} />}
        />

        {/* Friends */}
        <BarBtn
          label="Friends"
          active={activeView === "friends"}
          onClick={() => onViewChange("friends")}
          icon={<Users size={18} />}
        />

        <Divider />

        {/* Pinned servers */}
        {MOCK_SERVERS.map((srv) => (
          <BarBtn
            key={srv.id}
            label={`${srv.name} · ${srv.onlineCount} online`}
            active={activeView === "server" && activeServerId === srv.id}
            onClick={() => onServerSelect(srv.id)}
          >
            <span className="text-xs font-bold leading-none">{srv.icon}</span>
          </BarBtn>
        ))}

        {/* Browse servers */}
        <BarBtn
          label="Browse servers"
          onClick={() => setShowServerGrid(true)}
          icon={<Plus size={17} className="text-[var(--text-muted)]" />}
        />

        <div className="flex-1" />

        {/* Channel list + members toggles (only in server view) */}
        {activeView === "server" && (
          <BarBtn
            label={showMembers ? "Hide members" : "Show members"}
            active={showMembers}
            onClick={onToggleMembers}
            icon={<Menu size={17} />}
          />
        )}
      </div>
    </>
  );
}

function Divider() {
  return <div className="h-5 w-px flex-shrink-0 bg-[var(--border)] mx-0.5" />;
}

function BarBtn({
  children, icon, label, active, unread, onClick,
}: {
  children?: React.ReactNode;
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  unread?: number;
  onClick: () => void;
}) {
  return (
    <div className="group relative flex-shrink-0">
      <button
        onClick={onClick}
        title={label}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150",
          active
            ? "bg-[var(--accent)] text-white"
            : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
        )}
      >
        {icon ?? children}
        {!!unread && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-xs text-[var(--text-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-50">
        {label}
      </div>
    </div>
  );
}

function PopupBtn({ label, onClick }: { icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] text-left"
    >
      {label}
    </button>
  );
}

function ServerGridModal({
  servers, onServerSelect, onClose,
}: {
  servers: { id: string; name: string; icon: string; online?: number }[];
  onServerSelect: (id: string) => void;
  onClose: () => void;
}) {
  const placeholders = Math.max(0, 6 - servers.length);

  return (
    <div className="fixed inset-0 z-[998] flex items-end justify-center pb-[60px]" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-xl rounded-2xl border border-[var(--border)] p-5 shadow-2xl"
        style={{ background: "var(--surface-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Discover Servers</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {servers.map((srv) => (
            <button
              key={srv.id}
              onClick={() => onServerSelect(srv.id)}
              className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] text-left transition-all hover:border-[var(--accent)] hover:scale-[1.02] active:scale-[0.99]"
              style={{ background: "var(--surface)" }}
            >
              {/* Banner */}
              <div
                className="relative flex h-[90px] items-center justify-center"
                style={{ background: "var(--surface-overlay)" }}
              >
                <span className="text-3xl select-none">{srv.icon}</span>
                {srv.online !== undefined && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                    {srv.online} online
                  </span>
                )}
              </div>
              {/* Name */}
              <div className="px-2.5 py-2">
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{srv.name}</p>
              </div>
            </button>
          ))}

          {/* Empty slot cards */}
          {Array.from({ length: placeholders }).map((_, i) => (
            <div
              key={`ph-${i}`}
              className="flex h-[122px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)]"
            >
              <Plus size={16} className="text-[var(--text-muted)]" />
              <p className="text-[10px] text-[var(--text-muted)]">Join a server</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
