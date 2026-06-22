"use client";

import { useCallback, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lock, Copy, X, ChevronDown } from "lucide-react";
import { Box, useBoardStore, useActiveBoard, resolveVars } from "@/store/boardStore";
import { ItemRenderer } from "@/components/items/ItemRenderer";
import { cn } from "@/lib/utils";

const MIN_W = 160;
const MIN_H = 100;
const GRID = 20;

function snap(v: number) { return Math.round(v / GRID) * GRID; }

interface BoardBoxProps {
  box: Box;
  boardId: string;
  isDragging: boolean;
}

export function BoardBox({ box, boardId, isDragging }: BoardBoxProps) {
  const { selectBox, removeBox, updateBox, resizeBox, addBox, bringToFront, setExpandedBox } = useBoardStore();
  const board = useActiveBoard();
  const isFinished = board?.isFinished ?? false;

  // Whole block is draggable — click fires when no drag movement (dnd-kit distance threshold)
  const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
    id: box.id,
    disabled: box.locked || isFinished,
    data: { kind: "block" },
  });

  // Droppable — accepts palette items
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${box.id}`,
    data: { kind: "block-drop-zone" },
    disabled: isFinished,
  });

  const setRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  // Resize
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (box.locked) return;
      e.stopPropagation(); e.preventDefault();
      resizing.current = true;
      resizeStart.current = { x: e.clientX, y: e.clientY, w: box.width, h: box.height };

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        setLiveSize({
          w: Math.max(MIN_W, snap(resizeStart.current.w + ev.clientX - resizeStart.current.x)),
          h: Math.max(MIN_H, snap(resizeStart.current.h + ev.clientY - resizeStart.current.y)),
        });
      };
      const onUp = (ev: MouseEvent) => {
        resizing.current = false;
        resizeBox(boardId, box.id,
          Math.max(MIN_W, snap(resizeStart.current.w + ev.clientX - resizeStart.current.x)),
          Math.max(MIN_H, snap(resizeStart.current.h + ev.clientY - resizeStart.current.y))
        );
        setLiveSize(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [boardId, box.id, box.width, box.height, box.locked, resizeBox]
  );

  const s = box.style;
  const displayW = liveSize?.w ?? box.width;
  const displayH = liveSize?.h ?? box.height;
  const transformStyle = transform ? CSS.Translate.toString(transform) : undefined;

  const wallpaperStyle: React.CSSProperties = s.wallpaperUrl
    ? {
        backgroundImage: `url(${s.wallpaperUrl})`,
        backgroundSize: s.wallpaperSize ?? "cover",
        backgroundPosition: s.wallpaperPosition ?? "center",
        backgroundRepeat: (s.wallpaperSize ?? "cover") === "auto" ? "no-repeat" : undefined,
        opacity: s.wallpaperOpacity,
      }
    : { backgroundColor: s.backgroundColor, opacity: s.wallpaperOpacity };

  const shadowMap: Record<string, string> = {
    none: "none", sm: "0 1px 3px rgba(0,0,0,0.3)", md: "0 4px 12px rgba(0,0,0,0.4)", lg: "0 8px 24px rgba(0,0,0,0.5)",
  };

  const isGlow = s.borderStyle === "glow";
  const borderCSS = isGlow ? "none" : `${s.borderWidth}px ${s.borderStyle} ${s.borderColor}`;
  const glowCSS = isGlow
    ? `0 0 ${s.borderWidth * 6}px ${s.borderColor}, 0 0 ${s.borderWidth * 14}px ${s.borderColor}66`
    : null;
  const boxShadowCSS = [glowCSS, shadowMap[s.shadow]].filter(Boolean).join(", ") || "none";

  const summaryItems = box.items.filter((i) => i.showInCollapsed);
  const vars = resolveVars(box.items);

  return (
    <div
      ref={setRef}
      {...(!box.locked && !isFinished ? listeners : {})}
      {...(!box.locked && !isFinished ? attributes : {})}
      className={cn(
        "board-box absolute group",
        isDragging && "dragging",
        isOver && !isDragging && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent"
      )}
      style={{
        left: box.x, top: box.y,
        width: displayW, height: displayH,
        zIndex: box.zIndex,
        transform: transformStyle,
        border: borderCSS,
        borderRadius: s.borderRadius,
        boxShadow: boxShadowCSS,
        fontFamily: s.fontFamily, fontSize: s.fontSize,
        color: s.fontColor,
        fontWeight: s.fontWeight === "bold" ? 700 : s.fontWeight === "medium" ? 500 : 400,
        overflow: "hidden",
        cursor: box.locked || isFinished ? "default" : "pointer",
        position: "absolute",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!isFinished) {
          selectBox(box.id);
          bringToFront(boardId, box.id);
        }
        setExpandedBox(box.id);
      }}
    >
      {/* Wallpaper layer */}
      <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none", zIndex: 0, ...wallpaperStyle }} />

      {/* Drop zone highlight */}
      {isOver && (
        <div aria-hidden className="absolute inset-0 z-10 rounded-[inherit] border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/10 flex items-center justify-center pointer-events-none">
          <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white shadow">Drop to add item</span>
        </div>
      )}

      {/* Floating controls — top-right, appear on hover */}
      {!isFinished && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); updateBox(boardId, box.id, { locked: !box.locked }); }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white backdrop-blur-sm transition-colors"
            title={box.locked ? "Unlock" : "Lock"}
          >
            <Lock size={11} className={box.locked ? "text-[var(--accent)]" : ""} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); addBox(boardId, { ...box, x: box.x + 24, y: box.y + 24, title: box.title + " (copy)" }); }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white/60 hover:text-white backdrop-blur-sm transition-colors"
            title="Duplicate"
          >
            <Copy size={11} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeBox(boardId, box.id); }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 text-white hover:bg-red-500 backdrop-blur-sm transition-colors"
            title="Delete"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Block title — bottom-left, always visible but subtle */}
      {box.title && (
        <div
          aria-hidden
          className="absolute bottom-2 left-3 z-10 max-w-[65%] truncate text-[11px] font-semibold pointer-events-none select-none"
          style={{ color: s.fontColor, opacity: 0.5 }}
        >
          {box.title}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-auto" style={{ padding: s.padding }}>
        {summaryItems.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center pointer-events-none">
            {box.items.length === 0 ? (
              !isFinished && <p className="text-xs" style={{ color: s.fontColor, opacity: 0.4 }}>Click to open</p>
            ) : (
              <>
                <p className="text-xs" style={{ color: s.fontColor, opacity: 0.5 }}>{box.items.length} item{box.items.length !== 1 ? "s" : ""}</p>
                {!isFinished && <p className="text-[10px]" style={{ color: s.fontColor, opacity: 0.3 }}>Click to expand</p>}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {summaryItems.map((item) => (
              <ItemRenderer key={item.id} item={item} boardId={boardId} boxId={box.id} vars={vars} collapsed isFinished={isFinished} />
            ))}
            {box.items.length > summaryItems.length && (
              <span className="flex items-center gap-1 text-[10px] pointer-events-none" style={{ opacity: 0.4 }}>
                <ChevronDown size={11} />
                {box.items.length - summaryItems.length} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!isFinished && !box.locked && (
        <div
          onMouseDown={onResizeMouseDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute", right: 0, bottom: 0,
            width: 16, height: 16, cursor: "se-resize",
            background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.25) 50%)",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
}
