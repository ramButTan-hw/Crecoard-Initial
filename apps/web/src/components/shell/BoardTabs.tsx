"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import { cn } from "@/lib/utils";

export function BoardTabs() {
  const { boards, activeBoardId, setActiveBoard, addBoard, removeBoard } = useBoardStore();
  const hasAppBg = useBoardStore((s) => !!s.appBg.image);

  const handleAddBoard = () => {
    const name = `Board ${boards.length + 1}`;
    addBoard(name);
  };

  return (
    <div
      className="flex h-9 items-center gap-0.5 border-b border-[var(--border)] px-2 overflow-x-auto flex-shrink-0"
      style={{ background: hasAppBg ? "transparent" : "var(--surface-raised)" }}
    >
      {boards.map((board) => (
        <div
          key={board.id}
          className={cn(
            "group flex h-7 max-w-[180px] min-w-[100px] items-center gap-1.5 rounded-t px-3 text-sm cursor-pointer select-none transition-colors flex-shrink-0",
            board.id === activeBoardId
              ? "bg-[var(--surface)] text-[var(--text-primary)] border border-b-transparent border-[var(--border)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
          )}
          onClick={() => setActiveBoard(board.id)}
        >
          {board.isPublic ? (
            <span className="text-[10px] text-green-400" title="Public">●</span>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]" title="Private">●</span>
          )}
          <span className="flex-1 truncate">{board.name}</span>
          {boards.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); removeBoard(board.id); }}
              className="opacity-0 group-hover:opacity-100 rounded p-0.5 hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
      <button
        onClick={handleAddBoard}
        className="ml-1 flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
        title="New board"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
