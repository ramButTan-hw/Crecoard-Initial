"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LayoutGrid, Palette, Share2, Clipboard,
  ScanSearch, SquarePlus, Layers, Package,
} from "lucide-react";
import { useBoardStore, useActiveBoard, DEFAULT_BOX_STYLE } from "@/store/boardStore";
import { ITEM_DEFINITIONS } from "./ItemPalette";
import { BoardItemWidget } from "./BoardItemWidget";
import { useCollab } from "@/lib/useCollabSession";
import { ContextMenu } from "@/components/ui/ContextMenu";
import type { CursorState } from "@/lib/collaboration";
import { BoardBox } from "./BoardBox";
import { cn } from "@/lib/utils";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/boardConstants";
import { useCanEditBoard, useServerBoard, useServerBoardData } from "@/contexts/ServerBoardContext";

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

// ─── Alignment guides ────────────────────────────────────────────────────────

const ALIGN_THRESHOLD = 8; // canvas px

function AlignmentGuides({ boxes }: { boxes: import("@/store/boardStore").Box[] }) {
  const dragPos = useBoardStore((s) => s.dragPos);
  const draggingId = useBoardStore((s) => s.draggingBlockId);
  const resizeState = useBoardStore((s) => s.resizeState);

  const guideXs = new Set<number>();
  const guideYs = new Set<number>();

  // Drag guides
  if (dragPos && draggingId) {
    const draggingBox = boxes.find((b) => b.id === draggingId);
    if (draggingBox) {
      const dL = dragPos.x, dR = dragPos.x + draggingBox.width, dCX = dragPos.x + draggingBox.width / 2;
      const dT = dragPos.y, dB = dragPos.y + draggingBox.height, dCY = dragPos.y + draggingBox.height / 2;
      for (const box of boxes) {
        if (box.id === draggingId || box.deckOwnerId) continue;
        const bL = box.x, bR = box.x + box.width, bCX = box.x + box.width / 2;
        const bT = box.y, bB = box.y + box.height, bCY = box.y + box.height / 2;
        for (const sx of [dL, dCX, dR])
          for (const tx of [bL, bCX, bR])
            if (Math.abs(sx - tx) < ALIGN_THRESHOLD) guideXs.add(tx);
        for (const sy of [dT, dCY, dB])
          for (const ty of [bT, bCY, bB])
            if (Math.abs(sy - ty) < ALIGN_THRESHOLD) guideYs.add(ty);
      }
    }
  }

  // Resize guides
  if (resizeState) {
    const { id, x, y, width, height } = resizeState;
    const rL = x, rR = x + width, rCX = x + width / 2;
    const rT = y, rB = y + height, rCY = y + height / 2;
    for (const box of boxes) {
      if (box.id === id || box.deckOwnerId) continue;
      const bL = box.x, bR = box.x + box.width, bCX = box.x + box.width / 2;
      const bT = box.y, bB = box.y + box.height, bCY = box.y + box.height / 2;
      for (const sx of [rL, rCX, rR])
        for (const tx of [bL, bCX, bR])
          if (Math.abs(sx - tx) < ALIGN_THRESHOLD) guideXs.add(tx);
      for (const sy of [rT, rCY, rB])
        for (const ty of [bT, bCY, bB])
          if (Math.abs(sy - ty) < ALIGN_THRESHOLD) guideYs.add(ty);
    }
  }

  if (guideXs.size === 0 && guideYs.size === 0) return null;

  return (
    <>
      {[...guideXs].map((x) => (
        <div key={`gx-${x}`} className="pointer-events-none absolute top-0 bottom-0"
          style={{ left: x, width: 1, background: "rgba(99,153,255,0.75)", zIndex: 9000 }} />
      ))}
      {[...guideYs].map((y) => (
        <div key={`gy-${y}`} className="pointer-events-none absolute left-0 right-0"
          style={{ top: y, height: 1, background: "rgba(99,153,255,0.75)", zIndex: 9000 }} />
      ))}
    </>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export function BoardCanvas() {
  const personalBoard = useActiveBoard();
  const serverBoard = useServerBoardData();
  const { serverId, boardId: serverBoardId } = useServerBoard();
  // In server context use the server board; in personal context use the personal board
  const board = serverId ? serverBoard : personalBoard;
  const {
    showGrid, zoom, panOffset, selectBox, activeBoardId,
    addBox, pasteBox, copiedBox, toggleGrid, setZoom,
    setPanOffset, addBoardItem, selectBoardItem,
  } = useBoardStore();
  // Mutations target the correct board ID regardless of which namespace it lives in
  const boardId = serverBoardId ?? activeBoardId;
  const selectedBoardItemId = useBoardStore((s) => s.selectedBoardItemId);
  const draggingBlockId = useBoardStore((s) => s.draggingBlockId);
  const canEditBoard = useCanEditBoard();
  const isFinished = board?.isFinished ?? false;
  // Members in a server board see no grid and can't open context menu
  const effectiveShowGrid = showGrid && canEditBoard;
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { cursors, onCursorMove } = useCollab();

  // ── Pan-on-drag state ─────────────────────────────────────────────────────
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const panMoved = useRef(false);

  // Board-level context menu
  const [boardCtx, setBoardCtx] = useState<{
    screenX: number; screenY: number;
    canvasX: number; canvasY: number;
  } | null>(null);

  const canvasToScreen = useCallback((canvasX: number, canvasY: number) => {
    if (!viewportRef.current) return { x: canvasX, y: canvasY };
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: panOffset.x + canvasX * zoom + rect.left,
      y: panOffset.y + canvasY * zoom + rect.top,
    };
  }, [zoom, panOffset]);

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    if (!viewportRef.current) return { x: 0, y: 0 };
    const rect = viewportRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panOffset.x) / zoom,
      y: (clientY - rect.top - panOffset.y) / zoom,
    };
  }, [zoom, panOffset]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (panMoved.current) { panMoved.current = false; return; }
      if (e.target === canvasRef.current) { selectBox(null); selectBoardItem(null); }
    },
    [selectBox, selectBoardItem]
  );

  const handlePanMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as Element;
    const isPannable = target === canvasRef.current || target.hasAttribute("data-pannable");
    if (!isPannable) return;

    const state = useBoardStore.getState();
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: state.panOffset.x,
      offsetY: state.panOffset.y,
    };
    panMoved.current = false;
    setPanning(true);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - panStart.current.x;
      const dy = ev.clientY - panStart.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) panMoved.current = true;
      setPanOffset({ x: panStart.current.offsetX + dx, y: panStart.current.offsetY + dy });
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [setPanOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { x, y } = clientToCanvas(e.clientX, e.clientY);
    onCursorMove(x, y);
  }, [clientToCanvas, onCursorMove]);

  const handleBoardContextMenu = useCallback((e: React.MouseEvent) => {
    // Only fire on the raw canvas background, not on block children
    if (e.target !== canvasRef.current) return;
    if (isFinished || !canEditBoard) return;
    e.preventDefault();
    e.stopPropagation();
    selectBox(null);
    const { x: canvasX, y: canvasY } = clientToCanvas(e.clientX, e.clientY);
    setBoardCtx({ screenX: e.clientX, screenY: e.clientY, canvasX, canvasY });
  }, [isFinished, canEditBoard, selectBox, clientToCanvas]);

  // ── Fit content to viewport ───────────────────────────────────────────────
  const handleFitContent = useCallback(() => {
    if (!viewportRef.current) return;
    const boxes = board?.boxes ?? [];
    const items = board?.boardItems ?? [];
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;

    if (boxes.length === 0 && items.length === 0) {
      const newZoom = Math.min(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT);
      setZoom(newZoom);
      setPanOffset({ x: (vw - CANVAS_WIDTH * newZoom) / 2, y: (vh - CANVAS_HEIGHT * newZoom) / 2 });
      return;
    }

    const PAD = 60;
    const xs = [
      ...boxes.map(b => b.x), ...boxes.map(b => b.x + b.width),
      ...items.map(b => b.boardX), ...items.map(b => b.boardX + b.boardW),
    ];
    const ys = [
      ...boxes.map(b => b.y), ...boxes.map(b => b.y + b.height),
      ...items.map(b => b.boardY), ...items.map(b => b.boardY + b.boardH),
    ];
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const contentW = Math.max(...xs) - minX;
    const contentH = Math.max(...ys) - minY;

    const newZoom = Math.min(1.5, Math.max(0.05,
      Math.min(vw / (contentW + PAD * 2), vh / (contentH + PAD * 2))
    ));
    setZoom(newZoom);
    setPanOffset({
      x: vw / 2 - (minX + contentW / 2) * newZoom,
      y: vh / 2 - (minY + contentH / 2) * newZoom,
    });
  }, [board, setZoom, setPanOffset]);

  // Auto-fit content on first mount / board switch
  useEffect(() => {
    const id = requestAnimationFrame(() => handleFitContent());
    return () => cancelAnimationFrame(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Ctrl/Cmd + wheel → zoom toward cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const state = useBoardStore.getState();
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const oldZoom = state.zoom;
      const newZoom = parseFloat(Math.max(state.minZoom, Math.min(3, oldZoom + delta)).toFixed(2));
      const ratio = newZoom / oldZoom;
      setZoom(newZoom);
      setPanOffset({
        x: cursorX - (cursorX - state.panOffset.x) * ratio,
        y: cursorY - (cursorY - state.panOffset.y) * ratio,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setZoom, setPanOffset]);

  if (!board) return null;

  const bgSize = board.backgroundSize ?? "cover";

  const defaultItemSizes: Partial<Record<string, [number, number]>> = {
    text: [280, 120], list: [280, 200], timer: [200, 200],
    graph: [360, 260], table: [500, 300], calendar: [400, 340],
    image: [280, 200], embed: [360, 260], widget: [360, 260],
    api: [280, 180], variable: [200, 80], playlist: [280, 300],
    chat: [320, 420],
  };

  const boardMenuItems = [
    {
      label: "Add block here",
      icon: <SquarePlus size={14} />,
      shortcut: "A",
      onClick: () => {
        if (!boardCtx) return;
        addBox(boardId, {
          x: Math.max(0, Math.round(boardCtx.canvasX / 20) * 20 - 140),
          y: Math.max(0, Math.round(boardCtx.canvasY / 20) * 20 - 110),
          width: 280, height: 220,
          locked: false, title: "New block",
          isExpanded: false, items: [],
          style: { ...DEFAULT_BOX_STYLE },
        });
      },
    },
    {
      label: "Add item here",
      icon: <Package size={14} />,
      children: ITEM_DEFINITIONS.filter(d => !d.serverOnly || serverId !== null).map((def) => ({
        label: def.label,
        icon: def.icon,
        onClick: () => {
          if (!boardCtx) return;
          const [itemW, itemH] = defaultItemSizes[def.type] ?? [280, 200];
          const snapV = (v: number) => Math.round(v / 20) * 20;
          addBoardItem(boardId, {
            ...def.defaultItem(),
            showInCollapsed: false,
            boardX: Math.max(0, snapV(boardCtx.canvasX - itemW / 2)),
            boardY: Math.max(0, snapV(boardCtx.canvasY - itemH / 2)),
            boardW: itemW,
            boardH: itemH,
          });
        },
      })),
    },
    ...(copiedBox ? [{
      label: "Paste block here",
      icon: <Clipboard size={14} />,
      shortcut: "⌘V",
      onClick: () => {
        if (!boardCtx) return;
        pasteBox(boardId, boardCtx.canvasX - 140, boardCtx.canvasY - 110);
      },
    }] : []),
    "separator" as const,
    {
      label: showGrid ? "Hide grid" : "Show grid",
      icon: <LayoutGrid size={14} />,
      onClick: () => toggleGrid(),
    },
    {
      label: "Fit content to view",
      icon: <ScanSearch size={14} />,
      shortcut: "⌘0",
      onClick: handleFitContent,
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
    <div className="relative flex-1 overflow-hidden">
      {/* Theme background — fixed behind the canvas, doesn't pan or zoom */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundColor: board.themeBgColor ?? "var(--surface)" }}
      />
      {board.themeBgImage && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url(${board.themeBgImage})`,
            backgroundSize: board.themeBgSize ?? "cover",
            backgroundPosition: "center",
            opacity: board.themeBgOpacity ?? 1,
          }}
        />
      )}

      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-hidden"
        style={{ zIndex: 2, cursor: panning ? "grabbing" : undefined }}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          onContextMenu={handleBoardContextMenu}
          data-board-canvas
          className="relative"
          style={{
            position: "absolute",
            width: CANVAS_WIDTH, height: CANVAS_HEIGHT,
            transformOrigin: "0 0",
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
            cursor: panning ? "grabbing" : "grab",
          }}
        >
          {/* ── Background layers: move & scale with canvas ── */}
          <div aria-hidden className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: board.backgroundColor ?? "#1a1b1e" }} />
          {board.backgroundImage && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${board.backgroundImage})`,
                backgroundSize: bgSize,
                backgroundPosition: board.backgroundPosition ?? "center",
                backgroundRepeat: bgSize === "auto" ? "no-repeat" : undefined,
                opacity: board.backgroundOpacity ?? 1,
                filter: board.backgroundFilter || undefined,
              }}
            />
          )}
          {(board.backgroundOverlayOpacity ?? 0) > 0 && (
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: board.backgroundOverlayColor ?? "#000000",
                opacity: board.backgroundOverlayOpacity,
              }}
            />
          )}
          {effectiveShowGrid && (
            <div aria-hidden className={cn("absolute inset-0 pointer-events-none", zoom >= 0.55 ? "board-grid" : "board-grid-major")} />
          )}

          {board.boxes.filter(box => !box.deckOwnerId).map((box) => (
            <BoardBox
              key={box.id}
              box={box}
              boardId={boardId}
              isDragging={draggingBlockId === box.id}
            />
          ))}

          {(board.boardItems ?? []).map((item) => (
            <BoardItemWidget
              key={item.id}
              item={item}
              boardId={boardId}
              isFinished={isFinished}
              isSelected={selectedBoardItemId === item.id}
            />
          ))}

          <AlignmentGuides boxes={board.boxes} />
          <CollabCursors cursors={cursors} zoom={zoom} />
        </div>
      </div>

      {/* Fit-to-content button */}
      <button
        onClick={handleFitContent}
        title="Fit content to view"
        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-muted)] shadow-lg hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ScanSearch size={12} />
        Fit
      </button>

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
