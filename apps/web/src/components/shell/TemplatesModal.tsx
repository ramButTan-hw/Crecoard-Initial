"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Search, Upload, Heart, Download, Sparkles, ChevronDown,
} from "lucide-react";
import {
  CommunityBoard, FetchOptions, SortOrder, TemplateCategory,
  TEMPLATE_CATEGORIES, fetchCommunityBoards, publishCommunityBoard,
  trackBoardUse, PublishBoardInput,
} from "@/lib/communityTemplates";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";
import { cn } from "@/lib/utils";

// ─── Main modal ───────────────────────────────────────────────────────────────

interface TemplatesModalProps {
  onClose: () => void;
}

export function TemplatesModal({ onClose }: TemplatesModalProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | "all">("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [search, setSearch] = useState("");
  const [boards, setBoards] = useState<CommunityBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const createBoardFromTemplate = useBoardStore((s) => s.createBoardFromTemplate);

  // Fetch whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const opts: FetchOptions = {
      category: activeCategory,
      sort,
      search: search.trim() || undefined,
    };
    fetchCommunityBoards(opts).then((data) => {
      if (!cancelled) { setBoards(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setBoards([]); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [activeCategory, sort, search]);

  const handleUse = (board: CommunityBoard) => {
    trackBoardUse(board.id).catch(() => {/* fire-and-forget */});
    createBoardFromTemplate(board);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: 920, maxHeight: "88vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Sparkles size={18} className="text-[var(--accent)] shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)] leading-tight">Community Boards</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-tight">
                Browse and use boards shared by the community.
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
            Share board
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
            <div className="grid grid-cols-3 gap-4">
              {boards.map((board) => (
                <BoardCard key={board.id} board={board} onUse={handleUse} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Publish sub-modal ── */}
      {showPublish && (
        <PublishModal onClose={() => setShowPublish(false)} />
      )}
    </div>
  );
}

// ─── Board card ───────────────────────────────────────────────────────────────

function BoardCard({ board, onUse }: { board: CommunityBoard; onUse: (b: CommunityBoard) => void }) {
  const cat = TEMPLATE_CATEGORIES.find((c) => c.id === board.category);
  return (
    <div
      onClick={() => onUse(board)}
      className="flex flex-col rounded-xl border border-[var(--border)] overflow-hidden cursor-pointer group hover:border-[var(--accent)]/50 transition-colors"
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
        <span className="absolute bottom-2 right-2 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[var(--accent)] text-white opacity-0 group-hover:opacity-100 transition-opacity shadow">
          Use board
        </span>
        {cat && (
          <span className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
            {cat.emoji} {cat.label}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 bg-[var(--surface-raised)] flex-1">
        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{board.name}</span>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed line-clamp-2">{board.description}</p>

        {/* Author + stats */}
        <div className="flex items-center gap-2 mt-auto pt-1.5 border-t border-[var(--border)]">
          <AuthorAvatar name={board.author.name} avatarUrl={board.author.avatarUrl} />
          <span className="text-[10px] text-[var(--text-muted)] truncate flex-1">{board.author.name}</span>
          <div className="flex items-center gap-2.5 shrink-0">
            <StatPill icon={<Heart size={9} />} value={board.likes} />
            <StatPill icon={<Download size={9} />} value={board.uses} />
          </div>
        </div>

        {/* Tags */}
        {board.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {board.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--surface-overlay)] text-[var(--text-muted)]">
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
          {hasSearch ? "No boards match your filters" : "No community boards yet"}
        </p>
        <p className="text-[12px] text-[var(--text-muted)] mt-1">
          {hasSearch
            ? "Try a different search or category."
            : "Be the first to share a board with the community."}
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

function PublishModal({ onClose }: { onClose: () => void }) {
  const board = useActiveBoard();
  const [name, setName] = useState(board?.name ?? "");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("productivity");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags((prev) => [...prev, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      setErrorMsg("Name and description are required.");
      return;
    }
    if (!board) return;
    setStatus("loading");
    setErrorMsg("");

    const input: PublishBoardInput = {
      name: name.trim(),
      description: description.trim(),
      category,
      tags,
      boardData: {
        backgroundColor: board.backgroundColor,
        boxes: board.boxes
          .filter((b) => !b.deckOwnerId)
          .map((b) => ({
            title: b.title,
            x: b.x,
            y: b.y,
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
            items: b.items.map(({ id: _id, showInCollapsed: _sc, ...rest }) => rest),
          })),
      },
    };

    try {
      await publishCommunityBoard(input);
      onClose();
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
              Share your current board with everyone.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <Field label="Board name">
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
            <span className="text-[10px] text-[var(--text-muted)] self-end">{description.length}/280</span>
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
                  <span key={t} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/20">
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
            📦 Your current board's blocks will be included. Connect Supabase to enable publishing.
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
            disabled={status === "loading"}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {status === "loading" ? "Publishing…" : <><Upload size={13} /> Publish board</>}
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
    <div className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 text-[9px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatPill({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]">
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
