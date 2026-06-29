"use client";

import { useState, useMemo } from "react";
import {
  Search, ChevronRight, ChevronDown, Layers, Server, // Layers still used for Canvas items
  Box as BoxIcon, LayoutGrid, FileText, List, Table2, Image,
  CalendarDays, Timer, Code2, Music, KanbanSquare,
  MessageSquare, FolderOpen, BarChart2, Minus, Zap, Gamepad2,
} from "lucide-react";
import { LogoMark } from "@/components/ui/LogoMark";
import { useBoardStore, type Board, type Box as StoreBox, type BoardLevelItem, type ItemType } from "@/store/boardStore";
import { MOCK_SERVERS } from "@/lib/mockServerData";
import { useServers } from "@/contexts/ServersContext";

function ItemTypeIcon({ type }: { type: ItemType }) {
  const size = 12;
  const props = { size, className: "flex-shrink-0" };
  switch (type) {
    case "text": return <FileText {...props} />;
    case "list": return <List {...props} />;
    case "table": return <Table2 {...props} />;
    case "image": return <Image {...props} />;
    case "calendar": return <CalendarDays {...props} />;
    case "timer": return <Timer {...props} />;
    case "embed": return <Code2 {...props} />;
    case "api": return <Code2 {...props} />;
    case "graph": return <BarChart2 {...props} />;
    case "playlist": return <Music {...props} />;
    case "kanban": return <KanbanSquare {...props} />;
    case "chat": return <MessageSquare {...props} />;
    case "filebank": return <FolderOpen {...props} />;
    case "widget": return <LayoutGrid {...props} />;
    case "divider": return <Minus {...props} />;
    case "embed-card":  return <Zap {...props} />;
    case "tracker-gg":  return <Gamepad2 {...props} />;
    default: return <FileText {...props} />;
  }
}

const TYPE_LABEL: Record<ItemType, string> = {
  text: "Text", list: "List", table: "Table", image: "Image",
  calendar: "Calendar", timer: "Timer", embed: "Embed", api: "API",
  graph: "Graph", playlist: "Playlist", kanban: "Kanban",
  chat: "Chat", filebank: "Files", widget: "Widget", divider: "Divider",
  "embed-card":  "Integration Card",
  "tracker-gg":  "Tracker.gg",
};

function itemPreview(item: { type: ItemType; text?: string; title?: string }): string {
  if (item.text) return item.text.slice(0, 80);
  return "";
}

function matchesSearch(text: string, q: string): boolean {
  return !q || text.toLowerCase().includes(q);
}

// ─── BoxCard ───────────────────────────────────────────────────────────────────

