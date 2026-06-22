"use client";

import { useCallback, useRef, useState } from "react";
import {
  DndContext, DragEndEvent, MouseSensor, TouchSensor,
  useSensor, useSensors, useDraggable,
} from "@dnd-kit/core";
import { snapToGrid } from "@/lib/snapToGrid";
import { CSS } from "@dnd-kit/utilities";
import { X, Pin, PinOff, GripVertical, Grid3X3, Upload } from "lucide-react";
import {
  useBoardStore, useActiveBoard, resolveVars,
  BlockItem, ItemType, BoxStyle,
} from "@/store/boardStore";
import { ItemRenderer, ListStylePanel } from "@/components/items/ItemRenderer";
import { ITEM_DEFINITIONS } from "./ItemPalette";
import { WallpaperEditor } from "@/components/ui/WallpaperEditor";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";

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
  gaming:   { w: 380, h: 240 },
  divider:  { w: 420, h: 44  },
  widget:   { w: 480, h: 340 },
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
  onDelete, onTogglePin, isSelected, onSelect,
}: {
  item: BlockItem;
  boardId: string;
  boxId: string;
  vars: Record<string, number>;
  isFinished: boolean;
  layout: { x: number; y: number; w: number; h: number };
  onDelete: () => void;
  onTogglePin: () => void;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { resizeExpandedItem } = useBoardStore();
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
      setLiveSize({
        w: Math.max(MIN_W, snap(resizeStart.current.w + ev.clientX - resizeStart.current.x)),
        h: Math.max(MIN_H, snap(resizeStart.current.h + ev.clientY - resizeStart.current.y)),
      });
    };
    const onUp = (ev: MouseEvent) => {
      resizing.current = false;
      resizeExpandedItem(boardId, boxId, item.id,
        Math.max(MIN_W, snap(resizeStart.current.w + ev.clientX - resizeStart.current.x)),
        Math.max(MIN_H, snap(resizeStart.current.h + ev.clientY - resizeStart.current.y)),
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
  const isText = item.type === "text";
  const isList = item.type === "list";

  // List wallpaper applied to card container
  const hasWallpaper = isList && !!item.listWallpaperUrl;

  return (
    <div
      ref={setDragRef}
      className={cn("absolute group flex flex-col", isDragging && "opacity-40 z-50")}
      style={{
        left: layout.x, top: layout.y,
        width: displayW, height: displayH,
        transform: transformStyle,
        zIndex: isDragging ? 50 : 1,
        // List + text: transparent/borderless by default
        // Other items: subtle card
        background: isText || isList ? "transparent" : "var(--surface-raised)",
        borderRadius: isText ? 0 : 12,
        border: isText || isList
          ? isSelected ? "1.5px solid var(--accent)" : "1.5px solid transparent"
          : isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
        overflow: isText ? "visible" : "hidden",
        transition: "border-color 0.15s",
      }}
      onClick={() => isList && onSelect()}
    >
      {/* Wallpaper layer for list cards */}
      {hasWallpaper && (
        <div aria-hidden style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", borderRadius: "inherit",
          backgroundImage: `url(${item.listWallpaperUrl})`,
          backgroundSize: item.listWallpaperSize ?? "cover",
          backgroundPosition: item.listWallpaperPosition ?? "center",
          backgroundRepeat: "no-repeat",
          opacity: item.listWallpaperOpacity ?? 1,
        }} />
      )}

      {/* Hover controls — drag handle (top center) + pin/delete (top right) */}
      {!isFinished && (
        <>
          <span
            {...attributes}
            {...listeners}
            className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-grab touch-none flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] shadow"
          >
            <GripVertical size={11} />
          </span>
          <div className="absolute top-1 right-1 z-20 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {item.showInCollapsed && (
              <span className="rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--accent)] leading-none flex items-center">S</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              title={item.showInCollapsed ? "Remove from summary" : "Pin to summary"}
              className={cn("flex h-5 w-5 items-center justify-center rounded-full border shadow transition-colors",
                item.showInCollapsed ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]" : "border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--accent)]")}
            >
              {item.showInCollapsed ? <Pin size={9} /> : <PinOff size={9} />}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] shadow hover:border-red-500/50 hover:text-red-400 transition-colors"
            >
              <X size={9} />
            </button>
          </div>
        </>
      )}

      {/* Content */}
      <div
        className={cn("relative flex-1 overflow-auto", isList ? "" : "p-3")}
        style={{ zIndex: 1 }}
      >
        <ItemRenderer
          item={item} boardId={boardId} boxId={boxId} vars={vars}
          collapsed={false} isFinished={isFinished}
          containerW={displayW}
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
    </div>
  );
}

// ─── Main ExpandedBlock ───────────────────────────────────────────────────────

