/**
 * Community marketplace — types and API layer (backed by Supabase).
 *
 * Publishable kinds:
 *  - "board": a whole board (many boxes)
 *  - "box":   a single block with its items
 *  - "item":  a single item (e.g. a custom widget) wrapped in one box
 * All kinds share the same board_data payload shape; kind drives apply behavior.
 */

import { supabase } from "@/lib/supabase";
import type { BlockItem, BoxStyle } from "@/store/boardStore";

function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return Boolean(url) && !url.includes("placeholder");
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TemplateCategory =
  | "productivity"
  | "fitness"
  | "adhd"
  | "gaming"
  | "creative"
  | "other";

export const TEMPLATE_CATEGORIES: {
  id: TemplateCategory;
  label: string;
  emoji: string;
}[] = [
  { id: "productivity", label: "Productivity", emoji: "⚡" },
  { id: "fitness",      label: "Fitness",      emoji: "🏋️" },
  { id: "adhd",         label: "ADHD / Focus", emoji: "🧠" },
  { id: "gaming",       label: "Gaming",       emoji: "🎮" },
  { id: "creative",     label: "Creative",     emoji: "🎨" },
  { id: "other",        label: "Other",        emoji: "✨" },
];

/** A single box row as stored inside a community board's boardData. */
export interface TemplateBox {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: Partial<BoxStyle>;
  items: Omit<BlockItem, "id" | "showInCollapsed">[];
}

/** The serialisable board payload stored in the DB and applied on "Use". */
export interface BoardData {
  backgroundColor?: string;
  boxes: TemplateBox[];
}

/** What a community entry contains — a whole board, one block, or one item. */
export type TemplateKind = "board" | "box" | "item";

export const TEMPLATE_KINDS: { id: TemplateKind; label: string; plural: string }[] = [
  { id: "board", label: "Board", plural: "Boards" },
  { id: "box",   label: "Block", plural: "Blocks" },
  { id: "item",  label: "Item",  plural: "Items" },
];

/** A community-submitted board as returned from the API. */
export interface CommunityBoard {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  likes: number;
  uses: number;
  createdAt: string; // ISO 8601
  previewUrl?: string; // screenshot uploaded by author
  boardData: BoardData;
}

/** Payload the user fills in when publishing their board. */
export interface PublishBoardInput {
  kind: TemplateKind;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  boardData: BoardData;
  /** Supplied by the auth layer once Supabase is wired. */
  authorId?: string;
  authorName?: string;
  authorAvatarUrl?: string;
}

export type SortOrder = "newest" | "most_used" | "most_liked";

export interface FetchOptions {
  category?: TemplateCategory | "all";
  kind?: TemplateKind | "all";
  sort?: SortOrder;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── API layer ────────────────────────────────────────────────────────────────

/** Max serialized board_data size — mirrors the DB CHECK (1 MB). */
export const MAX_BOARD_DATA_BYTES = 1_048_576;

type CommunityBoardRow = {
  id: string;
  kind: string | null;
  name: string;
  description: string;
  category: string;
  tags: string[] | null;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  preview_url: string | null;
  board_data: BoardData;
  likes: number;
  uses: number;
  created_at: string;
};

function rowToBoard(r: CommunityBoardRow): CommunityBoard {
  return {
    id: r.id,
    kind: (r.kind as TemplateKind) ?? "board",
    name: r.name,
    description: r.description,
    category: (r.category as TemplateCategory) ?? "other",
    tags: r.tags ?? [],
    author: {
      id: r.author_id,
      name: r.author_name || "Anonymous",
      avatarUrl: r.author_avatar ?? undefined,
    },
    likes: r.likes,
    uses: r.uses,
    createdAt: r.created_at,
    previewUrl: r.preview_url ?? undefined,
    boardData: r.board_data,
  };
}

/** Fetch community entries with optional filtering and sorting. */
export async function fetchCommunityBoards(
  opts?: FetchOptions
): Promise<CommunityBoard[]> {
  if (!isSupabaseReady()) return [];
  const page = Math.max(1, opts?.page ?? 1);
  const pageSize = Math.min(60, opts?.pageSize ?? 30);

  let q = supabase.from("community_boards").select("*");
  if (opts?.category && opts.category !== "all") q = q.eq("category", opts.category);
  if (opts?.kind && opts.kind !== "all") q = q.eq("kind", opts.kind);
  if (opts?.search) {
    // escape LIKE wildcards in user input
    const term = opts.search.replace(/[%_]/g, (m) => `\\${m}`);
    q = q.ilike("name", `%${term}%`);
  }
  const col = opts?.sort === "most_used" ? "uses" : opts?.sort === "most_liked" ? "likes" : "created_at";
  q = q.order(col, { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await q.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return (data as CommunityBoardRow[]).map(rowToBoard);
}

/** Publish a board/block/item to the community gallery. Requires a signed-in user. */
export async function publishCommunityBoard(
  input: PublishBoardInput
): Promise<CommunityBoard> {
  if (!isSupabaseReady()) {
    throw new Error("Publishing requires Supabase to be configured.");
  }
  if (!input.authorId) {
    throw new Error("Sign in to publish to the community.");
  }
  const size = new Blob([JSON.stringify(input.boardData)]).size;
  if (size > MAX_BOARD_DATA_BYTES) {
    throw new Error("This is too large to publish (over 1 MB) — remove embedded images and try again.");
  }
  const { data, error } = await supabase
    .from("community_boards")
    .insert({
      kind: input.kind,
      name: input.name,
      description: input.description,
      category: input.category,
      tags: input.tags,
      author_id: input.authorId,
      author_name: input.authorName ?? "Anonymous",
      author_avatar: input.authorAvatarUrl ?? null,
      board_data: input.boardData,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToBoard(data as CommunityBoardRow);
}

/** Toggle a like as the signed-in user. Returns the new state, or null on failure. */
export async function likeCommunityBoard(
  boardId: string
): Promise<{ liked: boolean; likes: number } | null> {
  if (!isSupabaseReady()) return null;
  const { data, error } = await supabase.rpc("toggle_community_board_like", { p_board_id: boardId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { liked: !!row.liked, likes: row.likes ?? 0 } : null;
}

/** IDs of entries the signed-in user has liked (empty for guests). */
export async function fetchMyLikes(): Promise<Set<string>> {
  if (!isSupabaseReady()) return new Set();
  const { data, error } = await supabase.from("community_board_likes").select("board_id");
  if (error || !data) return new Set();
  return new Set(data.map((r) => r.board_id as string));
}

/**
 * Increment the "uses" counter when someone applies an entry.
 * Fire-and-forget — never throw, never block the UI.
 */
export async function trackBoardUse(boardId: string): Promise<void> {
  if (!isSupabaseReady()) return;
  try {
    await supabase.rpc("increment_community_board_uses", { p_board_id: boardId });
  } catch {
    // fire-and-forget
  }
}
