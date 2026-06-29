"use client";

import { useState } from "react";
import { Crown, X } from "lucide-react";
import type { BoxPerms, ItemPerms } from "@/store/boardStore";
import { useServerBoard } from "@/contexts/ServerBoardContext";
import { cn } from "@/lib/utils";

// ─── Role toggle selector ─────────────────────────────────────────────────────

/**
 * null  = no restriction (saves as undefined)
 * string[] = specific ServerRole IDs (empty = owner-only)
 */
type PermValue = string[] | null;

function initPerm(arr?: string[]): PermValue {
  return arr === undefined ? null : arr;
}

function savePerm(v: PermValue): string[] | undefined {
  return v === null ? undefined : v;
}

function RoleSelector({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: PermValue;
  onChange: (v: PermValue) => void;
}) {
  const { serverRoles } = useServerBoard();
  const isEveryone = value === null;

  function toggle(roleId: string) {
    if (isEveryone) {
      // Coming from "everyone" — switch to just this one role
      onChange([roleId]);
      return;
    }
    const current = value as string[];
    const next = current.includes(roleId)
      ? current.filter((id) => id !== roleId)
      : [...current, roleId];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[12px] font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="text-[10px] text-[var(--text-muted)]">{description}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {/* Everyone (no restriction) chip */}
        <button
          onClick={() => onChange(null)}
          className={cn(
            "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all border",
            isEveryone
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
          )}
          title="All members can perform this action"
        >
          @everyone
        </button>

        {/* Individual server roles */}
        {serverRoles.map((role) => {
          const selected = !isEveryone && (value as string[]).includes(role.id);
          return (
            <button
              key={role.id}
              onClick={() => toggle(role.id)}
              title={role.name}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-all border",
                selected
                  ? "text-white border-transparent"
                  : isEveryone
                    ? "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] opacity-40"
                    : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
              )}
              style={selected ? { background: role.color, borderColor: role.color } : undefined}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: selected ? "rgba(255,255,255,0.7)" : role.color }}
              />
              {role.name}
            </button>
          );
        })}

        {/* Owner always chip — informational */}
        <span
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium border border-[var(--border)] text-[var(--text-muted)] opacity-60 cursor-default"
          title="Owner always has access"
        >
          <Crown size={9} />
          Owner
        </span>
      </div>

      {serverRoles.length === 0 && !isEveryone && (
        <p className="text-[10px] text-[var(--text-muted)] italic">No custom roles — create roles in server settings.</p>
      )}
    </div>
  );
}

// ─── Box permissions modal ────────────────────────────────────────────────────

interface BoxPermModalProps {
  targetLabel: string;
  initialPerms?: BoxPerms;
  onSave: (perms: BoxPerms) => void;
  onClose: () => void;
}

export function BoxPermissionModal({ targetLabel, initialPerms, onSave, onClose }: BoxPermModalProps) {
  const [edit,     setEdit]     = useState<PermValue>(initPerm(initialPerms?.edit));
  const [interact, setInteract] = useState<PermValue>(initPerm(initialPerms?.interact));

  return (
    <PermModalShell title="Block Permissions" subtitle={targetLabel} onClose={onClose}
      onSave={() => { onSave({ edit: savePerm(edit), interact: savePerm(interact) }); onClose(); }}>
      <RoleSelector label="Edit" description="Who can add, remove, and rearrange items" value={edit} onChange={setEdit} />
      <RoleSelector label="Interact" description="Who can interact with items inside (click, toggle, play)" value={interact} onChange={setInteract} />
    </PermModalShell>
  );
}

// ─── Item permissions modal ───────────────────────────────────────────────────

interface ItemPermModalProps {
  targetLabel: string;
  initialPerms?: ItemPerms;
  onSave: (perms: ItemPerms) => void;
  onClose: () => void;
}

export function ItemPermissionModal({ targetLabel, initialPerms, onSave, onClose }: ItemPermModalProps) {
  const [edit,     setEdit]     = useState<PermValue>(initPerm(initialPerms?.edit));
  const [input,    setInput]    = useState<PermValue>(initPerm(initialPerms?.input));
  const [interact, setInteract] = useState<PermValue>(initPerm(initialPerms?.interact));

  return (
    <PermModalShell title="Item Permissions" subtitle={targetLabel} onClose={onClose}
      onSave={() => { onSave({ edit: savePerm(edit), input: savePerm(input), interact: savePerm(interact) }); onClose(); }}>
      <RoleSelector label="Edit" description="Who can edit settings and style" value={edit} onChange={setEdit} />
      <RoleSelector label="Text entry" description="Who can type or enter text" value={input} onChange={setInput} />
      <RoleSelector label="Interact" description="Who can click, toggle, and use this item" value={interact} onChange={setInteract} />
    </PermModalShell>
  );
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

function PermModalShell({
  title, subtitle, onClose, onSave, children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[380px] rounded-xl border border-[var(--border)] shadow-2xl flex flex-col"
        style={{ background: "var(--surface-raised)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 py-3.5 border-b border-[var(--border)]">
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate max-w-[300px]">{subtitle}</p>
          </div>
          <button onClick={onClose} className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-4 py-4">
          {children}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
