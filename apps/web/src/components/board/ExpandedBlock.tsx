"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  X, Pin, Grid3X3, Upload, AlignLeft, AlignCenter, AlignRight, Trash2,
  CopyPlus, Settings2, ArrowUp, ArrowDown, RefreshCw, LayoutGrid, Minus, Plus,
} from "lucide-react";
import {
  useBoardStore, useActiveBoard, resolveVars,
  BlockItem, Box, ItemType, BoxStyle,
} from "@/store/boardStore";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { ItemRenderer, ListStylePanel, GraphStylePanel, EmbedStylePanel, TimerStylePanel, ApiStylePanel, CalendarStylePanel, TableStylePanel, PlaylistStylePanel } from "@/components/items/ItemRenderer";
import { FontPicker } from "@/components/ui/FontPicker";
import { loadGoogleFont } from "@/lib/fonts";
import { ITEM_DEFINITIONS } from "./ItemPalette";
import { WallpaperEditor } from "@/components/ui/WallpaperEditor";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/lib/boardConstants";

const GRID = 20;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const MIN_W = 180;
const MIN_H = 60;

const DEFAULT_SIZES: Record<ItemType, { w: number; h: number }> = {
  text:     { w: 320, h: 100 },
  list:     { w: 300, h: 200 },
  variable: { w: 260, h: 90  },
  embed:    { w: 420, h: 260 },
  timer:    { w: 240, h: 110 },
  image:    { w: 320, h: 220 },
  graph:    { w: 420, h: 300 },
  api:      { w: 380, h: 240 },
  calendar: { w: 460, h: 380 },
  table:    { w: 520, h: 320 },
  divider:  { w: 420, h: 44  },
  widget:   { w: 480, h: 340 },
  playlist: { w: 420, h: 420 },
};

function getDefaultLayout(item: BlockItem, idx: number) {
  const sz = DEFAULT_SIZES[item.type] ?? { w: 280, h: 120 };
  const col = idx % 2;
  const row = Math.floor(idx / 2);
  return {
    x: item.expandedX ?? snap(40 + col * (sz.w + 32)),
    y: item.expandedY ?? snap(40 + row * (sz.h + 32)),
    w: item.expandedW ?? sz.w,
    h: item.expandedH ?? sz.h,
  };
}

// ─── Draggable item card ──────────────────────────────────────────────────────

function ItemCard({
  item, boardId, boxId, vars, isFinished, layout,
  zoom,
  onDelete, onTogglePin, isSelected, onSelect,
  onDuplicate, onMoveUp, onMoveDown, onOpenSettings, onResetLayout,
}: {
  item: BlockItem;
  boardId: string;
  boxId: string;
  vars: Record<string, number>;
  isFinished: boolean;
  layout: { x: number; y: number; w: number; h: number };
  zoom: number;
  onDelete: () => void;
  onTogglePin: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenSettings: () => void;
  onResetLayout: () => void;
}) {
  const { resizeExpandedItem } = useBoardStore();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: isFinished,
    data: { kind: "expanded-item" },
  });

  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    resizing.current = true;
    resizeStart.current = { x: e.clientX, y: e.clientY, w: layout.w, h: layout.h };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const dx = (ev.clientX - resizeStart.current.x) / zoom;
      const dy = (ev.clientY - resizeStart.current.y) / zoom;
      setLiveSize({
        w: Math.max(MIN_W, snap(resizeStart.current.w + dx)),
        h: Math.max(MIN_H, snap(resizeStart.current.h + dy)),
      });
    };
    const onUp = (ev: MouseEvent) => {
      resizing.current = false;
      const dx = (ev.clientX - resizeStart.current.x) / zoom;
      const dy = (ev.clientY - resizeStart.current.y) / zoom;
      resizeExpandedItem(boardId, boxId, item.id,
        Math.max(MIN_W, snap(resizeStart.current.w + dx)),
        Math.max(MIN_H, snap(resizeStart.current.h + dy)),
      );
      setLiveSize(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [boardId, boxId, item.id, layout.w, layout.h, resizeExpandedItem]);

  const displayW = liveSize?.w ?? layout.w;
  const displayH = liveSize?.h ?? layout.h;
  const transformStyle = transform ? CSS.Translate.toString(transform) : undefined;
  const scaledTransformStyle = transform ? CSS.Translate.toString({ x: transform.x / zoom, y: transform.y / zoom }) : undefined;
  const isText = item.type === "text";
  const isList = item.type === "list";
  const isGraph = item.type === "graph";
  const isEmbed = item.type === "embed";
  const isTimer = item.type === "timer";
  const isTable = item.type === "table";
  const isCalendar = item.type === "calendar";

  return (
    <div
      ref={setDragRef}
      data-item-card
      className={cn("absolute group flex flex-col", isDragging && "opacity-40 z-50")}
      style={{
        left: layout.x, top: layout.y,
        width: displayW, height: displayH,
        transform: scaledTransformStyle ?? transformStyle,
        zIndex: isDragging ? 50 : 1,
        background: isText || isList || isEmbed || isTimer || isTable || isCalendar ? "transparent" : "var(--surface-raised)",
        borderRadius: isText ? 0 : isList ? (item.listBorderRadius ?? 0) : isTimer ? (item.timerBorderRadius ?? 0) : isTable ? (item.tableBorderRadius ?? 0) : isCalendar ? (item.calendarBorderRadius ?? 0) : 12,
        border: isText || isList || isEmbed || isTimer || isTable || isCalendar
          ? isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent"
          : isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        overflow: isText ? "visible" : "hidden",
        transition: "border-color 0.15s",
      }}
      onClick={() => onSelect()}
      onContextMenu={(e) => {
        if (isFinished) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >

      {/* Inline drag bar */}
      {!isFinished && (
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center w-full shrink-0 cursor-grab active:cursor-grabbing touch-none z-20 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ height: 16, paddingTop: 2, paddingBottom: 2 }}
        >
          <div className="w-10 h-[3px] rounded-full bg-[var(--text-muted)]" />
        </div>
      )}

      {/* Pinned badge — visible at top-right when item is in summary */}
      {!isFinished && item.showInCollapsed && (
        <div className="absolute top-1 right-1 z-20 pointer-events-none">
          <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent)] leading-none">
            <Pin size={8} /> S
          </span>
        </div>
      )}

      {/* Content */}
      <div
        className={cn("relative flex-1 overflow-auto", (isList || isGraph || isEmbed || isTimer || isTable || isCalendar) ? "h-full" : "p-3")}
        style={{ zIndex: 1 }}
      >
        <ItemRenderer
          item={item} boardId={boardId} boxId={boxId} vars={vars}
          collapsed={false} isFinished={isFinished}
          containerW={displayW} containerH={displayH}
        />
      </div>

      {/* Resize handle */}
      {!isFinished && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: "absolute", right: 0, bottom: 0, width: 14, height: 14,
            cursor: "se-resize", zIndex: 20, opacity: 0.4,
            background: "linear-gradient(135deg, transparent 50%, var(--accent) 50%)",
            borderRadius: isText ? 0 : "0 0 10px 0",
          }}
        />
      )}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: "Settings",
              icon: <Settings2 size={14} />,
              onClick: onOpenSettings,
            },
            {
              label: item.showInCollapsed ? "Unpin from summary" : "Pin to summary",
              icon: <Pin size={14} />,
              onClick: onTogglePin,
            },
            "separator",
            {
              label: "Duplicate",
              icon: <CopyPlus size={14} />,
              shortcut: "⌘D",
              onClick: onDuplicate,
            },
            {
              label: "Move up",
              icon: <ArrowUp size={14} />,
              onClick: onMoveUp,
            },
            {
              label: "Move down",
              icon: <ArrowDown size={14} />,
              onClick: onMoveDown,
            },
            "separator",
            {
              label: "Reset size",
              icon: <RefreshCw size={14} />,
              onClick: () => {
                const sz = DEFAULT_SIZES[item.type] ?? { w: 280, h: 120 };
                resizeExpandedItem(boardId, boxId, item.id, sz.w, sz.h);
              },
            },
            {
              label: "Reset position",
              icon: <LayoutGrid size={14} />,
              onClick: onResetLayout,
            },
            "separator",
            {
              label: "Delete item",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: onDelete,
            },
          ]}
        />
      )}
    </div>
  );
}

