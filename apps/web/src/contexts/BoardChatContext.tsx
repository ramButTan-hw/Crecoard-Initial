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

// ─── Types ────────────────────────────────────────────────────────────────────

interface BoardChatContextValue {
  /** Messages indexed by itemId. */
  messagesByItem: Record<string, ChatMessage[]>;
  /**
   * Load messages for a chat item and subscribe to Realtime inserts.
   * Returns an unsubscribe function — call it when the ChatBlock unmounts.
   */
  loadAndSubscribe: (itemId: string, boardId: string, channelName?: string) => () => void;
  /** Send a message (optimistic + Supabase insert). */
  sendMessage: (
    itemId: string,
    boardId: string,
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
  sendMessage: async () => {},
});

export function useBoardChat(): BoardChatContextValue {
  return useContext(BoardChatContext);
}

// ─── Convenience hook used by ChatBlock ───────────────────────────────────────

export function useBoardChatItem(itemId: string, boardId: string, channelName?: string) {
  const ctx = useBoardChat();

  useEffect(() => {
    const unsub = ctx.loadAndSubscribe(itemId, boardId, channelName);
    return unsub;
  // ctx functions are stable useCallbacks — not in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, boardId]);

  const messages = ctx.messagesByItem[itemId] ?? [];

  const send = useCallback(
    (
      authorId: string,
      authorName: string,
      authorAvatar: string,
      content: string,
      opts?: { gifUrl?: string; imageUrl?: string; fileName?: string }
    ) => ctx.sendMessage(itemId, boardId, authorId, authorName, authorAvatar, content, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemId, boardId]
  );

  return { messages, send };
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

  const loadAndSubscribe = useCallback((itemId: string, boardId: string, channelName?: string): () => void => {
    if (!isSupabaseReady()) return () => {};

    if (channelName) channelNames.current[itemId] = channelName;

    // Track how many ChatBlock instances are using this itemId
    refCounts.current[itemId] = (refCounts.current[itemId] ?? 0) + 1;

    // One channel per itemId — created on first subscriber
    if (!channels.current[itemId]) {
      const channel = supabase
        .channel(`board-chat:${itemId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "board_chat_messages",
            filter: `item_id=eq.${itemId}`,
          },
          (payload) => {
            const msg = rowToMessage(payload.new as Record<string, unknown>);

            // Don't notify for own messages
            if (msg.authorId !== identity.userId) {
              const isMention = Boolean(
                msg.content &&
                identity.displayName &&
                msg.content.toLowerCase().includes(`@${identity.displayName.toLowerCase()}`)
              );
              playPing(isMention ? "mention" : "message");
              pushNotification({
                itemId,
                channelName: channelNames.current[itemId] ?? "chat",
                authorName:   msg.authorName,
                authorAvatar: msg.authorAvatar,
                content:      msg.content ?? "",
                isMention,
              });
            }

            setMessagesByItem((prev) => {
              const existing = prev[itemId] ?? [];
              if (existing.some((m) => m.id === msg.id)) return prev;
              const optIdx = existing.findIndex(
                (m) => m.id.startsWith("opt-") && m.authorId === msg.authorId
              );
              if (optIdx >= 0) {
                const updated = [...existing];
                updated[optIdx] = msg;
                return { ...prev, [itemId]: updated };
              }
              return { ...prev, [itemId]: [...existing, msg] };
            });
          }
        )
        .subscribe();

      channels.current[itemId] = channel;
    }

    // Load history once per session
    if (!loaded.current.has(itemId)) {
      loaded.current.add(itemId);
      void supabase
        .from("board_chat_messages")
        .select("*")
        .eq("item_id", itemId)
        .eq("board_id", boardId)
        .order("created_at", { ascending: true })
        .limit(200)
        .then(({ data }) => {
          if (data) {
            setMessagesByItem((prev) => ({
              ...prev,
              [itemId]: data.map(rowToMessage as (r: unknown) => ChatMessage),
            }));
          }
        });
    }

    return () => {
      refCounts.current[itemId] = (refCounts.current[itemId] ?? 1) - 1;
      // Only tear down when the last subscriber unmounts
      if (refCounts.current[itemId] <= 0) {
        delete refCounts.current[itemId];
        const ch = channels.current[itemId];
        if (ch) {
          void supabase.removeChannel(ch);
          delete channels.current[itemId];
          loaded.current.delete(itemId); // allow fresh load on next mount
        }
      }
    };
  }, []);

  const sendMessage = useCallback(async (
    itemId: string,
    boardId: string,
    authorId: string,
    authorName: string,
    authorAvatar: string,
    content: string,
    opts: { gifUrl?: string; imageUrl?: string; fileName?: string } = {}
  ) => {
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
      [itemId]: [...(prev[itemId] ?? []), optimistic],
    }));

    if (!isSupabaseReady()) return; // guest mode — keep optimistic only

    const { data, error } = await supabase
      .from("board_chat_messages")
      .insert({
        item_id: itemId,
        board_id: boardId,
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
      // Rollback optimistic on failure
      setMessagesByItem((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] ?? []).filter((m) => m.id !== optimisticId),
      }));
      return;
    }

    // Replace optimistic with persisted row
    const real = rowToMessage(data as Record<string, unknown>);
    setMessagesByItem((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).map((m) => (m.id === optimisticId ? real : m)),
    }));
  }, []);

  return (
    <BoardChatContext.Provider value={{ messagesByItem, loadAndSubscribe, sendMessage }}>
      {children}
    </BoardChatContext.Provider>
  );
}
