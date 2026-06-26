"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Users, Shield, Crown, Eye, Edit3, ChevronDown, UserCircle2, X, CheckCircle2, Settings, ZoomIn, ZoomOut, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/boardStore";
import { useServerBoard, useServerBoardData } from "@/contexts/ServerBoardContext";
import type { MemberRole, ServerMember } from "@/types/server";
import { ServerSettings } from "./ServerSettings";

interface ServerBoardHeaderProps {
  serverId: string;
  serverName: string;
  serverIcon: string;
  description: string;
  memberCount: number;
  onlineCount: number;
  viewerRole: MemberRole;
  members: ServerMember[];
  showMembers: boolean;
  onToggleMembers: () => void;
  /** Demo-only: lets you switch role to preview member vs admin view */
  onRoleToggle: (role: MemberRole) => void;
}

const ROLE_COLORS: Record<MemberRole, string> = {
  owner:  "text-yellow-400",
  admin:  "text-[var(--accent)]",
  member: "text-[var(--text-muted)]",
};

const ROLE_ICONS: Record<MemberRole, React.ReactNode> = {
  owner:  <Crown  size={12} />,
  admin:  <Shield size={12} />,
  member: <Eye    size={12} />,
};

export function ServerBoardHeader({
  serverId, serverName, serverIcon, description,
  memberCount, onlineCount, viewerRole,
  members, showMembers, onToggleMembers, onRoleToggle,
}: ServerBoardHeaderProps) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showMemberPanel, setShowMemberPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const roleButtonRef = useRef<HTMLButtonElement>(null);
  const [roleMenuPos, setRoleMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => { setIsDesktop(!!window.electron); }, []);

  const canEdit = viewerRole === "owner" || viewerRole === "admin";

  const { finishBoard, editBoard, activeBoardId, showGrid, zoom, toggleGrid, setZoom, zoomAtCanvasCenter } = useBoardStore();
  const serverBoard = useServerBoardData();
  const isFinished = serverBoard?.isFinished ?? false;
  // Use the server's boardId for finish/edit mutations, not the personal activeBoardId
  const { boardId: serverBoardId } = useServerBoard();

  return (
    <>
      <div
        className={cn("flex h-11 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-4", isDesktop && "select-none")}
        style={{ background: "var(--surface-raised)", position: "relative", zIndex: 2, ...(isDesktop ? { WebkitAppRegion: "drag" } as React.CSSProperties : {}) }}
      >
        {/* Server identity */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--surface-overlay)] text-sm font-bold select-none">
            {serverIcon}
          </span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">{serverName}</span>
        </div>

        {description && (
          <>
            <div className="h-4 w-px flex-shrink-0 bg-[var(--border)]" />
            <span className="truncate text-xs text-[var(--text-muted)] max-w-[260px]">{description}</span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2" style={isDesktop ? { WebkitAppRegion: "no-drag" } as React.CSSProperties : undefined}>
          {/* View controls: zoom, grid, ruler */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => zoomAtCanvasCenter(zoom - 0.25)}
              title="Zoom out"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ZoomOut size={13} />
            </button>
            <button
              onClick={() => zoomAtCanvasCenter(1)}
              title="Reset zoom"
              className="min-w-[38px] text-center text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-1 h-6 rounded hover:bg-[var(--surface-overlay)]"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => zoomAtCanvasCenter(zoom + 0.25)}
              title="Zoom in"
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ZoomIn size={13} />
            </button>
          </div>
          <button
            onClick={() => toggleGrid()}
            title={showGrid ? "Hide grid" : "Show grid"}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              showGrid
                ? "text-[var(--accent)] bg-[var(--surface-overlay)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
            )}
          >
            <Grid3X3 size={13} />
          </button>
          <div className="h-4 w-px bg-[var(--border)]" />

          {/* Online indicator */}
          <button
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => setShowMemberPanel((v) => !v)}
            title="Members"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
            {onlineCount} online
            <Users size={12} />
          </button>

          {/* Role badge + demo toggle */}
          <div className="relative">
            <button
              ref={roleButtonRef}
              onClick={() => {
                if (!showRoleMenu) {
                  const rect = roleButtonRef.current?.getBoundingClientRect();
                  setRoleMenuPos(rect ? { top: rect.bottom + 4, right: window.innerWidth - rect.right } : { top: 48, right: 8 });
                }
                setShowRoleMenu((v) => !v);
              }}
              className={cn(
                "flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors hover:bg-[var(--surface-overlay)]",
                ROLE_COLORS[viewerRole],
                canEdit ? "border-[var(--accent)]/40" : "border-[var(--border)]"
              )}
              title="Your role (click to preview as different role)"
            >
              {ROLE_ICONS[viewerRole]}
              {viewerRole}
              <ChevronDown size={10} className="opacity-60" />
            </button>

            {showRoleMenu && typeof document !== "undefined" && createPortal(
              <>
                <div className="fixed inset-0 z-[9990]" onClick={() => setShowRoleMenu(false)} />
                <div
                  className="fixed z-[9991] rounded-xl border border-[var(--border)] p-1 shadow-xl"
                  style={{ background: "var(--surface-raised)", minWidth: 160, top: roleMenuPos?.top ?? 48, right: roleMenuPos?.right ?? 8 }}
                >
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Preview as role
                  </p>
                  {(["owner", "admin", "member"] as MemberRole[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => { onRoleToggle(r); setShowRoleMenu(false); }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-[var(--surface-overlay)]",
                        r === viewerRole ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"
                      )}
                    >
                      <span className={ROLE_COLORS[r]}>{ROLE_ICONS[r]}</span>
                      <span className="capitalize">{r}</span>
                      {r === viewerRole && <span className="ml-auto text-[10px] text-[var(--accent)]">current</span>}
                    </button>
                  ))}
                </div>
              </>,
              document.body
            )}
          </div>

          {/* Edit Mode / Finish — admins only */}
          {canEdit && (
            <>
              <div className="h-4 w-px bg-[var(--border)]" />
              {isFinished ? (
                <button
                  onClick={() => editBoard(serverBoardId ?? activeBoardId)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
                >
                  <Edit3 size={12} /> Edit Mode
                </button>
              ) : (
                <button
                  onClick={() => finishBoard(serverBoardId ?? activeBoardId)}
                  className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
                >
                  <CheckCircle2 size={12} /> Finish
                </button>
              )}
            </>
          )}

          {/* Members panel toggle */}
          <button
            onClick={onToggleMembers}
            title={showMembers ? "Hide members" : "Show members"}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              showMembers
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
            )}
          >
            <UserCircle2 size={15} />
          </button>

          {/* Settings — admins/owners only */}
          {canEdit && (
            <button
              onClick={() => setShowSettings(true)}
              title="Server settings"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Settings size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Members flyout panel */}
      {showMemberPanel && (
        <>
          <div className="fixed inset-0 z-[48]" onClick={() => setShowMemberPanel(false)} />
          <div
            className="absolute right-4 top-11 z-[49] w-[220px] rounded-xl border border-[var(--border)] shadow-2xl"
            style={{ background: "var(--surface-raised)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">Members · {memberCount}</span>
              <button onClick={() => setShowMemberPanel(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X size={13} />
              </button>
            </div>
            <div className="max-h-[320px] overflow-y-auto p-2">
              <MemberSection label="Online" members={members.filter((m) => m.online)} />
              <MemberSection label="Offline" members={members.filter((m) => !m.online)} />
            </div>
          </div>
        </>
      )}

      {/* Server settings modal */}
      {showSettings && (
        <ServerSettings serverId={serverId} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}

function MemberSection({ label, members }: { label: string; members: ServerMember[] }) {
  if (members.length === 0) return null;
  return (
    <>
      <p className="mt-2 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label} — {members.length}
      </p>
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--surface-overlay)] transition-colors">
          <div className="relative">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">
              {m.avatar}
            </span>
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-raised)]",
              m.online ? "bg-green-500" : "bg-[var(--text-muted)]"
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--text-primary)]">{m.username}</p>
            {m.status && <p className="truncate text-[10px] text-[var(--text-muted)]">{m.status}</p>}
          </div>
          <span className={cn("text-[10px] capitalize", ROLE_COLORS[m.role])}>{m.role === "owner" ? "👑" : m.role === "admin" ? "🛡" : ""}</span>
        </div>
      ))}
    </>
  );
}
