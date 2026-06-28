"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef,
} from "react";
import { supabase } from "@/lib/supabase";
import { useBoardStore } from "@/store/boardStore";
import type { Board } from "@/store/boardStore";

function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return Boolean(url) && !url.includes("placeholder");
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface BoardSyncContextValue {
  /** Fetches a server board from Supabase and injects it into the store.
   *  No-ops if the board already has content (non-empty boxes). */
  loadServerBoard: (boardId: string, serverId: string) => Promise<void>;
  /** Saves the current state of a server board to Supabase immediately. */
  saveServerBoard: (boardId: string, serverId: string) => Promise<void>;
}

const BoardSyncContext = createContext<BoardSyncContextValue | null>(null);

export function useBoardSync(): BoardSyncContextValue {
  const ctx = useContext(BoardSyncContext);
  if (!ctx) throw new Error("useBoardSync must be inside <BoardSyncProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 2500;

export function BoardSyncProvider({ children }: { children: React.ReactNode }) {
  const pendingPersonal = useRef<Map<string, Board>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  // ── On mount: load personal boards from Supabase ──────────────────────────
  // Supabase is authoritative — it wins over localStorage for any board with the
  // same UUID. This means edits made on another device show up on next login.

  useEffect(() => {
    if (!isSupabaseReady() || initialized.current) return;
    initialized.current = true;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("boards")
        .select("id, data")
        .eq("user_id", user.id);

      if (error || !data?.length) return;

      const supabaseBoards: Board[] = data.map((row) => ({
        ...(row.data as Record<string, unknown>),
        id: row.id as string,
      } as Board));

      // Merge: Supabase board wins for any id that appears in both sources
      useBoardStore.setState((s) => {
        const byId = new Map(s.boards.map((b) => [b.id, b]));
        for (const sb of supabaseBoards) byId.set(sb.id, sb);
        const merged = Array.from(byId.values());
        const safeActiveId =
          merged.find((b) => b.id === s.activeBoardId)?.id ?? merged[0]?.id ?? s.activeBoardId;
        return { boards: merged, activeBoardId: safeActiveId };
      });
    })();
  }, []);

  // ── Flush pending personal board writes to Supabase ───────────────────────

  const flushPersonalBoards = useCallback(async () => {
    if (!pendingPersonal.current.size) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const toFlush = Array.from(pendingPersonal.current.values());
    pendingPersonal.current.clear();

    const rows = toFlush.map((board) => {
      const { id, ...rest } = board;
      return { id, user_id: user.id, data: rest };
    });

    const { error } = await supabase.from("boards").upsert(rows, { onConflict: "id" });
    if (error) console.error("[BoardSync] personal board upsert failed:", error);
  }, []);

  // ── Subscribe to store changes and debounce-write personal boards ─────────

  useEffect(() => {
    if (!isSupabaseReady()) return;

    const unsub = useBoardStore.subscribe((state, prev) => {
      if (state.boards === prev.boards) return;

      const prevById = new Map(prev.boards.map((b) => [b.id, b]));
      for (const board of state.boards) {
        if (board !== prevById.get(board.id)) {
          pendingPersonal.current.set(board.id, board);
        }
      }

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(flushPersonalBoards, DEBOUNCE_MS);
    });

    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [flushPersonalBoards]);

  // ── Server board operations ───────────────────────────────────────────────

  const loadServerBoard = useCallback(async (boardId: string, serverId: string) => {
    if (!isSupabaseReady()) return;

    // Skip if the board already has real content (not just the injected stub)
    const existing = useBoardStore.getState().serverBoards[boardId];
    if ((existing?.boxes?.length ?? 0) > 0 || (existing?.boardItems?.length ?? 0) > 0) return;

    const { data, error } = await supabase
      .from("boards")
      .select("id, data")
      .eq("id", boardId)
      .eq("server_id", serverId)
      .maybeSingle();

    if (error) { console.error("[BoardSync] loadServerBoard failed:", error); return; }

    if (data) {
      const board: Board = {
        ...(data.data as Record<string, unknown>),
        id: data.id as string,
      } as Board;
      useBoardStore.getState().injectServerBoards([board]);
    }
    // No DB row yet → stub board injected by AppShell remains visible
  }, []);

  const saveServerBoard = useCallback(async (boardId: string, serverId: string) => {
    if (!isSupabaseReady()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const board = useBoardStore.getState().serverBoards[boardId];
    if (!board) return;

    const { id, ...rest } = board;
    const { error } = await supabase
      .from("boards")
      .upsert({ id, server_id: serverId, data: rest }, { onConflict: "id" });
    if (error) console.error("[BoardSync] saveServerBoard failed:", error);
  }, []);

  return (
    <BoardSyncContext.Provider value={{ loadServerBoard, saveServerBoard }}>
      {children}
    </BoardSyncContext.Provider>
  );
}
