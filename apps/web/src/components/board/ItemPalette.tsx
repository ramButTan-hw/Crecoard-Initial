"use client";

import { useState } from "react";
import {
  FileText, List, Calculator, Video, Timer, ImageIcon,
  BarChart2, Gamepad2, ChevronDown, ChevronRight,
  Trash2, Plus, Code2,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { BlockItem, ItemType, DEFAULT_BOX_STYLE, useBoardStore, useActiveBoard } from "@/store/boardStore";
import { DEFAULT_WIDGET_CODE } from "@/lib/defaultWidgetCode";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";

// ─── Item definitions (exported so ExpandedBlock can reuse) ──────────────────

export const ITEM_DEFINITIONS: {
  type: ItemType;
  label: string;
  icon: React.ReactNode;
  description: string;
  defaultItem: () => Omit<BlockItem, "id" | "showInCollapsed">;
}[] = [
  {
    type: "text",
    label: "Text",
    icon: <FileText size={15} />,
    description: "Styled paragraph",
    defaultItem: () => ({ type: "text", text: "", fontSize: 14, bold: false, italic: false, align: "left" }),
  },
  {
    type: "list",
    label: "List",
    icon: <List size={15} />,
    description: "Checklist / to-do",
    defaultItem: () => ({ type: "list", listItems: [{ id: nanoid(), text: "", checked: false }], listFontAutoScale: true }),
  },
  {
    type: "variable",
    label: "Variable",
    icon: <Calculator size={15} />,
    description: "Named value or formula using {refs}",
    defaultItem: () => ({ type: "variable", varName: "", varFormula: "0" }),
  },
  {
    type: "embed",
    label: "Embed",
    icon: <Video size={15} />,
    description: "YouTube or any URL",
    defaultItem: () => ({ type: "embed", embedUrl: "" }),
  },
  {
    type: "timer",
    label: "Timer",
    icon: <Timer size={15} />,
    description: "Countdown / stopwatch",
    defaultItem: () => ({ type: "timer", timerSeconds: 300, timerLabel: "" }),
  },
  {
    type: "image",
    label: "Image",
    icon: <ImageIcon size={15} />,
    description: "Photo or illustration",
    defaultItem: () => ({ type: "image", imageUrl: "", imageObjectFit: "cover" }),
  },
  {
    type: "graph",
    label: "Graph",
    icon: <BarChart2 size={15} />,
    description: "Bar, line, or pie chart",
    defaultItem: () => ({
      type: "graph",
      graphType: "bar",
      graphData: [{ label: "A", value: 40 }, { label: "B", value: 65 }, { label: "C", value: 30 }],
    }),
  },
  {
    type: "gaming",
    label: "Game Tracker",
    icon: <Gamepad2 size={15} />,
    description: "Valorant, LoL, Apex, CS2",
    defaultItem: () => ({ type: "gaming", game: "valorant" as const, gameUsername: "", gameTag: "" }),
  },
  {
    type: "widget",
    label: "Custom Widget",
    icon: <Code2 size={15} />,
    description: "HTML · CSS · JS — build anything",
    defaultItem: () => ({ type: "widget", widgetCode: DEFAULT_WIDGET_CODE }),
  },
];

// ─── Draggable palette item ───────────────────────────────────────────────────

function DraggableItem({ def, selectedBoxId }: { def: (typeof ITEM_DEFINITIONS)[number]; selectedBoxId: string | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${def.type}`,
    data: { kind: "new-item", itemType: def.type, defaultItem: def.defaultItem },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "flex cursor-grab items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all select-none",
        isDragging ? "opacity-40" : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]",
        selectedBoxId && "text-[var(--accent)] hover:bg-[var(--accent)]/10"
      )}
      title={selectedBoxId ? "Drop onto a block or drag to canvas" : "Drag onto a block"}
    >
      <span className={cn("flex-shrink-0", selectedBoxId ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>{def.icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-sm leading-tight">{def.label}</span>
        <span className="text-[10px] text-[var(--text-muted)] leading-tight">{def.description}</span>
      </div>
    </div>
  );
}

// ─── Main palette ─────────────────────────────────────────────────────────────

export function ItemPalette() {
  const { activeBoardId, addBox, removeBox } = useBoardStore();
  const board = useActiveBoard();
  const selectedBoxId = useBoardStore((s) => s.selectedBoxId);
  const hasAppBg = useBoardStore((s) => !!s.appBg.image);
  const [open, setOpen] = useState<Record<string, boolean>>({ blocks: true, items: true });

  if (board?.isFinished) return null;

  const toggle = (k: string) => setOpen((v) => ({ ...v, [k]: !v[k] }));

  return (
    <div
      className="flex w-[196px] flex-shrink-0 flex-col overflow-y-auto border-r border-[var(--border)]"
      style={{ background: hasAppBg ? "transparent" : "var(--surface-raised)" }}
    >
      {/* Delete selected */}
      {selectedBoxId && (
        <div className="border-b border-[var(--border)] p-2">
          <button
            onClick={() => removeBox(activeBoardId, selectedBoxId)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 hover:border-red-500/70 transition-all"
          >
            <Trash2 size={14} /> Delete block
          </button>
        </div>
      )}

      {/* Add block section */}
      <div className="border-b border-[var(--border)]">
        <button
          onClick={() => toggle("blocks")}
          className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Blocks {open.blocks ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {open.blocks && (
          <div className="pb-2 px-3">
            <p className="mb-2 text-[10px] text-[var(--text-muted)]">Add an empty block to the board</p>
            <button
              onClick={() =>
                addBox(activeBoardId, {
                  x: 80 + Math.random() * 100,
                  y: 80 + Math.random() * 100,
                  width: 280,
                  height: 220,
                  locked: false,
                  title: "New block",
                  isExpanded: false,
                  items: [],
                  style: { ...DEFAULT_BOX_STYLE },
                })
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-3 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-all"
            >
              <Plus size={16} /> Add block
            </button>
          </div>
        )}
      </div>

      {/* Items section */}
      <div className="border-b border-[var(--border)]">
        <button
          onClick={() => toggle("items")}
          className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Items {open.items ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {open.items && (
          <div className="pb-2">
            <p className="px-3 pb-1 text-[10px] text-[var(--text-muted)]">
              {selectedBoxId ? "Drag onto a block below" : "Drag an item onto any block"}
            </p>
            {ITEM_DEFINITIONS.map((def) => (
              <DraggableItem key={def.type} def={def} selectedBoxId={selectedBoxId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
