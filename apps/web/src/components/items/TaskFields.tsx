"use client";

/**
 * Shared due-date + assignee UI for task-shaped items (kanban cards, list entries).
 * Items keep owning their data — these are just the common chips, picker rows,
 * and a small popover editor, so every task-shaped item renders the vocabulary
 * the same way. (Groundwork for calendar projection / Today panel.)
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarDays, X as XIcon } from "lucide-react";
import type { ServerMember } from "@/types/server";
import { useServerBoard } from "@/contexts/ServerBoardContext";
import { useUser } from "@/contexts/UserContext";
import { REMINDER_LEADS, eventStartDate, createReminder } from "@/lib/reminders";
import { cn } from "@/lib/utils";

/** Parse a YYYY-MM-DD due string as a local date (new Date("YYYY-MM-DD") is UTC). */
export function parseDue(due: string): Date {
  const [y, m, d] = due.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function dueMeta(due: string, done: boolean): { label: string; className: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((parseDue(due).getTime() - today.getTime()) / 86400000);
  const label =
    diffDays === 0 ? "Today"
    : diffDays === 1 ? "Tomorrow"
    : parseDue(due).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (done) return { label, className: "text-[var(--text-muted)] opacity-70" };
  if (diffDays < 0) return { label, className: "text-red-400" };
  if (diffDays === 0) return { label, className: "text-amber-400" };
  return { label, className: "text-[var(--text-muted)]" };
}

export function DueChip({ due, done, fontSize = 11 }: { due: string; done?: boolean; fontSize?: number }) {
  const { label, className } = dueMeta(due, !!done);
  return (
    <span className={cn("inline-flex items-center gap-1", className)} style={{ fontSize }}>
      <CalendarDays size={fontSize} className="flex-shrink-0" />
      <span className="whitespace-nowrap tabular-nums">{label}</span>
    </span>
  );
}

export function MemberAvatar({ member, size = 16, title }: { member: ServerMember; size?: number; title?: string }) {
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.55)), background: "var(--accent)" }}
      title={title ?? `Assigned to ${member.username}`}
    >
      {member.avatar?.startsWith("http")
        ? <img src={member.avatar} alt="" className="h-full w-full object-cover" />
        : member.avatar}
    </span>
  );
}

export function AssigneeRows({
  members, assigneeId, onPick,
}: { members: ServerMember[]; assigneeId?: string; onPick: (id?: string) => void }) {
  const rowCls = (active: boolean) =>
    cn(
      "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-[var(--surface-overlay)]",
      active ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
    );
  return (
    <div className="flex max-h-36 flex-col gap-0.5 overflow-y-auto">
      <button onClick={() => onPick(undefined)} className={rowCls(!assigneeId)}>
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)]">
          <XIcon size={9} />
        </span>
        Unassigned
      </button>
      {members.map((m) => (
        <button key={m.userId} onClick={() => onPick(m.userId)} className={rowCls(assigneeId === m.userId)}>
          <MemberAvatar member={m} size={16} title={m.username} />
          <span className="truncate">{m.username}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * "Remind me" lead-time buttons for anything with a due date — same UX as the
 * calendar event popup, backed by the same cron/email/push reminders pipeline.
 * All-day semantics: reminders anchor to 9:00 on the due day (see eventStartDate).
 */
export function RemindMeControl({ title, due, boardId, itemId }: {
  title: string;
  due?: string;
  boardId?: string;
  itemId?: string;
}) {
  const { identity } = useUser();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!due) return null;

  const setReminder = async (leadMs: number) => {
    const start = eventStartDate(due);
    const remindAt = new Date(start.getTime() - leadMs);
    if (remindAt.getTime() <= Date.now()) {
      setMsg("That time has already passed");
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setBusy(true);
    const res = await createReminder({
      userId: identity.userId,
      title: title.trim() || "Task",
      body: `Due ${start.toLocaleDateString()}`,
      remindAt,
      boardId,
      itemId,
      url: typeof window !== "undefined" ? window.location.origin : undefined,
    });
    setBusy(false);
    setMsg(res.ok ? "Reminder set — you'll get an email" : "Couldn't set reminder — sign in and try again");
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-2">
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Bell size={12} /> Remind me</div>
      <div className="flex flex-wrap gap-1.5">
        {REMINDER_LEADS.map((l) => (
          <button
            key={l.label}
            disabled={busy}
            onClick={() => setReminder(l.ms)}
            className="rounded border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
          >
            {l.label}
          </button>
        ))}
      </div>
      {msg && <p className="text-[11px] text-[var(--text-muted)]">{msg}</p>}
    </div>
  );
}

/** Anchored member picker for table "member" cells. */
export function MemberPickerPopover({
  x, y, assigneeId, onPick, onClose,
}: {
  x: number;
  y: number;
  assigneeId?: string;
  onPick: (id?: string) => void;
  onClose: () => void;
}) {
  const { members } = useServerBoard();
  const width = 200;
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 220));
  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        className="absolute flex flex-col gap-1 rounded-xl border border-[var(--border)] p-2 shadow-2xl"
        style={{ left, top, width, background: "var(--surface-raised)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {members.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-[var(--text-muted)]">No server members — member columns only resolve on server boards.</p>
        ) : (
          <AssigneeRows members={members} assigneeId={assigneeId} onPick={onPick} />
        )}
      </div>
    </div>,
    document.body
  );
}

/** Small anchored editor for due + assignee on inline rows (list entries). */
export function TaskFieldsPopover({
  x, y, due, assigneeId, onChange, onClose, remind,
}: {
  x: number;
  y: number;
  due?: string;
  assigneeId?: string;
  onChange: (patch: { due?: string; assigneeId?: string }) => void;
  onClose: () => void;
  /** When set, shows the "Remind me" control once a due date exists. */
  remind?: { title: string; boardId?: string; itemId: string };
}) {
  const { members } = useServerBoard();
  const width = 220;
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - 340));
  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        className="absolute flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3 shadow-2xl"
        style={{ left, top, width, background: "var(--surface-raised)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Due date</span>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={due ?? ""}
            onChange={(e) => onChange({ due: e.target.value || undefined, assigneeId })}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          {due && (
            <button
              onClick={() => onChange({ due: undefined, assigneeId })}
              className="flex-shrink-0 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Clear
            </button>
          )}
        </div>
        {members.length > 0 && (
          <>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Assignee</span>
            <AssigneeRows
              members={members}
              assigneeId={assigneeId}
              onPick={(id) => onChange({ due, assigneeId: id })}
            />
          </>
        )}
        {remind && due && (
          <RemindMeControl title={remind.title} due={due} boardId={remind.boardId} itemId={remind.itemId} />
        )}
      </div>
    </div>,
    document.body
  );
}
