"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Search, Upload, Heart, Download, Sparkles, ChevronDown,
} from "lucide-react";
import {
  CommunityBoard, FetchOptions, SortOrder, TemplateCategory, TemplateKind,
  TEMPLATE_CATEGORIES, TEMPLATE_KINDS, fetchCommunityBoards, publishCommunityBoard,
  trackBoardUse, likeCommunityBoard, fetchMyLikes, PublishBoardInput, TemplateBox,
} from "@/lib/communityTemplates";
import { useBoardStore, useActiveBoard, type BlockItem, type BoardLevelItem } from "@/store/boardStore";
import { useUser } from "@/contexts/UserContext";
import { WIDGET_PERMISSIONS, collectTemplatePermissions, type WidgetPermission } from "@/lib/widgetApi";
import { installItem } from "@/lib/installedItems";
import { cn } from "@/lib/utils";

// ─── Main modal ───────────────────────────────────────────────────────────────

interface TemplatesModalProps {
  onClose: () => void;
}

export function TemplatesModal({ onClose }: TemplatesModalProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [kindFilter, setKindFilter] = useState<TemplateKind | "all">("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [search, setSearch] = useState("");
  const [boards, setBoards] = useState<CommunityBoard[]>([]);
  const [myLikes, setMyLikes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isLoggedIn } = useUser();
  const createBoardFromTemplate = useBoardStore((s) => s.createBoardFromTemplate);
  const insertTemplateBoxes = useBoardStore((s) => s.insertTemplateBoxes);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const atBoardLimit = useBoardStore((s) => s.boards.filter((b) => !b.serverId && !b.deletedAt).length >= 3);

  // Fetch whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const opts: FetchOptions = {
      category: activeCategory,
      kind: kindFilter,
      sort,
      search: search.trim() || undefined,
    };
    fetchCommunityBoards(opts).then((data) => {
      if (!cancelled) { setBoards(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setBoards([]); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [activeCategory, kindFilter, sort, search, refreshTick]);

  // My liked entries (drives the filled hearts) — once per open
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchMyLikes().then(setMyLikes).catch(() => {});
  }, [isLoggedIn]);

  const [pendingUse, setPendingUse] = useState<{ board: CommunityBoard; perms: WidgetPermission[] } | null>(null);

  // Widget permissions never apply silently — strip them unless the installer consents.
  const stripPerms = (b: CommunityBoard): CommunityBoard => ({
    ...b,
    boardData: {
      ...b.boardData,
      boxes: b.boardData.boxes.map((box) => ({
        ...box,
        items: box.items.map(({ widgetPermissions: _wp, ...rest }) => rest),
      })),
    },
  });

  const applyUse = (board: CommunityBoard, allowPerms: boolean) => {
    const entry = allowPerms ? board : stripPerms(board);
    trackBoardUse(entry.id).catch(() => {/* fire-and-forget */});
    if (entry.kind === "board") {
      createBoardFromTemplate(entry);
    } else {
      if (!activeBoardId) return;
      insertTemplateBoxes(activeBoardId, entry.boardData.boxes);
    }
    // Item-kind entries also join the palette's "Installed" library for easy re-adding
    // (stored with exactly the permissions consented to above).
    if (entry.kind === "item") {
      const tItem = entry.boardData.boxes[0]?.items[0];
      if (tItem) installItem({ id: entry.id, name: entry.name, author: entry.author.name, item: tItem });
    }
    setPendingUse(null);
    onClose();
  };

  const handleUse = (board: CommunityBoard) => {
    const perms = collectTemplatePermissions(board.boardData.boxes);
    if (perms.length > 0) {
      setPendingUse({ board, perms });
      return;
    }
    applyUse(board, false);
  };

  const handleLike = async (board: CommunityBoard) => {
    if (!isLoggedIn) return;
    const res = await likeCommunityBoard(board.id);
    if (!res) return;
    setMyLikes((prev) => {
      const next = new Set(prev);
      if (res.liked) next.add(board.id); else next.delete(board.id);
      return next;
    });
    setBoards((prev) => prev.map((b) => b.id === board.id ? { ...b, likes: res.likes } : b));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: "min(92vw, 920px)", maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Sparkles size={18} className="text-[var(--accent)] shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight">Community</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-tight">
                Browse and share boards, blocks, and custom items.
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-overlay)] border border-[var(--border)] px-2.5 py-1.5 w-52">
            <Search size={12} className="text-[var(--text-muted)] shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boards…"
              className="flex-1 min-w-0 bg-transparent text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Kind filter */}
          <div className="relative">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as TemplateKind | "all")}
              className="appearance-none bg-[var(--surface-overlay)] border border-[var(--border)] rounded-lg px-3 py-1.5 pr-7 text-[12px] text-[var(--text-secondary)] outline-none cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
            >
              <option value="all">All types</option>
              {TEMPLATE_KINDS.map((k) => (
                <option key={k.id} value={k.id}>{k.plural}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              className="appearance-none bg-[var(--surface-overlay)] border border-[var(--border)] rounded-lg px-3 py-1.5 pr-7 text-[12px] text-[var(--text-secondary)] outline-none cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
            >
              <option value="newest">Newest</option>
              <option value="most_used">Most used</option>
              <option value="most_liked">Most liked</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
          </div>

          {/* Share button */}
          <button
            onClick={() => setShowPublish(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 transition-opacity shrink-0"
          >
            <Upload size={13} />
            Share
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-[var(--border)] shrink-0 overflow-x-auto">
          <TabBtn active={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
            All
          </TabBtn>
          {TEMPLATE_CATEGORIES.map((cat) => (
            <TabBtn
              key={cat.id}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </TabBtn>
          ))}
        </div>

        {/* ── Board grid ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <SkeletonGrid />
          ) : boards.length === 0 ? (
            <EmptyState
              hasSearch={!!search || activeCategory !== "all"}
              onShare={() => setShowPublish(true)}
              onClear={() => { setSearch(""); setActiveCategory("all"); }}
            />
          ) : (
            <>
              {atBoardLimit && (
                <p className="mb-3 text-xs text-[var(--text-muted)] text-center">
                  Board limit reached (3 max) — board templates disabled; blocks and items still work.
                </p>
              )}
              <div className="grid grid-cols-3 gap-4">
                {boards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onUse={handleUse}
                    disabled={atBoardLimit && board.kind === "board"}
                    liked={myLikes.has(board.id)}
                    canLike={isLoggedIn}
                    onLike={handleLike}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Publish sub-modal ── */}
      {showPublish && (
        <PublishModal
          onClose={() => setShowPublish(false)}
          onPublished={() => { setShowPublish(false); setRefreshTick((t) => t + 1); }}
        />
      )}

      {/* ── Permission consent (entries containing widgets with plugin API access) ── */}
      {pendingUse && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setPendingUse(null)}
        >
          <div
            className="flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
            style={{ width: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">This item requests permissions</h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                “{pendingUse.board.name}” contains a widget that wants to use the plugin API.
              </p>
            </div>
            <div className="p-5 flex flex-col gap-3">
              {pendingUse.perms.map((id) => {
                const def = WIDGET_PERMISSIONS.find((p) => p.id === id);
                if (!def) return null;
                return (
                  <div key={id} className="flex flex-col">
                    <span className="text-xs font-medium text-[var(--text-primary)]">{def.label}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{def.description}</span>
                  </div>
                );
              })}
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                Widgets always run sandboxed — permissions only unlock the specific abilities listed above,
                and you can revoke them any time in the widget’s Permissions tab.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => applyUse(pendingUse.board, false)}
                className="px-4 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-colors"
              >
                Add without permissions
              </button>
              <button
                onClick={() => applyUse(pendingUse.board, true)}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
              >
                Allow & add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function BoardCard({ board, onUse, disabled, liked, canLike, onLike }: {
  board: CommunityBoard;
  onUse: (b: CommunityBoard) => void;
  disabled?: boolean;
  liked?: boolean;
  canLike?: boolean;
  onLike?: (b: CommunityBoard) => void;
}) {
  const cat = TEMPLATE_CATEGORIES.find((c) => c.id === board.category);
  const kindLabel = TEMPLATE_KINDS.find((k) => k.id === board.kind)?.label ?? "Board";
  const useLabel = board.kind === "board" ? "Use board" : board.kind === "box" ? "Add block" : "Add item";
  return (
    <div
      onClick={() => !disabled && onUse(board)}
      className={cn(
        "flex flex-col rounded-xl border border-[var(--border)] overflow-hidden transition-colors",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group hover:border-[var(--accent)]/50"
      )}
    >
      {/* Preview */}
      <div className="h-36 relative overflow-hidden shrink-0 bg-[var(--surface-overlay)]">
        {board.previewUrl ? (
          <img src={board.previewUrl} alt={board.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl opacity-30 select-none">{cat?.emoji ?? "✨"}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-[var(--accent)]/0 group-hover:bg-[var(--accent)]/5 transition-colors" />
        <span className="absolute bottom-2 right-2 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--accent)] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow">
          {useLabel}
        </span>
        {cat && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
            {cat.emoji} {cat.label}
          </span>
        )}
        <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
          {kindLabel}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 bg-[var(--surface-raised)] flex-1">
        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{board.name}</span>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed line-clamp-2">{board.description}</p>

        {/* Author + stats */}
        <div className="flex items-center gap-2 mt-auto pt-1.5 border-t border-[var(--border)]">
          <AuthorAvatar name={board.author.name} avatarUrl={board.author.avatarUrl} />
          <span className="text-[11px] text-[var(--text-muted)] truncate flex-1">{board.author.name}</span>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); if (canLike) onLike?.(board); }}
              title={canLike ? (liked ? "Unlike" : "Like") : "Sign in to like"}
              className={cn(
                "flex items-center gap-0.5 text-[11px] transition-colors",
                liked ? "text-red-400" : "text-[var(--text-muted)]",
                canLike ? "hover:text-red-400 cursor-pointer" : "cursor-default"
              )}
            >
              <Heart size={9} fill={liked ? "currentColor" : "none"} /> {board.likes.toLocaleString()}
            </button>
            <StatPill icon={<Download size={9} />} value={board.uses} />
          </div>
        </div>

        {/* Tags */}
        {board.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {board.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-overlay)] text-[var(--text-muted)]">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch, onShare, onClear,
}: {
  hasSearch: boolean;
  onShare: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {hasSearch ? "Nothing matches your filters" : "Nothing here yet"}
        </p>
        <p className="text-[12px] text-[var(--text-muted)] mt-1">
          {hasSearch
            ? "Try a different search, type, or category."
            : "Be the first — share a board, a block, or a custom item you built."}
        </p>
      </div>
      {hasSearch ? (
        <button
          onClick={onClear}
          className="text-[12px] text-[var(--accent)] hover:opacity-70 transition-opacity"
        >
          Clear filters
        </button>
      ) : (
        <button
          onClick={onShare}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
        >
          <Upload size={13} />
          Share your first board
        </button>
      )}
    </div>
  );
}

// ─── Publish modal ────────────────────────────────────────────────────────────

function PublishModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const board = useActiveBoard();
  const { identity, isLoggedIn } = useUser();
  const [kind, setKind] = useState<TemplateKind>("board");
  const [name, setName] = useState(board?.name ?? "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("productivity");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Sharable blocks (decks and deck slides excluded — they don't round-trip cleanly)
  const shareableBoxes = (board?.boxes ?? []).filter((b) => !b.deckOwnerId && !b.isDeck);
  // Canvas-level items (widgets/pets placed directly on the board) are publishable too
  const CANVAS_SOURCE = "__canvas__";
  const canvasItems = board?.boardItems ?? [];
  const [boxId, setBoxId] = useState<string>("");
  const selectedBox = boxId === CANVAS_SOURCE ? undefined : shareableBoxes.find((b) => b.id === boxId);
  const [itemId, setItemId] = useState<string>("");
  const sourceItems: (BlockItem | BoardLevelItem)[] = boxId === CANVAS_SOURCE ? canvasItems : (selectedBox?.items ?? []);
  const selectedItem = sourceItems.find((i) => i.id === itemId);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags((prev) => [...prev, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  // Published items must not carry instance identity, private widget state, or canvas placement
  const stripItem = (raw: BlockItem | BoardLevelItem): Omit<BlockItem, "id" | "showInCollapsed"> => {
    const { id: _id, showInCollapsed: _sc, widgetState: _ws, ...rest } = raw as BlockItem & Partial<BoardLevelItem>;
    const r = rest as Record<string, unknown>;
    delete r.boardX; delete r.boardY; delete r.boardW; delete r.boardH; delete r.zIndex; delete r.locked;
    return rest as Omit<BlockItem, "id" | "showInCollapsed">;
  };

  const toTemplateBox = (b: (typeof shareableBoxes)[number], atOrigin: boolean): TemplateBox => ({
    title: b.title,
    x: atOrigin ? 0 : b.x,
    y: atOrigin ? 0 : b.y,
    width: b.width,
    height: b.height,
    style: {
      backgroundColor: b.style.backgroundColor,
      borderColor: b.style.borderColor,
      borderWidth: b.style.borderWidth,
      borderRadius: b.style.borderRadius,
      borderStyle: b.style.borderStyle,
      shadow: b.style.shadow,
    },
    items: b.items.map(stripItem),
  });

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setErrorMsg("Name and description are required.");
      return;
    }
    if (!board) return;
    if (kind === "box" && !selectedBox) { setErrorMsg("Pick a block to share."); return; }
    if (kind === "item" && !selectedItem) { setErrorMsg("Pick a source and an item to share."); return; }
    setStatus("loading");
    setErrorMsg("");

    const boardData =
      kind === "board"
        ? {
            backgroundColor: board.backgroundColor,
            boxes: shareableBoxes.map((b) => toTemplateBox(b, false)),
          }
        : kind === "box"
          ? { boxes: [toTemplateBox(selectedBox!, true)] }
          : {
              boxes: [{
                title: name.trim(),
                x: 0,
                y: 0,
                width: (selectedItem as Partial<BoardLevelItem>).boardW ?? 340,
                height: (selectedItem as Partial<BoardLevelItem>).boardH ?? 400,
                items: [stripItem(selectedItem!)],
              }],
            };

    const input: PublishBoardInput = {
      kind,
      name: name.trim(),
      description: description.trim(),
      category,
      tags,
      boardData,
      authorId: isLoggedIn ? identity.userId : undefined,
      authorName: identity.displayName,
      authorAvatarUrl: identity.avatarUrl,
    };

    try {
      await publishCommunityBoard(input);
      onPublished();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 480, maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Share to Community</h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Share your whole board, one block, or a single item.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <Field label="What to share">
            <div className="flex gap-1.5">
              {TEMPLATE_KINDS.map((k) => (
                <button
                  key={k.id}
                  onClick={() => { setKind(k.id); setErrorMsg(""); }}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors",
                    kind === k.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40"
                  )}
                >
                  {k.id === "board" ? "Whole board" : k.id === "box" ? "One block" : "One item"}
                </button>
              ))}
            </div>
          </Field>

          {kind !== "board" && (
            <Field label={kind === "item" ? "Source" : "Block"}>
              <div className="relative">
                <select
                  value={boxId}
                  onChange={(e) => { setBoxId(e.target.value); setItemId(""); }}
                  className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 pr-8 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60 cursor-pointer"
                >
                  <option value="">— Pick {kind === "item" ? "a source" : "a block"} —</option>
                  {kind === "item" && canvasItems.length > 0 && (
                    <option value={CANVAS_SOURCE}>Canvas ({canvasItems.length} items placed on the board)</option>
                  )}
                  {shareableBoxes.map((b) => (
                    <option key={b.id} value={b.id}>{b.title || "Untitled block"} ({b.items.length} items)</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </Field>
          )}

          {kind === "item" && boxId && (
            <Field label="Item">
              <div className="relative">
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 pr-8 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60 cursor-pointer"
                >
                  <option value="">— Pick an item —</option>
                  {sourceItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.type.charAt(0).toUpperCase() + it.type.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </Field>
          )}

          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Give your board a clear name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60 transition-colors placeholder:text-[var(--text-muted)]"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="What's this board for? Who would benefit from it?"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60 transition-colors placeholder:text-[var(--text-muted)] resize-none"
            />
            <span className="text-[11px] text-[var(--text-muted)] self-end">{description.length}/280</span>
          </Field>

          <Field label="Category">
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 pr-8 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60 cursor-pointer"
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </Field>

          <Field label={`Tags (${tags.length}/5)`}>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                placeholder="Type a tag and press Enter"
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/60 transition-colors placeholder:text-[var(--text-muted)]"
              />
              <button
                onClick={addTag}
                disabled={tags.length >= 5}
                className="px-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--border)] text-[12px] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20">
                    {t}
                    <button onClick={() => removeTag(t)} className="hover:opacity-60 transition-opacity"><X size={8} /></button>
                  </span>
                ))}
              </div>
            )}
          </Field>

          {/* Error / backend notice */}
          {(status === "error" || errorMsg) && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-400">
              {errorMsg}
            </div>
          )}

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-overlay)] px-3 py-2.5 text-[11px] text-[var(--text-muted)]">
            {!isLoggedIn
              ? "🔒 Sign in to publish — guests can browse and use community shares, but not post them."
              : kind === "board"
                ? `📦 ${shareableBoxes.length} block(s) from "${board?.name ?? "this board"}" will be shared publicly.`
                : kind === "box"
                  ? "📦 The selected block and its items will be shared publicly."
                  : "📦 The selected item will be shared publicly as an addable community item."}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={status === "loading" || !isLoggedIn}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {status === "loading" ? "Publishing…" : <><Upload size={13} /> Publish</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] overflow-hidden animate-pulse">
          <div className="h-36 bg-[var(--surface-overlay)]" />
          <div className="p-3 bg-[var(--surface-raised)] flex flex-col gap-2">
            <div className="h-3 w-3/4 rounded bg-[var(--surface-overlay)]" />
            <div className="h-2 w-full rounded bg-[var(--surface-overlay)]" />
            <div className="h-2 w-2/3 rounded bg-[var(--surface-overlay)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}

function AuthorAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt={name} className="w-5 h-5 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 text-[10px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatPill({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-0.5 text-[11px] text-[var(--text-muted)]">
      {icon} {value.toLocaleString()}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
