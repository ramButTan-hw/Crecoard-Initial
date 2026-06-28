"use client";

import {
  FileText, List, Video, Timer,
  BarChart2, Plug, CalendarDays, Table2,
  Code2, Music, Kanban, MessageSquare, FolderOpen,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { BlockItem, ItemType, DEFAULT_BOX_STYLE, useBoardStore, useActiveBoard } from "@/store/boardStore";
import { useHasAppBg } from "@/lib/useHasAppBg";
import { useServerBoard, useServerBoardData } from "@/contexts/ServerBoardContext";
import { DEFAULT_WIDGET_CODE } from "@/lib/defaultWidgetCode";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";

// ─── Item definitions (exported so ExpandedBlock can reuse) ──────────────────

export const ITEM_DEFINITIONS: {
  type: ItemType;
  label: string;
  icon: React.ReactNode;
  description: string;
  serverOnly?: boolean;
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
    type: "api",
    label: "API",
    icon: <Plug size={15} />,
    description: "Fetch data from any REST API",
    defaultItem: () => ({ type: "api", apiMethod: "GET" as const, apiDisplayMode: "value" as const }),
  },
  {
    type: "table",
    label: "Table",
    icon: <Table2 size={15} />,
    description: "Notion-style editable table",
    defaultItem: () => ({
      type: "table",
      tableColumns: [
        { id: "c1", name: "Name", type: "text" as const },
        { id: "c2", name: "Status", type: "select" as const, options: ["Todo", "In Progress", "Done"] },
        { id: "c3", name: "Done", type: "checkbox" as const },
      ],
      tableRows: [
        { id: "r1", cells: { c1: "", c2: "Todo", c3: false } },
        { id: "r2", cells: { c1: "", c2: "Todo", c3: false } },
      ],
    }),
  },
  {
    type: "calendar",
    label: "Calendar",
    icon: <CalendarDays size={15} />,
    description: "Monthly calendar with events",
    defaultItem: () => ({ type: "calendar", calendarEvents: [], calendarShowWeekends: true }),
  },
  {
    type: "widget",
    label: "Custom Widget",
    icon: <Code2 size={15} />,
    description: "HTML · CSS · JS — build anything",
    defaultItem: () => ({ type: "widget", widgetCode: DEFAULT_WIDGET_CODE }),
  },
  {
    type: "playlist",
    label: "Playlist",
    icon: <Music size={15} />,
    description: "Music queue — YouTube, Spotify, SoundCloud & more",
    defaultItem: () => ({ type: "playlist", playlistTracks: [], playlistCurrentIndex: 0, playlistLoop: true }),
  },
  {
    type: "kanban",
    label: "Kanban",
    icon: <Kanban size={15} />,
    description: "Drag-and-drop card board",
    defaultItem: () => ({
      type: "kanban",
      kanbanColumns: [
        { id: "col-todo",       title: "To Do",       color: "#d59ee8" },
        { id: "col-inprogress", title: "In Progress",  color: "#f2994a" },
        { id: "col-done",       title: "Done",         color: "#48cfa6" },
      ],
      kanbanCards: [
        { id: nanoid(), columnId: "col-todo",       text: "Plan the week",   order: 0 },
        { id: nanoid(), columnId: "col-todo",       text: "Research topic",  order: 1 },
        { id: nanoid(), columnId: "col-inprogress", text: "Write outline",   order: 0 },
        { id: nanoid(), columnId: "col-done",       text: "Brainstorm ideas", order: 0 },
      ],
    }),
  },
  {
    type: "chat",
    label: "Chat Channel",
    icon: <MessageSquare size={15} />,
    description: "Discord-style chat block",
    serverOnly: true,
    defaultItem: () => ({ type: "chat", chatChannelName: "general", chatMessages: [] }),
  },
  {
    type: "filebank",
    label: "File Bank",
    icon: <FolderOpen size={15} />,
    description: "Shared file storage block",
    serverOnly: true,
    defaultItem: () => ({ type: "filebank", fileBankTitle: "Files", fileBankFiles: [] }),
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
      title="Drag onto a block or to empty canvas to place directly"
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
  const personalBoard = useActiveBoard();
  const serverBoard = useServerBoardData();
  const board = serverBoard ?? personalBoard;
  const selectedBoxId = useBoardStore((s) => s.selectedBoxId);
  const hasAppBg = useHasAppBg();
  const { serverId } = useServerBoard();
  const visibleDefs = ITEM_DEFINITIONS.filter(d => !d.serverOnly || serverId !== null);

  if (board?.isFinished) return null;

  return (
    <div
      className="flex w-[196px] flex-shrink-0 flex-col overflow-y-auto border-r border-[var(--border)]"
      style={{ background: hasAppBg ? "transparent" : "var(--surface-raised)" }}
    >
      {/* Items section — always open, no toggle */}
      <div className="border-b border-[var(--border)]">
        <div className="flex w-full items-center justify-between px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Items
        </div>
        <div className="pb-2">
          {visibleDefs.map((def) => (
            <DraggableItem key={def.type} def={def} selectedBoxId={selectedBoxId} />
          ))}
        </div>
      </div>
    </div>
  );
}
