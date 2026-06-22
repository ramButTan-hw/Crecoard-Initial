"use client";

import { useState } from "react";
import {
  Globe, Lock, Grid3X3, Ruler, ZoomIn, ZoomOut,
  Pencil, CheckCircle2, Edit3, Palette,
} from "lucide-react";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";

import { ThemePanel } from "./ThemePanel";
import { cn } from "@/lib/utils";

export function TopBar() {
  const {
    showGrid, showRuler, zoom,
    toggleGrid, toggleRuler, setZoom,
    updateBoard, finishBoard, editBoard,
    activeBoardId,
  } = useBoardStore();
  const hasAppBg = useBoardStore((s) => !!s.appBg.image);
  const board = useActiveBoard();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(board?.name ?? "");
  const [showThemePanel, setShowThemePanel] = useState(false);

  const commitName = () => {
    if (nameInput.trim()) updateBoard(activeBoardId, { name: nameInput.trim() });
    setEditingName(false);
  };

  const isFinished = board?.isFinished ?? false;

  return (
    <>
      <div className="flex h-11 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 relative z-40" style={{ background: hasAppBg ? "transparent" : "var(--surface-raised)" }}>
        {/* Board name */}
        <div className="flex items-center gap-1.5">
          {editingName ? (
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === "Enter" && commitName()}
              className="rounded border border-[var(--accent)] bg-[var(--surface)] px-2 py-0.5 text-sm text-[var(--text-primary)] outline-none w-40"
            />
          ) : (
            <button
              onClick={() => { if (!isFinished) { setNameInput(board?.name ?? ""); setEditingName(true); } }}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] transition-colors"
            >
              {board?.name}
              {!isFinished && <Pencil size={12} className="text-[var(--text-muted)]" />}
            </button>
          )}
        </div>

        {/* Public / Private */}
        {!isFinished && (
          <button
            onClick={() => updateBoard(activeBoardId, { isPublic: !board?.isPublic })}
            className={cn("flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors", board?.isPublic ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--border)]")}
          >
            {board?.isPublic ? <Globe size={13} /> : <Lock size={13} />}
            {board?.isPublic ? "Public" : "Private"}
          </button>
        )}

        {!isFinished && <div className="h-5 w-px bg-[var(--border)]" />}

        {/* Grid / Ruler toggles */}
        {!isFinished && (
          <>
            <ToolbarButton active={showGrid} onClick={toggleGrid} title="Toggle grid"><Grid3X3 size={15} /></ToolbarButton>
            <ToolbarButton active={showRuler} onClick={toggleRuler} title="Toggle ruler"><Ruler size={15} /></ToolbarButton>
            <div className="h-5 w-px bg-[var(--border)]" />
          </>
        )}

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={() => setZoom(Math.max(0.25, zoom - 0.1))} title="Zoom out"><ZoomOut size={15} /></ToolbarButton>
          <button
            onClick={() => setZoom(1)}
            className="min-w-[46px] text-center rounded px-1.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-colors font-mono"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolbarButton onClick={() => setZoom(Math.min(3, zoom + 0.1))} title="Zoom in"><ZoomIn size={15} /></ToolbarButton>
        </div>

        <div className="flex-1" />

        {/* Board theme */}
        <ToolbarButton
          onClick={() => setShowThemePanel((v) => !v)}
          title="Board theme"
          active={showThemePanel}
        >
          <Palette size={15} />
        </ToolbarButton>

        <div className="h-5 w-px bg-[var(--border)]" />

        {/* Finish / Edit */}
        {isFinished ? (
          <button
            onClick={() => editBoard(activeBoardId)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
          >
            <Edit3 size={14} /> Edit
          </button>
        ) : (
          <button
            onClick={() => finishBoard(activeBoardId)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors shadow-sm"
          >
            <CheckCircle2 size={14} /> Finish
          </button>
        )}
      </div>

      {showThemePanel && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setShowThemePanel(false)} />
          <ThemePanel onClose={() => setShowThemePanel(false)} />
        </>
      )}
    </>
  );
}

function ToolbarButton({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center rounded p-1.5 transition-colors",
        active
          ? "bg-[var(--accent)]/20 text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}