// ─── Main ExpandedBlock ───────────────────────────────────────────────────────

export function ExpandedBlock({ boxId }: { boxId: string }) {
  const {
    activeBoardId, setExpandedBox, removeItem, toggleItemInCollapsed, addItem,
    moveExpandedItem, updateBox, updateBoxStyle,
    moveItemUp, moveItemDown, duplicateItem, resetItemLayout,
  } = useBoardStore();
  const board = useActiveBoard();
  const box = board?.boxes.find((b) => b.id === boxId);
  const [showGrid, setShowGrid] = useState(true);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [rightTab, setRightTab] = useState<"items" | "collapsed" | "item" | "style">("items");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [canvasCtxMenu, setCanvasCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 4 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  useEffect(() => {
    setCanvasZoom(1);
  }, [boxId]);

  if (!box) return null;

  const isFinished = board?.isFinished ?? false;
  const vars = resolveVars(box.items);
  const summaryItems = box.items.filter((i) => i.showInCollapsed);
  const selectedItem = selectedItemId ? box.items.find((i) => i.id === selectedItemId) : null;

  const close = () => setExpandedBox(null);

  const handleCanvasPanMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (e.target !== canvasRef.current) return;

    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasScrollRef.current?.scrollLeft ?? 0,
      scrollTop: canvasScrollRef.current?.scrollTop ?? 0,
    };
    setPanning(true);

    const onMove = (ev: MouseEvent) => {
      if (!canvasScrollRef.current) return;
      const dx = ev.clientX - panStart.current.x;
      const dy = ev.clientY - panStart.current.y;
      canvasScrollRef.current.scrollLeft = panStart.current.scrollLeft - dx;
      canvasScrollRef.current.scrollTop = panStart.current.scrollTop - dy;
    };
    const onUp = () => {
      setPanning(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    if (e.active.data.current?.kind !== "expanded-item") return;
    const itemId = e.active.id as string;
    const item = box.items.find((i) => i.id === itemId);
    if (!item || !e.delta) return;
    const layout = getDefaultLayout(item, box.items.indexOf(item));
    moveExpandedItem(activeBoardId, boxId, itemId,
      Math.max(0, snap(layout.x + e.delta.x / canvasZoom)),
      Math.max(0, snap(layout.y + e.delta.y / canvasZoom))
    );
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId((prev) => {
      if (prev === itemId) { setRightTab("items"); return null; }
      return itemId;
    });
    setRightTab("item");
  };

  const handleCanvasClick = () => {
    setSelectedItemId(null);
    if (rightTab === "item") setRightTab("items");
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) close(); }}
    >
      <div
        className="flex h-[92vh] w-[92vw] max-w-[1400px] overflow-hidden rounded-2xl shadow-2xl"
        style={{
          border: box.style.borderStyle === "glow"
            ? "none"
            : `${box.style.borderWidth}px ${box.style.borderStyle} ${box.style.borderColor}`,
          boxShadow: box.style.borderStyle === "glow"
            ? `0 0 ${box.style.borderWidth * 8}px ${box.style.borderColor}`
            : undefined,
          background: "var(--surface)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: canvas ─────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div
            className="flex h-14 flex-shrink-0 items-center gap-3 border-b px-5"
            style={{ background: "var(--surface-raised)", borderColor: box.style.borderColor }}
          >
            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: box.style.borderColor }} />
            <input
              className="flex-1 bg-transparent text-lg font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              placeholder="Block title…"
              value={box.title}
              readOnly={isFinished}
              onChange={(e) => updateBox(activeBoardId, boxId, { title: e.target.value })}
            />
            <span className="text-xs text-[var(--text-muted)]">{box.items.length} items · {summaryItems.length} in summary</span>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] p-0.5">
              <button
                onClick={() => setCanvasZoom((v) => Math.max(0.5, Math.round((v - 0.25) * 4) / 4))}
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                title="Zoom out"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => setCanvasZoom(1)}
                className="min-w-[3.5rem] rounded-md px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                title="Reset zoom"
              >
                {Math.round(canvasZoom * 100)}%
              </button>
              <button
                onClick={() => setCanvasZoom((v) => Math.min(2, Math.round((v + 0.25) * 4) / 4))}
                className="rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                title="Zoom in"
              >
                <Plus size={14} />
              </button>
            </div>
            <button
              onClick={() => setShowGrid((v) => !v)}
              className={cn("rounded p-1.5 transition-colors", showGrid ? "bg-[var(--accent)]/20 text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
              title="Toggle grid"
            >
              <Grid3X3 size={15} />
            </button>
            <button onClick={close} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Canvas */}
          <div
            ref={canvasScrollRef}
            className="flex-1 overflow-auto relative"
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasPanMouseDown}
            style={{ cursor: panning ? "grabbing" : undefined }}
          >
            <div style={{ width: CANVAS_WIDTH * canvasZoom, height: CANVAS_HEIGHT * canvasZoom }}>
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div
                  ref={canvasRef}
                  className={cn("relative", showGrid && "board-grid")}
                  style={{
                    width: CANVAS_WIDTH,
                    height: CANVAS_HEIGHT,
                    transform: `scale(${canvasZoom})`,
                    transformOrigin: "top left",
                    backgroundColor: box.style.backgroundColor,
                    zIndex: 1,
                    cursor: panning ? "grabbing" : "grab",
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => {
                    if ((e.target as HTMLElement).closest("[data-item-card]")) return;
                    if (isFinished) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedItemId(null);
                    setCanvasCtxMenu({ x: e.clientX, y: e.clientY });
                  }}
                >
                {box.style.wallpaperUrl && (
                  <div aria-hidden style={{
                    position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
                    backgroundImage: `url(${box.style.wallpaperUrl})`,
                    backgroundSize: box.style.wallpaperSize ?? "cover",
                    backgroundPosition: box.style.wallpaperPosition ?? "center",
                    backgroundRepeat: "no-repeat",
                    opacity: box.style.wallpaperOpacity ?? 1,
                  }} />
                )}

                {box.items.map((item, idx) => {
                  const layout = getDefaultLayout(item, idx);
                  return (
                    <ItemCard
                      key={item.id}
                      item={item}
                      boardId={activeBoardId}
                      boxId={boxId}
                      vars={vars}
                      isFinished={isFinished}
                      layout={layout}
                      zoom={canvasZoom}
                      onDelete={() => removeItem(activeBoardId, boxId, item.id)}
                      onTogglePin={() => toggleItemInCollapsed(activeBoardId, boxId, item.id)}
                      isSelected={selectedItemId === item.id}
                      onSelect={() => handleItemSelect(item.id)}
                      onDuplicate={() => duplicateItem(activeBoardId, boxId, item.id)}
                      onMoveUp={() => moveItemUp(activeBoardId, boxId, item.id)}
                      onMoveDown={() => moveItemDown(activeBoardId, boxId, item.id)}
                      onOpenSettings={() => { setSelectedItemId(item.id); setRightTab("item"); }}
                      onResetLayout={() => resetItemLayout(activeBoardId, boxId, item.id)}
                    />
                  );
                })}

                {box.items.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
                    <p className="text-base font-medium text-[var(--text-secondary)]">This block is empty</p>
                    <p className="text-sm text-[var(--text-muted)]">Right-click to add items, or use the panel →</p>
                  </div>
                )}
                </div>
              </DndContext>
            </div>

            {canvasCtxMenu && !isFinished && (
              <ContextMenu
                x={canvasCtxMenu.x}
                y={canvasCtxMenu.y}
                onClose={() => setCanvasCtxMenu(null)}
                items={[
                  ...ITEM_DEFINITIONS.map((def) => ({
                    label: `Add ${def.label}`,
                    icon: def.icon as React.ReactNode,
                    onClick: () => addItem(activeBoardId, boxId, { ...def.defaultItem(), showInCollapsed: false }),
                  })),
                  "separator" as const,
                  {
                    label: showGrid ? "Hide grid" : "Show grid",
                    icon: <Grid3X3 size={14} />,
                    onClick: () => setShowGrid((v) => !v),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────── */}
        {!isFinished && <div className="flex w-[280px] flex-shrink-0 flex-col border-l border-[var(--border)]" style={{ background: "var(--surface-raised)" }}>
          {/* Tabs */}
          <div className="flex shrink-0 gap-0.5 border-b border-[var(--border)] px-3 pt-3 pb-2">
            <div className="flex gap-0.5 rounded-lg bg-[var(--surface-overlay)] p-0.5 w-full">
              {([
                { id: "items", label: "Items" },
                { id: "collapsed", label: "Collapsed" },
                ...(selectedItem ? [{ id: "item", label: selectedItem.type === "list" ? "List" : selectedItem.type === "text" ? "Text" : selectedItem.type === "graph" ? "Chart" : selectedItem.type === "timer" ? "Timer" : selectedItem.type === "api" ? "API" : selectedItem.type === "calendar" ? "Calendar" : selectedItem.type === "table" ? "Table" : "Item" }] : []),
                { id: "style", label: "Style" },
              ] as { id: string; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setRightTab(t.id as "items" | "collapsed" | "item" | "style")}
                  className={cn(
                    "flex-1 rounded-md py-1 text-[11px] font-medium transition-colors",
                    rightTab === t.id
                      ? "bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Items tab ── */}
          {rightTab === "items" && (
            <>
              <div className="border-b border-[var(--border)] p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Summary preview</p>
                {(() => {
                  const previewW = 228;
                  const scale = Math.min(1, previewW / Math.max(box.width, 1));
                  const scaledH = Math.min(170, Math.round(box.height * scale));
                  const pad = box.style.padding ?? 14;
                  return (
                    <div
                      className="rounded-xl border overflow-hidden relative"
                      style={{ width: previewW, height: scaledH, borderColor: box.style.borderColor, backgroundColor: box.style.backgroundColor }}
                    >
                      {box.style.wallpaperUrl && (
                        <div aria-hidden style={{
                          position: "absolute", inset: 0, pointerEvents: "none",
                          backgroundImage: `url(${box.style.wallpaperUrl})`,
                          backgroundSize: box.style.wallpaperSize ?? "cover",
                          backgroundPosition: box.style.wallpaperPosition ?? "center",
                          opacity: box.style.wallpaperOpacity ?? 1,
                        }} />
                      )}
                      {summaryItems.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-[10px] opacity-50 italic text-center px-3">Pin items using the <Pin size={9} className="inline" /> button</p>
                        </div>
                      ) : (
                        <div style={{ width: box.width, height: box.height, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>
                          {summaryItems.map((item, idx) => {
                            const defaultW = Math.max(80, box.width - pad * 2 - 8);
                            const iW = item.collapsedW ?? defaultW;
                            const iH = item.collapsedH ?? 40;
                            return (
                              <div key={item.id} style={{ position: "absolute", left: item.collapsedX ?? pad, top: item.collapsedY ?? (pad + idx * 46), width: iW, height: iH, overflow: "hidden" }}>
                                <ItemRenderer item={item} boardId={activeBoardId} boxId={boxId} vars={vars} collapsed isFinished containerW={iW} containerH={iH} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <p className="mt-2 text-[10px] text-[var(--text-muted)]">{summaryItems.length} pinned · {box.items.length - summaryItems.length} expanded-only</p>
              </div>

              {!isFinished && (
                <div className="flex-1 overflow-y-auto p-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Add item</p>
                  <div className="flex flex-col gap-0.5">
                    {ITEM_DEFINITIONS.map((def) => (
                      <button
                        key={def.type}
                        onClick={() => addItem(activeBoardId, boxId, { ...def.defaultItem(), showInCollapsed: false })}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <span className="flex-shrink-0 text-[var(--text-muted)]">{def.icon}</span>
                        <div className="flex flex-col">
                          <span className="text-sm leading-tight">{def.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] leading-tight">{def.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Collapsed layout tab ── */}
          {rightTab === "collapsed" && (
            <div className="flex-1 overflow-y-auto">
              <CollapsedLayoutEditor box={box} boardId={activeBoardId} boxId={boxId} />
            </div>
          )}

          {/* ── Item Style tab ── */}
          {rightTab === "item" && selectedItem && (
            <div className="flex-1 overflow-y-auto">
              {selectedItem.type === "list" && (
                <ListStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type === "text" && (
                <TextStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type === "graph" && (
                <GraphStylePanel
                  item={selectedItem}
                  vars={vars}
                  boardId={activeBoardId}
                  boxId={boxId}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type === "embed" && (
                <EmbedStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type === "timer" && (
                <TimerStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type === "api" && (
                <ApiStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type === "calendar" && (
                <CalendarStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                  boardId={activeBoardId}
                  boxId={boxId}
                />
              )}
              {selectedItem.type === "table" && (
                <TableStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                  boardId={activeBoardId}
                  boxId={boxId}
                />
              )}
              {selectedItem.type === "playlist" && (
                <PlaylistStylePanel
                  item={selectedItem}
                  upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedItem.id, patch)}
                />
              )}
              {selectedItem.type !== "list" && selectedItem.type !== "text" && selectedItem.type !== "graph" && selectedItem.type !== "embed" && selectedItem.type !== "timer" && selectedItem.type !== "api" && selectedItem.type !== "calendar" && selectedItem.type !== "table" && selectedItem.type !== "playlist" && (
                <div className="p-4 text-xs text-[var(--text-muted)]">No style options for this item type.</div>
              )}
            </div>
          )}

          {/* ── Block Style tab ── */}
          {rightTab === "style" && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
              <BlockStyleEditor
                boxId={boxId}
                boardId={activeBoardId}
                style={box.style}
                onUpdate={(patch) => updateBoxStyle(activeBoardId, boxId, patch)}
              />
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}

// ─── CollapsedLayoutEditor ────────────────────────────────────────────────────

function CollapsedPreviewChip({
  item, x, y, w, h, scale, onMoveEnd, onResizeEnd,
}: {
  item: BlockItem;
  x: number; y: number; w: number; h: number;
  scale: number;
  onMoveEnd: (x: number, y: number) => void;
  onResizeEnd: (w: number, h: number) => void;
}) {
  const [livePos, setLivePos] = useState<{ x: number; y: number } | null>(null);
  const [liveSize, setLiveSize] = useState<{ w: number; h: number } | null>(null);
  const def = ITEM_DEFINITIONS.find(d => d.type === item.type);

  const displayX = (livePos?.x ?? x) * scale;
  const displayY = (livePos?.y ?? y) * scale;
  const displayW = (liveSize?.w ?? w) * scale;
  const displayH = (liveSize?.h ?? h) * scale;

  const handleDragStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setLivePos({ x: Math.max(0, x + dx), y: Math.max(0, y + dy) });
    };
    const onUp = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onMoveEnd(Math.max(0, Math.round(x + dx)), Math.max(0, Math.round(y + dy)));
      setLivePos(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setLiveSize({ w: Math.max(40, w + dx), h: Math.max(16, h + dy) });
    };
    const onUp = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      onResizeEnd(Math.max(40, Math.round(w + dx)), Math.max(16, Math.round(h + dy)));
      setLiveSize(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="absolute group/chip select-none"
      style={{
        left: displayX, top: displayY,
        width: Math.max(12, displayW), height: Math.max(8, displayH),
        background: "var(--surface-overlay)",
        border: "1.5px solid var(--accent)",
        borderRadius: 4,
        cursor: "move",
        zIndex: 1,
        overflow: "hidden",
      }}
      onPointerDown={handleDragStart}
    >
      <div className="flex items-center gap-1 px-1 h-full pointer-events-none">
        {def?.icon && <span style={{ fontSize: Math.max(8, displayH * 0.4), flexShrink: 0 }}>{def.icon}</span>}
        <span className="text-[var(--text-secondary)] truncate" style={{ fontSize: Math.max(7, displayH * 0.32) }}>{item.type}</span>
      </div>
      <div
        className="absolute bottom-0 right-0 opacity-0 group-hover/chip:opacity-70 transition-opacity"
        style={{
          width: Math.max(8, Math.min(14, displayH)),
          height: Math.max(8, Math.min(14, displayH)),
          cursor: "se-resize",
          background: "linear-gradient(135deg, transparent 50%, var(--accent) 50%)",
          borderRadius: "0 0 3px 0",
        }}
        onPointerDown={handleResizeStart}
      />
    </div>
  );
}

function CollapsedLayoutEditor({ box, boardId, boxId }: { box: Box; boardId: string; boxId: string }) {
  const { moveCollapsedItem, resizeCollapsedItem, toggleItemInCollapsed } = useBoardStore();
  const summaryItems = box.items.filter(i => i.showInCollapsed);
  const padding = box.style.padding ?? 14;

  const PREVIEW_MAX_W = 236;
  const scale = Math.min(1, PREVIEW_MAX_W / Math.max(box.width, 1));
  const previewW = Math.round(box.width * scale);
  const previewH = Math.min(180, Math.round(box.height * scale));

  return (
    <div className="flex flex-col gap-4 p-4 text-xs">
      <div>
        <SLabel>Collapsed preview</SLabel>
        <p className="text-[10px] text-[var(--text-muted)] mb-2">Drag chips to reposition · grab corner to resize</p>
        <div
          className="relative overflow-hidden rounded-xl border border-[var(--border)] mx-auto"
          style={{ width: previewW, height: previewH, background: box.style.backgroundColor, flexShrink: 0 }}
        >
          {box.style.wallpaperUrl && (
            <div aria-hidden style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: `url(${box.style.wallpaperUrl})`,
              backgroundSize: box.style.wallpaperSize ?? "cover",
              backgroundPosition: box.style.wallpaperPosition ?? "center",
              opacity: box.style.wallpaperOpacity ?? 1,
            }} />
          )}
          {summaryItems.map((item, idx) => {
            const defaultW = Math.max(80, box.width - padding * 2 - 8);
            return (
              <CollapsedPreviewChip
                key={item.id}
                item={item}
                x={item.collapsedX ?? padding}
                y={item.collapsedY ?? (padding + idx * 46)}
                w={item.collapsedW ?? defaultW}
                h={item.collapsedH ?? 40}
                scale={scale}
                onMoveEnd={(nx, ny) => moveCollapsedItem(boardId, boxId, item.id, nx, ny)}
                onResizeEnd={(nw, nh) => resizeCollapsedItem(boardId, boxId, item.id, nw, nh)}
              />
            );
          })}
          {summaryItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[10px] text-[var(--text-muted)] text-center px-3">Pin items below to see them here</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <SLabel>Pinned items</SLabel>
        <div className="flex flex-col gap-0.5">
          {box.items.map((item, idx) => {
            const def = ITEM_DEFINITIONS.find(d => d.type === item.type);
            const isPinned = item.showInCollapsed;
            const defaultW = Math.max(80, box.width - padding * 2 - 8);
            return (
              <div key={item.id} className="flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-[var(--surface-overlay)] group/pinrow">
                <button
                  onClick={() => toggleItemInCollapsed(boardId, boxId, item.id)}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border flex-shrink-0 transition-colors",
                    isPinned
                      ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]/60"
                  )}
                  title={isPinned ? "Unpin" : "Pin to collapsed view"}
                >
                  <Pin size={9} />
                </button>
                <span className="text-[var(--text-muted)] flex-shrink-0">{def?.icon}</span>
                <span className="text-[11px] text-[var(--text-secondary)] flex-1 truncate capitalize">{item.type}</span>
                {isPinned && (
                  <button
                    onClick={() => {
                      moveCollapsedItem(boardId, boxId, item.id, padding, padding + idx * 46);
                      resizeCollapsedItem(boardId, boxId, item.id, defaultW, 40);
                    }}
                    className="opacity-0 group-hover/pinrow:opacity-100 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity flex-shrink-0"
                    title="Reset position"
                  >
                    ↺
                  </button>
                )}
              </div>
            );
          })}
          {box.items.length === 0 && (
            <p className="text-[10px] text-[var(--text-muted)] text-center py-2">No items in this block yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TextStylePanel ───────────────────────────────────────────────────────────

const TEXT_BORDER_STYLES = ["solid","dashed","dotted","double","glow","none"] as const;

function TextStylePanel({ item, upd }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void }) {
  const [openPicker, setOpenPicker] = useState<"text" | "bg" | "border" | "shadow" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasBorder = (item.textBorderWidth ?? 0) > 0;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => upd({ textBgImage: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-xs">

      {/* Mode */}
      <section>
        <SLabel>Mode</SLabel>
        <div className="flex gap-1 mb-2">
          {([
            { id: undefined,   label: "Text" },
            { id: "number",    label: "Number" },
            { id: "formula",   label: "Formula" },
          ] as { id: "number" | "formula" | undefined; label: string }[]).map((m) => (
            <button key={m.label}
              onClick={() => upd({ textMode: m.id, textCalcFormula: m.id === "formula" ? (item.textCalcFormula ?? "") : undefined })}
              className={cn("flex-1 rounded py-1.5 text-[11px] font-medium transition-colors",
                item.textMode === m.id ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >{m.label}</button>
          ))}
        </div>
        {item.textMode === "number" && (
          <div>
            <p className="text-[10px] text-[var(--text-muted)] mb-1">Variable name — use <span className="font-mono text-[var(--accent)]">{"{name}"}</span> in formulas</p>
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-1.5 font-mono text-sm text-[var(--accent)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder="e.g. score"
              value={item.textVarName ?? ""}
              onChange={(e) => upd({ textVarName: e.target.value })}
            />
          </div>
        )}
      </section>

      {/* Font family + size */}
      <section>
        <SLabel>Font</SLabel>
        <div className="mb-2">
          <FontPicker
            value={item.fontFamily ?? "Inter"}
            onChange={(f) => { loadGoogleFont(f); upd({ fontFamily: f }); }}
          />
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="number" min={6} max={400}
            value={item.fontSize ?? 16}
            onChange={(e) => upd({ fontSize: Number(e.target.value) })}
            className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none"
          />
          <span className="text-[10px] text-[var(--text-muted)] self-center">px</span>
        </div>
        {/* Bold / Italic / Align */}
        <div className="flex gap-1.5 mb-1.5">
          <button onClick={() => upd({ bold: !item.bold })}
            className={cn("flex-1 rounded border py-1 text-xs font-bold transition-colors",
              item.bold ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
            )}>B</button>
          <button onClick={() => upd({ italic: !item.italic })}
            className={cn("flex-1 rounded border py-1 text-xs italic transition-colors",
              item.italic ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
            )}>I</button>
        </div>
        <div className="flex gap-1.5">
          {([["left", <AlignLeft size={11}/>], ["center", <AlignCenter size={11}/>], ["right", <AlignRight size={11}/>]] as const).map(([a, icon]) => (
            <button key={a} onClick={() => upd({ align: a })}
              className={cn("flex flex-1 items-center justify-center rounded border py-1.5 transition-colors",
                (item.align ?? "left") === a ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              )}>{icon}</button>
          ))}
        </div>
      </section>

      {/* Colors */}
      <section>
        <SLabel>Colors</SLabel>
        <div className="flex flex-col gap-2">
          <ColorRow label="Text" color={item.textColor ?? "#f2f2f2"} open={openPicker === "text"} onToggle={() => setOpenPicker((v) => v === "text" ? null : "text")} onChange={(c) => upd({ textColor: c })} />
          <ColorRow label="Background" color={item.textBgColor ?? ""} open={openPicker === "bg"} onToggle={() => setOpenPicker((v) => v === "bg" ? null : "bg")} onChange={(c) => upd({ textBgColor: c })} allowClear onClear={() => upd({ textBgColor: "" })} />
        </div>
      </section>

      {/* Corner roundness + padding */}
      <section>
        <SLabel>Shape</SLabel>
        <SliderRow label="Corners" value={item.textBorderRadius ?? 0} min={0} max={120} onChange={(v) => upd({ textBorderRadius: v })} />
        <SliderRow label="Padding" value={item.textPadding ?? 8} min={0} max={80} onChange={(v) => upd({ textPadding: v })} />
      </section>

      {/* Spacing */}
      <section>
        <SLabel>Spacing</SLabel>
        <SliderRow label="Letter" value={item.textLetterSpacing ?? 0} min={-5} max={30} step={0.5} onChange={(v) => upd({ textLetterSpacing: v })} />
        <SliderRow label="Line" value={item.textLineHeight ?? 1.5} min={0.8} max={4} step={0.1} onChange={(v) => upd({ textLineHeight: v })} decimals={1} />
      </section>

      {/* Background image */}
      <section>
        <SLabel>Background image</SLabel>
        <input
          className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Paste image URL…"
          value={item.textBgImage?.startsWith("data:") ? "" : (item.textBgImage ?? "")}
          onChange={(e) => upd({ textBgImage: e.target.value || "" })}
        />
        <div className="flex gap-1.5">
          <button onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            <Upload size={11} /> Upload
          </button>
          {item.textBgImage && <button onClick={() => upd({ textBgImage: "" })} className="rounded border border-[var(--border)] px-2.5 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">Clear</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </section>

      {/* Shadow */}
      <section>
        <SLabel>Shadow</SLabel>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {(["none","drop","hard","glow","neon"] as const).map((s) => (
            <button key={s} onClick={() => upd({ textShadow: s })}
              className={cn("rounded border py-1.5 text-[10px] capitalize transition-colors",
                (item.textShadow ?? "none") === s ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              )}>{s}</button>
          ))}
        </div>
        {item.textShadow && item.textShadow !== "none" && (
          <ColorRow label="Color" color={item.textShadowColor ?? "#000000"} open={openPicker === "shadow"} onToggle={() => setOpenPicker((v) => v === "shadow" ? null : "shadow")} onChange={(c) => upd({ textShadowColor: c })} />
        )}
      </section>

      {/* Border */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <SLabel>Border</SLabel>
          <button onClick={() => upd({ textBorderWidth: hasBorder ? 0 : 1, textBorderColor: item.textBorderColor ?? "#ffffff", textBorderStyle: "solid" })}
            className={cn("rounded px-2 py-0.5 text-[10px] transition-colors border", hasBorder ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]")}>
            {hasBorder ? "On" : "Off"}
          </button>
        </div>
        {hasBorder && (
          <>
            <ColorRow label="Color" color={item.textBorderColor ?? "#ffffff"} open={openPicker === "border"} onToggle={() => setOpenPicker((v) => v === "border" ? null : "border")} onChange={(c) => upd({ textBorderColor: c })} />
            <div className="flex gap-2 mt-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-muted)]">W</span>
                <input type="number" min={1} max={24} value={item.textBorderWidth ?? 1} onChange={(e) => upd({ textBorderWidth: Number(e.target.value) })} className="w-12 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs outline-none text-[var(--text-primary)]" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {TEXT_BORDER_STYLES.map((s) => (
                <button key={s} onClick={() => upd({ textBorderStyle: s as BlockItem["textBorderStyle"] })}
                  className={cn("rounded border py-1.5 text-[10px] capitalize transition-colors",
                    item.textBorderStyle === s ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                  )}>{s}</button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function SliderRow({ label, value, min, max, step = 1, decimals = 0, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; decimals?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="w-12 flex-shrink-0 text-[10px] text-[var(--text-muted)]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)] h-1"
      />
      <span className="w-8 text-right text-[10px] text-[var(--text-muted)] flex-shrink-0">{value.toFixed(decimals)}</span>
    </div>
  );
}

// ─── Shared ColorRow helper ───────────────────────────────────────────────────

function ColorRow({ label, color, open, onToggle, onChange, allowClear, onClear }: {
  label: string; color: string; open: boolean;
  onToggle: () => void; onChange: (c: string) => void;
  allowClear?: boolean; onClear?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-shrink-0">
        <button onClick={onToggle} className="h-7 w-9 rounded border border-[var(--border)]"
          style={{ backgroundColor: color || "transparent", backgroundImage: !color ? "repeating-linear-gradient(45deg,var(--border) 0,var(--border) 1px,transparent 0,transparent 50%) 0/6px 6px" : undefined }} />
        {open && (
          <div className="absolute top-9 left-0 z-50 rounded-lg border border-[var(--border)] shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <HexColorPicker color={color || "#1a1b1e"} onChange={onChange} />
          </div>
        )}
      </div>
      <span className="text-[10px] text-[var(--text-muted)] w-14 flex-shrink-0">{label}</span>
      <input className="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] outline-none uppercase" value={color} onChange={(e) => onChange(e.target.value)} maxLength={7} placeholder="none" />
      {allowClear && color && <button onClick={onClear} className="text-[var(--text-muted)] hover:text-red-400 text-xs px-1 flex-shrink-0">×</button>}
    </div>
  );
}

// ─── BlockStyleEditor ─────────────────────────────────────────────────────────

const BLOCK_BORDER_STYLES: { id: string; label: string }[] = [
  { id: "solid", label: "Solid" }, { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" }, { id: "double", label: "Double" },
  { id: "groove", label: "Groove" }, { id: "ridge", label: "Ridge" },
  { id: "glow", label: "Glow" }, { id: "none", label: "None" },
];

const SHADOWS = ["none", "sm", "md", "lg"] as const;

function BlockStyleEditor({ boxId, boardId, style, onUpdate }: {
  boxId: string; boardId: string; style: BoxStyle; onUpdate: (patch: Partial<BoxStyle>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [openPicker, setOpenPicker] = useState<"bg" | "border" | "font" | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onUpdate({ wallpaperUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <>
      <section>
        <SLabel>Background</SLabel>
        {!style.wallpaperUrl && (
          <div className="flex items-center gap-2 mb-2">
            <div className="relative">
              <button onClick={() => setOpenPicker((v) => v === "bg" ? null : "bg")} className="h-7 w-10 rounded border border-[var(--border)]" style={{ backgroundColor: style.backgroundColor }} />
              {openPicker === "bg" && (
                <div className="absolute top-9 left-0 z-50 rounded-lg border border-[var(--border)] shadow-xl overflow-hidden">
                  <HexColorPicker color={style.backgroundColor} onChange={(c) => onUpdate({ backgroundColor: c })} />
                </div>
              )}
            </div>
            <input className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] outline-none uppercase" value={style.backgroundColor} onChange={(e) => onUpdate({ backgroundColor: e.target.value })} maxLength={7} />
          </div>
        )}
        <input className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" placeholder="Wallpaper URL…" value={style.wallpaperUrl?.startsWith("data:") ? "" : (style.wallpaperUrl ?? "")} onChange={(e) => onUpdate({ wallpaperUrl: e.target.value || "" })} />
        <div className="flex gap-1.5 mb-2">
          <button onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"><Upload size={12} /> Upload</button>
          {style.wallpaperUrl && <button onClick={() => onUpdate({ wallpaperUrl: "" })} className="rounded border border-[var(--border)] px-2 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">Clear</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
        {style.wallpaperUrl && (
          <WallpaperEditor url={style.wallpaperUrl} size={style.wallpaperSize ?? "cover"} position={style.wallpaperPosition ?? "center"} opacity={style.wallpaperOpacity ?? 1} backgroundColor={style.backgroundColor} onSizeChange={(v) => onUpdate({ wallpaperSize: v })} onPositionChange={(v) => onUpdate({ wallpaperPosition: v })} onOpacityChange={(v) => onUpdate({ wallpaperOpacity: v })} />
        )}
      </section>

      <section>
        <SLabel>Border</SLabel>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <button onClick={() => setOpenPicker((v) => v === "border" ? null : "border")} className="h-7 w-10 rounded border border-[var(--border)]" style={{ backgroundColor: style.borderColor }} />
            {openPicker === "border" && (
              <div className="absolute top-9 left-0 z-50 rounded-lg border border-[var(--border)] shadow-xl overflow-hidden">
                <HexColorPicker color={style.borderColor} onChange={(c) => onUpdate({ borderColor: c })} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] text-[var(--text-muted)]">W</span>
            <input type="number" min={0} max={24} value={style.borderWidth} onChange={(e) => onUpdate({ borderWidth: Number(e.target.value) })} className="w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none" />
            <span className="text-[10px] text-[var(--text-muted)]">R</span>
            <input type="number" min={0} max={200} value={style.borderRadius} onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })} className="w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {BLOCK_BORDER_STYLES.map((bs) => {
            const isActive = style.borderStyle === bs.id;
            const w = Math.max(1, Math.min(style.borderWidth, 4));
            return (
              <button key={bs.id} onClick={() => onUpdate({ borderStyle: bs.id as BoxStyle["borderStyle"] })}
                className={cn("flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all", isActive ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]" : "hover:bg-[var(--surface-overlay)]")}
              >
                <div className="w-full rounded" style={{ height: 18, border: bs.id === "glow" || bs.id === "none" ? "none" : `${w}px ${bs.id} ${style.borderColor}`, boxShadow: bs.id === "glow" ? `0 0 6px 2px ${style.borderColor}` : undefined, background: bs.id === "none" ? "repeating-linear-gradient(45deg,var(--border) 0,var(--border) 1px,transparent 0,transparent 50%) 0/6px 6px" : "transparent" }} />
                <span className={cn("text-[9px]", isActive ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>{bs.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SLabel>Shadow</SLabel>
        <div className="flex gap-1.5">
          {SHADOWS.map((sh) => (
            <button key={sh} onClick={() => onUpdate({ shadow: sh })} className={cn("flex-1 rounded border py-1.5 text-xs transition-colors capitalize", style.shadow === sh ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]")}>{sh}</button>
          ))}
        </div>
      </section>

      <section>
        <SLabel>Font color</SLabel>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setOpenPicker((v) => v === "font" ? null : "font")} className="h-7 w-10 rounded border border-[var(--border)]" style={{ backgroundColor: style.fontColor ?? "#f2f2f2" }} />
            {openPicker === "font" && (
              <div className="absolute top-9 left-0 z-50 rounded-lg border border-[var(--border)] shadow-xl overflow-hidden">
                <HexColorPicker color={style.fontColor ?? "#f2f2f2"} onChange={(c) => onUpdate({ fontColor: c })} />
              </div>
            )}
          </div>
          <input className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-xs text-[var(--text-primary)] outline-none uppercase" value={style.fontColor ?? "#f2f2f2"} onChange={(e) => onUpdate({ fontColor: e.target.value })} maxLength={7} />
        </div>
      </section>

      <section>
        <SLabel>Padding</SLabel>
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={64} value={style.padding} onChange={(e) => onUpdate({ padding: Number(e.target.value) })} className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none" />
          <span className="text-xs text-[var(--text-muted)]">px</span>
        </div>
      </section>
    </>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{children}</p>;
}

