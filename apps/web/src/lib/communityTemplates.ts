/**
 * Community Boards — types and API layer.
 *
 * Every function here has a clear TODO comment showing the Supabase
 * call that replaces it when the backend is wired up.
 * Nothing in the UI imports hardcoded data — it only calls these functions.
 */

import type { BlockItem, BoxStyle } from "@/store/boardStore";

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

/** A community-submitted board as returned from the API. */
export interface CommunityBoard {
  id: string;
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
  sort?: SortOrder;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── API layer ────────────────────────────────────────────────────────────────
// Replace each stub body with the real Supabase call when the backend is ready.
// The signatures and return types must stay the same — the UI depends on them.

/**
 * Fetch community boards with optional filtering and sorting.
 *
 * TODO (Supabase):
 *   let q = supabase.from('community_boards').select('*');
 *   if (opts?.category && opts.category !== 'all') q = q.eq('category', opts.category);
 *   if (opts?.search) q = q.ilike('name', `%${opts.search}%`);
 *   const col = opts?.sort === 'most_used' ? 'uses' : opts?.sort === 'most_liked' ? 'likes' : 'created_at';
 *   q = q.order(col, { ascending: false });
 *   const { data, error } = await q.range((page-1)*size, page*size - 1);
 *   if (error) throw error;
 *   return data as CommunityBoard[];
 */
export async function fetchCommunityBoards(
  opts?: FetchOptions
): Promise<CommunityBoard[]> {
  void opts;
  // Backend not connected — return empty list.
  return [];
}

/**
 * Publish the current user's board to the community gallery.
 *
 * TODO (Supabase):
 *   const { data, error } = await supabase
 *     .from('community_boards')
 *     .insert({ ...input, author_id: input.authorId, board_data: input.boardData })
 *     .select()
 *     .single();
 *   if (error) throw error;
 *   return data as CommunityBoard;
 */
export async function publishCommunityBoard(
  input: PublishBoardInput
): Promise<CommunityBoard> {
  void input;
  throw new Error(
    "Publishing is not available yet — connect Supabase to enable this feature."
  );
}

/**
 * Toggle a like on a community board.
 *
 * TODO (Supabase):
 *   await supabase.rpc('toggle_community_board_like', { board_id: boardId, user_id: userId });
 */
export async function likeCommunityBoard(
  boardId: string,
  _userId: string
): Promise<void> {
  void boardId;
  // no-op until backend is connected
}

/**
 * Increment the "uses" counter when someone applies a board.
 * Fire-and-forget — never throw, never block the UI.
 *
 * TODO (Supabase):
 *   await supabase.rpc('increment_community_board_uses', { board_id: boardId });
 */
export async function trackBoardUse(boardId: string): Promise<void> {
  void boardId;
  // no-op until backend is connected
}
