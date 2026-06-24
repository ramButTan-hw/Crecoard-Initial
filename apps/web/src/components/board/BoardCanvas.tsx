"use client";

import { useCallback, useRef, useState } from "react";
import {
  LayoutGrid, Palette, Share2, Clipboard,
  ScanSearch, SquarePlus, Layers,
} from "lucide-react";
import { useBoardStore, useActiveBoard, DEFAULT_BOX_STYLE } from "@/store/boardStore";
import { useCollab } from "@/lib/useCollabSession";
import { ContextMenu } from "@/components/ui/ContextMenu";
import type { CursorState } from "@/lib/collaboration";
import { BoardBox } from "./BoardBox";
import { Ruler } from "./Ruler";
import { cn } from "@/lib/utils";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/boardConstants";

// ─── Remote cursor overlay ────────────────────────────────────────────────────

function CursorSvg({ color }: { color: string }) {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }}>
      <path d="M 0 0 L 0 16 L 3.5 12 L 7 20 L 9 19 L 5.5 11 L 11 11 Z" fill={color} stroke="white" strokeWidth="0.8" />
    </svg>
  );
}

function CollabCursors({ cursors, zoom }: { cursors: CursorState[]; zoom: number }) {
  return (
    <>
      {cursors.map(c => (
        <div key={c.userId} className="absolute pointer-events-none" style={{ left: c.x, top: c.y, zIndex: 9999 }}>
          <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: "top left" }}>
            <CursorSvg color={c.color} />
            <div
              className="absolute top-4 left-3.5 rounded px-1.5 py-0.5 text-white font-semibold whitespace-nowrap"
              style={{ background: c.color, fontSize: 11, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
            >
              {c.displayName}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function BoardCanvas() {
  const board = useActiveBoard();
  const {
    showGrid, showRuler, zoom, selectBox, activeBoardId,
    addBox, pasteBox, copiedBox, toggleGrid, toggleRuler, setZoom,
  } = useBoardStore();
  const draggingBlockId = useBoardStore((s) => s.draggingBlockId);
  const isFinished = board?.isFinished ?? false;
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cursors, onCursorMove } = useCollab();

  // ── Pan-on-drag state ─────────────────────────────────────────────────────
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const panMoved = useRef(false);

  // Board-level context menu
  const [boardCtx, setBoardCtx] = useState<{
    screenX: number; screenY: number;
    canvasX: number; canvasY: number;
  } | null>(null);

  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    if (!scrollRef.current) return { x: canvasX, y: canvasY };
    const rect = scrollRef.current.getBoundingClientRect();
    const rulerPad = showRuler ? 24 : 0;
    return {
      x: canvasX * zoom + rect.left + rulerPad - scrollRef.current.scrollLeft,
      y: canvasY * zoom + rect.top + rulerPad - scrollRef.current.scrollTop,
    };
  }, [showRuler, zoom]);

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    if (!scrollRef.current) return { x: 0, y: 0 };
    const rect = scrollRef.current.getBoundingClientRect();
    const rulerPad = showRuler ? 24 : 0;
    return {
      x: (clientX - rect.left - rulerPad + scrollRef.current.scrollLeft) / zoom,
      y: (clientY - rect.top - rulerPad + scrollRef.current.scrollTop) / zoom,
    };
  }, [showRuler, zoom]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (panMoved.current) { panMoved.current = false; return; }
      if (e.target === canvasRef.current) selectBox(null);
    },
    [selectBox]
  );

  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    // Only pan when the click lands directly on the canvas bg or a data-pannable element
    const isPannable = target === canvasRef.current || target.hasAttribute("data-pannable");
    if (!isPannable) return;

    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollRef.current?.scrollLeft ?? 0,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
    };
    panMoved.current = false;
    setPanning(true);

    const onMove = (ev: MouseEvent) => {
      if (!scrollRef.current) return;
      const dx = ev.clientX - panStart.current.x;
      const dy = ev.clientY - panStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panMoved.current = true;
      scrollRef.current.scrollLeft = panStart.current.scrollLeft - dx;
      scrollRef.current.scrollTop = panStart.current.scrollTop - dy;
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    onCursorMove(x, y);
  }, [clientToCanvas, onCursorMove]);

  const handleBoardContextMenu = useCallback((e: React.MouseEvent) => {
    // Only fire on the raw canvas background, not on block children
    if (e.target !== canvasRef.current) return;
    if (isFinished) return;
    e.preventDefault();
    e.stopPropagation();
    selectBox(null);
    const { x: canvasX, y: canvasY } = clientToCanvas(e.clientX, e.clientY);
    setBoardCtx({ screenX: e.clientX, screenY: e.clientY, canvasX, canvasY });
  }, [isFinished, selectBox, clientToCanvas]);

  void canvasToScreen; // used by future "zoom to fit" pass

  if (!board) return null;

  const bgSize = board.backgroundSize ?? "cover";

  const boardMenuItems = [
    {
      label: "Add block here",
      icon: <SquarePlus size={14} />,
      shortcut: "A",
      onClick: () => {
        if (!boardCtx) return;
        addBox(activeBoardId, {
          x: Math.max(0, Math.round(boardCtx.canvasX / 20) * 20 - 140),
          y: Math.max(0, Math.round(boardCtx.canvasY / 20) * 20 - 110),
          width: 280, height: 220,
          locked: false, title: "New block",
          isExpanded: false, items: [],
          style: { ...DEFAULT_BOX_STYLE },
        });
      },
    },
    ...(copiedBox ? [{
      label: "Paste block here",
      icon: <Clipboard size={14} />,
      shortcut: "⌘V",
      onClick: () => {
        if (!boardCtx) return;
        pasteBox(activeBoardId, boardCtx.canvasX - 140, boardCtx.canvasY - 110);
      },
    }] : []),
    "separator" as const,
    {
      label: showGrid ? "Hide grid" : "Show grid",
      icon: <LayoutGrid size={14} />,
      onClick: () => toggleGrid(),
    },
    {
      label: "Reset zoom",
      icon: <ScanSearch size={14} />,
      shortcut: "⌘0",
      onClick: () => setZoom(1),
    },
    "separator" as const,
    {
      label: "Board theme",
      icon: <Palette size={14} />,
      onClick: () => {
        document.querySelector<HTMLButtonElement>("[data-theme-btn]")?.click();
      },
    },
    {
      label: "Share board",
      icon: <Share2 size={14} />,
      onClick: () => {
        document.querySelector<HTMLButtonElement>("[data-share-btn]")?.click();
      },
    },
    {
      label: "Select all blocks",
      icon: <Layers size={14} />,
      onClick: () => {},
      disabled: true,
    },
  ];

  return (
    <div className="relative flex-1 overflow-hidden" style={{ background: board.backgroundColor ?? "#1a1b1e" }}>
      {board.backgroundImage && (
        <>
          <div
            aria-hidden
            style={{
              position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
              backgroundImage: `url(${board.backgroundImage})`,
              backgroundSize: bgSize,
              backgroundPosition: board.backgroundPosition ?? "center",
              backgroundRepeat: bgSize === "auto" ? "no-repeat" : undefined,
              opacity: board.backgroundOpacity ?? 1,
              filter: board.backgroundFilter || undefined,
            }}
          />
          {(board.backgroundOverlayOpacity ?? 0) > 0 && (
            <div
              aria-hidden
              style={{
                position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
                backgroundColor: board.backgroundOverlayColor ?? "#000000",
                opacity: board.backgroundOverlayOpacity,
              }}
            />
          )}
        </>
      )}

      {showRuler && <Ruler zoom={zoom} />}

      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto"
        style={{
          paddingTop: showRuler ? 24 : 0,
          paddingLeft: showRuler ? 24 : 0,
          zIndex: 2,
          cursor: panning ? "grabbing" : undefined,
        }}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          onContextMenu={handleBoardContextMenu}
          data-board-canvas
          className={cn("relative origin-top-left", showGrid && "board-grid")}
          style={{
            width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
            transform: `scale(${zoom})`, transformOrigin: "top left",
            cursor: panning ? "grabbing" : "grab",
          }}
        >
          {board.boxes.filter(box => !box.deckOwnerId).map((box) => (
            <BoardBox
              key={box.id}
              box={box}
              boardId={activeBoardId}
              isDragging={draggingBlockId === box.id}
            />
          ))}

          <CollabCursors cursors={cursors} zoom={zoom} />
        </div>
      </div>

      {boardCtx && (
        <ContextMenu
          x={boardCtx.screenX}
          y={boardCtx.screenY}
          items={boardMenuItems}
          onClose={() => setBoardCtx(null)}
        />
      )}
    </div>
  );
}
