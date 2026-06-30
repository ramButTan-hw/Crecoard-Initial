"use client";

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/contexts/UserContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { playPing } from "@/lib/sound";
import type { ChatMessage } from "@/store/boardStore";

function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return Boolean(url) && !url.includes("placeholder");
}

const PAGE_SIZE = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardChatContextValue {
  /** Messages indexed by itemId. */
  messagesByItem: Record<string, ChatMessage[]>;
  /**
   * Load messages for a chat item and subscribe to Realtime inserts.
   * Returns an unsubscribe function — call it when the ChatBlock unmounts.
   */
  loadAndSubscribe: (itemId: string, boardId: string, channel: string) => () => void;
  /** Fetch a page of older messages before `beforeIso`; returns how many loaded. */
  loadOlder: (boardId: string, channel: string, beforeIso: string) => Promise<number>;
  /** Send a message (optimistic + Supabase insert). */
  sendMessage: (
    itemId: string,
    boardId: string,
    channel: string,
    authorId: string,
    authorName: string,
    authorAvatar: string,
    content: string,
    opts?: { gifUrl?: string; imageUrl?: string; fileName?: string }
  ) => Promise<void>;
}

const BoardChatContext = createContext<BoardChatContextValue>({
  messagesByItem: {},
  loadAndSubscribe: () => () => {},
  loadOlder: async () => 0,
  sendMessage: async () => {},
});

export function useBoardChat(): BoardChatContextValue {
  return useContext(BoardChatContext);
}

// ─── Convenience hook used by ChatBlock ───────────────────────────────────────

/** Stable key for a conversation: a (board, channel) stream, not a single item. */
export function chatKeyFor(boardId: string, channelName?: string) {
  return `${boardId}::${channelName ?? "general"}`;
}

