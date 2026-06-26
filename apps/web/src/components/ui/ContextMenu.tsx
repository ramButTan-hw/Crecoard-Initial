"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  children?: ContextMenuItem[];
}

export type ContextMenuEntry = ContextMenuItem | "separator";

interface Props {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

function Submenu({
  items,
  parentRect,
  onClose,
}: {
  items: ContextMenuItem[];
  parentRect: DOMRect;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    // Try right side first, flip to left if no room
    let left = parentRect.right;
    let top = parentRect.top;
    if (left + rect.width > window.innerWidth - pad) left = parentRect.left - rect.width;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[10000] min-w-[180px] overflow-hidden rounded-xl border border-[var(--border)] py-1.5 shadow-2xl"
      style={{ left: 0, top: 0, background: "var(--surface-raised)", backdropFilter: "blur(16px)" }}
      onMouseDown={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.disabled}
          onClick={() => { if (!item.disabled && item.onClick) { item.onClick(); onClose(); } }}
          className={cn(
            "flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-left outline-none",
            item.danger
              ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
            item.disabled && "opacity-40 pointer-events-none"
          )}
        >
          {item.icon && (
            <span className={cn("shrink-0", item.danger ? "text-red-400" : "text-[var(--text-muted)]")}>
              {item.icon}
            </span>
          )}
          <span className="flex-1">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

function MenuRow({
  item,
  onClose,
}: {
  item: ContextMenuItem;
  onClose: () => void;
}) {
  const [showSub, setShowSub] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={rowRef}
      disabled={item.disabled}
      onMouseEnter={() => item.children && setShowSub(true)}
      onMouseLeave={() => item.children && setShowSub(false)}
      onClick={() => {
        if (item.disabled) return;
        if (item.children) return; // submenu parent — no direct action
        item.onClick?.();
        onClose();
      }}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-1.5 text-sm transition-colors text-left outline-none",
        item.danger
          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
        item.disabled && "opacity-40 pointer-events-none"
      )}
    >
      {item.icon && (
        <span className={cn("shrink-0", item.danger ? "text-red-400" : "text-[var(--text-muted)]")}>
          {item.icon}
        </span>
      )}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-[10px] text-[var(--text-muted)] font-mono">{item.shortcut}</span>
      )}
      {item.children && <ChevronRight size={12} className="text-[var(--text-muted)] ml-1 shrink-0" />}
      {showSub && item.children && rowRef.current && (
        <Submenu
          items={item.children}
          parentRect={rowRef.current.getBoundingClientRect()}
          onClose={onClose}
        />
      )}
    </button>
  );
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown, { capture: true });
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-xl border border-[var(--border)] py-1.5 shadow-2xl"
      style={{ left: x, top: y, background: "var(--surface-raised)", backdropFilter: "blur(16px)" }}
      onMouseDown={e => e.stopPropagation()}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === "separator" ? (
          <div key={i} className="my-1 border-t border-[var(--border)]" />
        ) : (
          <MenuRow key={i} item={item} onClose={onClose} />
        )
      )}
    </div>,
    document.body
  );
}