export function ExpandedBlock({ boxId }: { boxId: string }) {
  const { activeBoardId, setExpandedBox, removeItem, toggleItemInCollapsed, addItem, moveExpandedItem, updateBox, updateBoxStyle } = useBoardStore();
  const board = useActiveBoard();
  const box = board?.boxes.find((b) => b.id === boxId);
  const [showGrid, setShowGrid] = useState(true);
  const [rightTab, setRightTab] = useState<"items" | "list" | "style">("items");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 4 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);

  if (!box) return null;

  const isFinished = board?.isFinished ?? false;
  const vars = resolveVars(box.items);
  const summaryItems = box.items.filter((i) => i.showInCollapsed);
  const selectedList = selectedListId ? box.items.find((i) => i.id === selectedListId) : null;

  const close = () => setExpandedBox(null);

  const handleDragEnd = (e: DragEndEvent) => {
    if (e.active.data.current?.kind !== "expanded-item") return;
    const itemId = e.active.id as string;
    const item = box.items.find((i) => i.id === itemId);
    if (!item || !e.delta) return;
    const layout = getDefaultLayout(item, box.items.indexOf(item));
    moveExpandedItem(activeBoardId, boxId, itemId,
      Math.max(0, snap(layout.x + e.delta.x)),
      Math.max(0, snap(layout.y + e.delta.y))
    );
  };

  const handleListSelect = (itemId: string) => {
    setSelectedListId((prev) => prev === itemId ? null : itemId);
    setRightTab("list");
  };

  // Click on canvas background deselects list
  const handleCanvasClick = () => {
    setSelectedListId(null);
    if (rightTab === "list") setRightTab("items");
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
          <div className="flex-1 overflow-auto relative" onClick={handleCanvasClick}>
            <DndContext sensors={sensors} modifiers={[snapToGrid]} onDragEnd={handleDragEnd}>
              <div
                className={cn("relative", showGrid && "board-grid")}
                style={{ minWidth: 2400, minHeight: 1800, backgroundColor: box.style.backgroundColor, zIndex: 1 }}
                onClick={(e) => e.stopPropagation()}
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
                      onDelete={() => removeItem(activeBoardId, boxId, item.id)}
                      onTogglePin={() => toggleItemInCollapsed(activeBoardId, boxId, item.id)}
                      isSelected={selectedListId === item.id}
                      onSelect={() => handleListSelect(item.id)}
                    />
                  );
                })}

                {box.items.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
                    <span className="text-5xl">📦</span>
                    <p className="text-base font-medium text-[var(--text-secondary)]">This block is empty</p>
                    <p className="text-sm text-[var(--text-muted)]">Add items from the right panel →</p>
                  </div>
                )}
              </div>
            </DndContext>
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────────────── */}
        <div className="flex w-[280px] flex-shrink-0 flex-col border-l border-[var(--border)]" style={{ background: "var(--surface-raised)" }}>
          {/* Tabs */}
          <div className="flex shrink-0 gap-0.5 border-b border-[var(--border)] px-3 pt-3 pb-2">
            <div className="flex gap-0.5 rounded-lg bg-[var(--surface-overlay)] p-0.5 w-full">
              {([
                { id: "items", label: "Items" },
                ...(selectedList ? [{ id: "list", label: "List Style" }] : []),
                { id: "style", label: "Style" },
              ] as { id: string; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setRightTab(t.id as typeof rightTab)}
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
                <div
                  className="rounded-xl border p-3 flex flex-col gap-2 max-h-[180px] overflow-auto"
                  style={{
                    borderColor: box.style.borderColor,
                    backgroundColor: box.style.backgroundColor + "cc",
                    backgroundImage: box.style.wallpaperUrl ? `url(${box.style.wallpaperUrl})` : undefined,
                    backgroundSize: box.style.wallpaperSize ?? "cover",
                    backgroundPosition: box.style.wallpaperPosition ?? "center",
                    color: box.style.fontColor,
                    fontFamily: box.style.fontFamily,
                  }}
                >
                  <p className="text-xs font-semibold truncate">{box.title || "Untitled"}</p>
                  {summaryItems.length === 0
                    ? <p className="text-[10px] opacity-50 italic">Pin items using the <Pin size={9} className="inline" /> button</p>
                    : summaryItems.map((item) => (
                      <div key={item.id} className="min-w-0">
                        <ItemRenderer item={item} boardId={activeBoardId} boxId={boxId} vars={vars} collapsed isFinished />
                      </div>
                    ))
                  }
                </div>
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

          {/* ── List Style tab ── */}
          {rightTab === "list" && selectedList && (
            <div className="flex-1 overflow-y-auto">
              <ListStylePanel
                item={selectedList}
                upd={(patch) => useBoardStore.getState().updateItem(activeBoardId, boxId, selectedList.id, patch)}
              />
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
        </div>
      </div>
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