export function useBoardChatItem(itemId: string, boardId: string, channelName?: string) {
  const ctx = useBoardChat();
  const channel = channelName ?? "general";
  const chatKey = chatKeyFor(boardId, channel);

  useEffect(() => {
    const unsub = ctx.loadAndSubscribe(itemId, boardId, channel);
    return unsub;
  // ctx functions are stable useCallbacks — not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey]);

  const messages = ctx.messagesByItem[chatKey] ?? [];

  const send = useCallback(
    (
      authorId: string,
      authorName: string,
      authorAvatar: string,
      content: string,
      opts?: { gifUrl?: string; imageUrl?: string; fileName?: string }
    ) => ctx.sendMessage(itemId, boardId, channel, authorId, authorName, authorAvatar, content, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatKey]
  );

  const loadOlder = useCallback(
    (beforeIso: string) => ctx.loadOlder(boardId, channel, beforeIso),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chatKey]
  );

  return { messages, send, chatKey, loadOlder };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row.id as string,
    authorId: row.author_id as string,
    authorName: row.author_name as string,
    authorAvatar: row.author_avatar as string,
    content: row.content as string,
    timestamp: row.created_at as string,
    gif: (row.gif_url as string | null) ?? undefined,
    image: (row.image_url as string | null) ?? undefined,
    fileName: (row.file_name as string | null) ?? undefined,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function BoardChatProvider({ children }: { children: React.ReactNode }) {
  const { identity } = useUser();
  const { push: pushNotification, isActive } = useNotifications();
  const [messagesByItem, setMessagesByItem] = useState<Record<string, ChatMessage[]>>({});
  const channels = useRef<Record<string, RealtimeChannel>>({});
  const loaded = useRef<Set<string>>(new Set());
  // Reference count: how many ChatBlock instances are subscribed to each itemId
  const refCounts = useRef<Record<string, number>>({});
  // Store channel name per itemId so the Realtime handler can include it in the toast
  const channelNames = useRef<Record<string, string>>({});

  useEffect(() => {
    const chans = channels.current;
    return () => {
      Object.values(chans).forEach((ch) => void supabase.removeChannel(ch));
    };
  }, []);

  const loadAndSubscribe = useCallback((itemId: string, boardId: string, channel: string): () => void => {
    if (!isSupabaseReady()) return () => {};

    const key = chatKeyFor(boardId, channel);
    channelNames.current[key] = channel;

    // Reference-count subscribers per (board, channel) so boxes pinned to the
    // same channel share one subscription and one message stream.
    refCounts.current[key] = (refCounts.current[key] ?? 0) + 1;

    if (!channels.current[key]) {
      const ch = supabase
        .channel(`board-chat:${key}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "board_chat_messages",
            filter: `board_id=eq.${boardId}`,
          },
          (payload) => {
            const row = payload.new as Record<string, unknown>;
            // postgres_changes only filters one column — match the channel here.
            if (((row.channel as string) ?? "general") !== channel) return;
            const msg = rowToMessage(row);

            if (msg.authorId !== identity.userId) {
              const isMention = Boolean(
                msg.content && (
                  msg.content.includes(`<@${identity.userId}>`) ||
                  (identity.displayName && msg.content.toLowerCase().includes(`@${identity.displayName.toLowerCase()}`))
                )
              );
              playPing(isMention ? "mention" : "message");
              pushNotification({
                itemId: key,
                channelName: channel,
                authorName:   msg.authorName,
                authorAvatar: msg.authorAvatar,
                content:      msg.content ?? "",
                isMention,
              });
            }

            setMessagesByItem((prev) => {
              const existing = prev[key] ?? [];
              if (existing.some((m) => m.id === msg.id)) return prev;
              const optIdx = existing.findIndex(
                (m) => m.id.startsWith("opt-") && m.authorId === msg.authorId
              );
              if (optIdx >= 0) {
                const updated = [...existing];
                updated[optIdx] = msg;
                return { ...prev, [key]: updated };
              }
              return { ...prev, [key]: [...existing, msg] };
            });
          }
        )
        .subscribe();

      channels.current[key] = ch;
    }

    if (!loaded.current.has(key)) {
      loaded.current.add(key);
      // Load the most recent page, then reverse to oldest-first for display.
      void supabase
        .from("board_chat_messages")
        .select("*")
        .eq("board_id", boardId)
        .eq("channel", channel)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE)
        .then(({ data }) => {
          if (data) {
            const ordered = [...data].reverse();
            setMessagesByItem((prev) => ({
              ...prev,
              [key]: ordered.map(rowToMessage as (r: unknown) => ChatMessage),
            }));
          }
        });
    }

    return () => {
      refCounts.current[key] = (refCounts.current[key] ?? 1) - 1;
      if (refCounts.current[key] <= 0) {
        delete refCounts.current[key];
        const ch = channels.current[key];
        if (ch) {
          void supabase.removeChannel(ch);
          delete channels.current[key];
          loaded.current.delete(key); // allow fresh load on next mount
        }
      }
    };
  }, []);

  const loadOlder = useCallback(async (boardId: string, channel: string, beforeIso: string): Promise<number> => {
    if (!isSupabaseReady()) return 0;
    const key = chatKeyFor(boardId, channel);
    const { data } = await supabase
      .from("board_chat_messages")
      .select("*")
      .eq("board_id", boardId)
      .eq("channel", channel)
      .lt("created_at", beforeIso)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (!data || data.length === 0) return 0;
    const older = [...data].reverse().map(rowToMessage as (r: unknown) => ChatMessage);
    setMessagesByItem((prev) => {
      const existing = prev[key] ?? [];
      const ids = new Set(existing.map((m) => m.id));
      return { ...prev, [key]: [...older.filter((m) => !ids.has(m.id)), ...existing] };
    });
    return data.length;
  }, []);

  const sendMessage = useCallback(async (
    itemId: string,
    boardId: string,
    channel: string,
    authorId: string,
    authorName: string,
    authorAvatar: string,
    content: string,
    opts: { gifUrl?: string; imageUrl?: string; fileName?: string } = {}
  ) => {
    const key = chatKeyFor(boardId, channel);
    const optimisticId = `opt-${crypto.randomUUID()}`;
    const optimistic: ChatMessage = {
      id: optimisticId,
      authorId,
      authorName,
      authorAvatar,
      content,
      timestamp: new Date().toISOString(),
      gif: opts.gifUrl,
      image: opts.imageUrl,
      fileName: opts.fileName,
    };

    setMessagesByItem((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), optimistic],
    }));

    if (!isSupabaseReady()) return; // guest mode — keep optimistic only

    const { data, error } = await supabase
      .from("board_chat_messages")
      .insert({
        item_id: itemId,
        board_id: boardId,
        channel,
        author_id: authorId,
        author_name: authorName,
        author_avatar: authorAvatar,
        content,
        gif_url: opts.gifUrl ?? null,
        image_url: opts.imageUrl ?? null,
        file_name: opts.fileName ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      setMessagesByItem((prev) => ({
        ...prev,
        [key]: (prev[key] ?? []).filter((m) => m.id !== optimisticId),
      }));
      return;
    }

    const real = rowToMessage(data as Record<string, unknown>);
    setMessagesByItem((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((m) => (m.id === optimisticId ? real : m)),
    }));
  }, []);

  return (
    <BoardChatContext.Provider value={{ messagesByItem, loadAndSubscribe, loadOlder, sendMessage }}>
      {children}
    </BoardChatContext.Provider>
  );
}