function BoxCard({ box, search }: { box: StoreBox; search: string }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = search
    ? box.items.filter((it) =>
        matchesSearch(TYPE_LABEL[it.type], search) || matchesSearch(it.text ?? "", search)
      )
    : box.items;

  if (search && visibleItems.length === 0 && !matchesSearch(box.title, search)) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--surface-overlay)] hover:bg-[var(--surface-raised)] transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={13} className="text-[var(--text-muted)] flex-shrink-0" /> : <ChevronRight size={13} className="text-[var(--text-muted)] flex-shrink-0" />}
        <BoxIcon size={13} className="text-[var(--accent)] flex-shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{box.title || "Untitled Block"}</span>
        <span className="text-xs text-[var(--text-muted)] flex-shrink-0">{box.items.length} item{box.items.length !== 1 ? "s" : ""}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-[var(--border)]">
          {box.items.length === 0 ? (
            <p className="px-4 py-2 text-xs text-[var(--text-muted)] italic">Empty block</p>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} className="flex items-start gap-2 px-4 py-1.5 bg-[var(--surface)]">
                <span className="text-[var(--text-muted)] mt-0.5">
                  <ItemTypeIcon type={item.type} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{TYPE_LABEL[item.type]}</span>
                  {itemPreview(item) && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{itemPreview(item)}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── CanvasItemsList ──────────────────────────────────────────────────────────

function CanvasItemsList({ items, search }: { items: BoardLevelItem[]; search: string }) {
  const visible = search
    ? items.filter((it) => matchesSearch(TYPE_LABEL[it.type], search) || matchesSearch(it.text ?? "", search))
    : items;
  if (visible.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 bg-[var(--surface-overlay)] flex items-center gap-2">
        <Layers size={13} className="text-[var(--accent)] flex-shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)]">Canvas items</span>
        <span className="text-xs text-[var(--text-muted)]">{visible.length}</span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {visible.map((item) => (
          <div key={item.id} className="flex items-start gap-2 px-4 py-1.5 bg-[var(--surface)]">
            <span className="text-[var(--text-muted)] mt-0.5">
              <ItemTypeIcon type={item.type} />
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-[var(--text-secondary)]">{TYPE_LABEL[item.type]}</span>
              {itemPreview(item) && (
                <p className="text-xs text-[var(--text-muted)] truncate">{itemPreview(item)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BoardCard ────────────────────────────────────────────────────────────────

function BoardCard({
  board, search, onOpen, isServer = false,
}: {
  board: Board; search: string; onOpen: () => void; isServer?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const q = search.toLowerCase().trim();

  const visibleBoxes = q
    ? board.boxes.filter((bx) =>
        matchesSearch(bx.title, q) || bx.items.some((it) => matchesSearch(TYPE_LABEL[it.type], q) || matchesSearch(it.text ?? "", q))
      )
    : board.boxes;

  const canvasItems = board.boardItems ?? [];
  const visibleCanvas = q
    ? canvasItems.filter((it) => matchesSearch(TYPE_LABEL[it.type], q) || matchesSearch(it.text ?? "", q))
    : canvasItems;

  const totalItems = board.boxes.reduce((acc, bx) => acc + bx.items.length, 0) + canvasItems.length;

  if (q && visibleBoxes.length === 0 && visibleCanvas.length === 0 && !matchesSearch(board.name, q)) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--surface-raised)]">
        <button
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown size={14} className="text-[var(--text-muted)] flex-shrink-0" /> : <ChevronRight size={14} className="text-[var(--text-muted)] flex-shrink-0" />}
          <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{board.name}</span>
          <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
            {board.boxes.length} block{board.boxes.length !== 1 ? "s" : ""} · {totalItems} item{totalItems !== 1 ? "s" : ""}
          </span>
        </button>
        {!isServer && (
          <button
            onClick={onOpen}
            className="text-xs text-[var(--accent)] hover:underline flex-shrink-0 px-1"
          >
            Open
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-3 space-y-2 bg-[var(--surface)]">
          {visibleBoxes.length === 0 && visibleCanvas.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic px-1">
              {q ? "No matching content." : "Board is empty."}
            </p>
          ) : (
            <>
              {visibleBoxes.map((box) => (
                <BoxCard key={box.id} box={box} search={q} />
              ))}
              <CanvasItemsList items={visibleCanvas} search={q} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CollectionView ───────────────────────────────────────────────────────────

interface Props {
  onBoardSelect: (boardId: string) => void;
  onServerSelect: (serverId: string) => void;
}

export function CollectionView({ onBoardSelect, onServerSelect }: Props) {
  const [search, setSearch] = useState("");
  const boards = useBoardStore((s) => s.boards);
  const serverBoards = useBoardStore((s) => s.serverBoards);
  const { servers: realServers } = useServers();

  const personalBoards = useMemo(
    () => boards.filter((b) => !b.serverId && !b.deletedAt),
    [boards]
  );

  const serverGroups = useMemo(() => {
    const all = [
      ...realServers.map((s) => ({ id: s.id, name: s.name, boardId: s.boardId })),
      ...MOCK_SERVERS.map((s) => ({ id: s.id, name: s.name, boardId: s.boardId })),
    ];
    return all.map((s) => ({ server: s, board: serverBoards[s.boardId] })).filter((g) => !!g.board);
  }, [realServers, serverBoards]);

  const q = search.toLowerCase().trim();

  const totalPersonalItems = personalBoards.reduce(
    (acc, b) => acc + b.boxes.reduce((a, bx) => a + bx.items.length, 0) + (b.boardItems?.length ?? 0),
    0
  );

  return (
    <div className="flex flex-col h-full bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
        <LayoutGrid size={17} className="text-[var(--text-muted)] flex-shrink-0" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">Collection</h2>
        <div className="flex-1 relative ml-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items, blocks, boards…"
            className="w-full h-7 pl-8 pr-3 rounded-lg bg-[var(--surface-overlay)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Personal boards */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <LogoMark size={14} bodyColor="var(--text-muted)" eyeColor="var(--surface-raised)" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Personal Boards
            </h3>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-overlay)] rounded-full px-1.5 py-0.5">
              {personalBoards.length}
            </span>
          </div>

          {personalBoards.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] italic pl-1">No personal boards yet.</p>
          ) : (
            <div className="space-y-2 max-w-2xl">
              {personalBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  search={q}
                  onOpen={() => onBoardSelect(board.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Server boards */}
        {serverGroups.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Server size={14} className="text-[var(--text-muted)]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Server Boards
              </h3>
              <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-overlay)] rounded-full px-1.5 py-0.5">
                {serverGroups.length}
              </span>
            </div>

            <div className="space-y-4 max-w-2xl">
              {serverGroups.map(({ server, board }) => (
                <div key={server.id}>
                  <div className="flex items-center gap-2 mb-2 pl-1">
                    <Server size={12} className="text-[var(--accent)]" />
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">{server.name}</span>
                    <button
                      onClick={() => onServerSelect(server.id)}
                      className="text-[11px] text-[var(--accent)] hover:underline ml-1"
                    >
                      Open server
                    </button>
                  </div>
                  <BoardCard
                    board={board}
                    search={q}
                    onOpen={() => onServerSelect(server.id)}
                    isServer
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state when search yields nothing */}
        {q && personalBoards.every((b) => {
          const bq = q;
          return !matchesSearch(b.name, bq) &&
            b.boxes.every((bx) => !matchesSearch(bx.title, bq) && bx.items.every((it) => !matchesSearch(TYPE_LABEL[it.type], bq) && !matchesSearch(it.text ?? "", bq))) &&
            (b.boardItems ?? []).every((it) => !matchesSearch(TYPE_LABEL[it.type], bq) && !matchesSearch(it.text ?? "", bq));
        }) && serverGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--text-muted)]">
            <Search size={28} style={{ opacity: 0.25 }} />
            <p className="text-sm">No results for &ldquo;{search}&rdquo;</p>
          </div>
        )}
      </div>
    </div>
  );
}
