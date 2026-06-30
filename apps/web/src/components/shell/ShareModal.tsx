"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Link2, Check, Users, Globe,
  Wifi, WifiOff, UserCircle2,
} from "lucide-react";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";
import { useCollab } from "@/lib/useCollabSession";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
}

function Avatar({ name, color, size = 28 }: { name: string; color: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}

export function ShareModal({ onClose }: Props) {
  const { activeBoardId, updateBoard, sharedBoardIds } = useBoardStore();
  const board = useActiveBoard();
  const { members, self, isConnected, updateDisplayName } = useCollab();

  // A board shared *with* us (we're a collaborator, not the owner) can't be re-shared.
  const isSharedWithMe = sharedBoardIds.includes(activeBoardId);

  const [copied, setCopied] = useState(false);
  const [nameInput, setNameInput] = useState(self.displayName);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(self.displayName);
  }, [self.displayName]);

  // Create (or fetch) a real share link for boards we own. Opening it grants the
  // visitor edit access, so we also switch on live collaboration.
  useEffect(() => {
    if (!activeBoardId || isSharedWithMe) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("create_board_share", { p_board_id: activeBoardId });
      if (cancelled) return;
      if (error || !data) { setLinkError(true); return; }
      const origin = typeof window !== "undefined" ? window.location.origin : "https://crecoard.com";
      setShareUrl(`${origin}/board/${data}`);
      if (!board?.collabEnabled) updateBoard(activeBoardId, { collabEnabled: true });
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBoardId, isSharedWithMe]);

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveName = () => {
    const name = nameInput.trim();
    if (name) updateDisplayName(name);
    nameRef.current?.blur();
  };

  const allMembers = [
    { ...self, displayName: self.displayName + " (you)", isYou: true },
    ...members.map(m => ({ ...m, isYou: false })),
  ];

  return (
    <>
      <div className="fixed inset-0 z-[1998] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1999] w-full max-w-md rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
        style={{ background: "var(--surface-raised)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Users size={18} className="text-[var(--accent)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Share board</h2>
              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[240px]">{board?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5 max-h-[70vh] overflow-y-auto">

          {/* Share link */}
          {isSharedWithMe ? (
            <section className="rounded-xl border border-[var(--border)] p-4 text-center" style={{ background: "var(--surface)" }}>
              <p className="text-sm text-[var(--text-secondary)]">This board was shared with you. Only its owner can manage the share link.</p>
            </section>
          ) : (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Share link</span>
                <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium bg-[var(--accent)]/10 text-[var(--accent)]">
                  <Globe size={11} /> Anyone with link can edit
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)] px-3 py-2 min-w-0">
                  <Link2 size={13} className="text-[var(--text-muted)] shrink-0" />
                  <span className="text-xs text-[var(--text-secondary)] truncate font-mono">
                    {linkError ? "Couldn't create a link" : shareUrl ?? "Generating link…"}
                  </span>
                </div>
                <button
                  onClick={copyLink}
                  disabled={!shareUrl}
                  className={cn(
                    "shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all",
                    copied
                      ? "bg-green-500/10 text-green-400"
                      : "bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {copied ? <Check size={13} /> : <Link2 size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)]">Anyone signed in who opens this link can view and edit this board.</p>
            </section>
          )}

          {/* Live collab toggle */}
          <section className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--surface)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConnected
                  ? <Wifi size={15} className="text-green-400" />
                  : <WifiOff size={15} className="text-[var(--text-muted)]" />
                }
                <span className="text-sm font-semibold text-[var(--text-primary)]">Live collaboration</span>
              </div>
              <button
                role="switch"
                aria-checked={board?.collabEnabled ?? false}
                onClick={() => updateBoard(activeBoardId, { collabEnabled: !(board?.collabEnabled) })}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                  board?.collabEnabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                )}
              >
                <span className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                  board?.collabEnabled ? "translate-x-[18px]" : "translate-x-[2px]"
                )} />
              </button>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Sync cursors and edits in real time with everyone who has the link.
            </p>
            {board?.collabEnabled && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-green-400" : "bg-yellow-400")} />
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {isConnected
                    ? `Connected · ${allMembers.length} ${allMembers.length === 1 ? "person" : "people"}`
                    : "Connecting…"}
                </span>
              </div>
            )}
          </section>

          {/* Online now */}
          {board?.collabEnabled && (
            <section className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Online now</span>
              <div className="flex flex-col gap-1">
                {allMembers.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--surface-overlay)] transition-colors">
                    <div className="relative">
                      <Avatar name={m.displayName} color={m.color} size={32} />
                      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-400 border-2" style={{ borderColor: "var(--surface-raised)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">{m.displayName}</p>
                    </div>
                    {m.isYou && (
                      <span className="text-[10px] rounded-full bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 font-semibold">You</span>
                    )}
                  </div>
                ))}
                {allMembers.length === 1 && (
                  <p className="text-[11px] text-[var(--text-muted)] px-3">Share the link to invite others.</p>
                )}
              </div>
            </section>
          )}

          {/* Your display name */}
          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Your display name</span>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)] px-3 py-2">
                <UserCircle2 size={14} className="text-[var(--text-muted)] shrink-0" />
                <input
                  ref={nameRef}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveName(); }}
                  placeholder="Your name"
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
              </div>
              <button
                onClick={saveName}
                className="shrink-0 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Shown to collaborators when Live collaboration is on.</p>
          </section>

        </div>
      </div>
    </>
  );
}
