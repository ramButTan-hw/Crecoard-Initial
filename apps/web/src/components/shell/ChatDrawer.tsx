"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Hash, Plus, Search, Pin, LocateFixed } from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import type { BlockItem } from "@/store/boardStore";
import { supabase } from "@/lib/supabase";
import { useNotifications } from "@/contexts/NotificationContext";
import { chatKeyFor, useBoardChat } from "@/contexts/BoardChatContext";
import { ChatBlock } from "@/components/items/ChatBlock";
import { cn } from "@/lib/utils";

/**
 * Slide-out chat panel for a board: lists the board's channels (with unread)
 * and shows the selected channel's conversation — so chat has a home and isn't
 * something you have to hunt for on the canvas.
 */
export function ChatDrawer({ boardId, onClose }: { boardId: string; onClose: () => void }) {
  const board = useBoardStore((s) => s.boards.find((b) => b.id === boardId) ?? s.serverBoards[boardId]);
  const addChatChannel = useBoardStore((s) => s.addChatChannel);
  const { unread } = useNotifications();
  const { togglePin } = useBoardChat();
  const [newName, setNewName] = useState("");
  const [active, setActive] = useState("general");
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; channel: string; author: string; content: string; ts: string }[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [pins, setPins] = useState<{ id: string; author: string; content: string; gif?: string; image?: string; ts: string }[]>([]);

  // Search this board's chat history (across channels).
  useEffect(() => {
    if (!searching) return;
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("board_chat_messages")
        .select("id, channel, author_name, content, created_at")
        .eq("board_id", boardId)
        .ilike("content", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(30);
      setSearchResults((data ?? []).map((r) => ({
        id: r.id as string,
        channel: (r.channel as string) ?? "general",
        author: r.author_name as string,
        content: r.content as string,
        ts: r.created_at as string,
      })));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, searching, boardId]);

  const channels = useMemo(() => {
    const set = new Set<string>(["general", ...(board?.chatChannels ?? [])]);
    board?.boxes?.forEach((box) =>
      box.items?.forEach((it) => { if (it.type === "chat") set.add(it.chatChannelName ?? "general"); })
    );
    board?.boardItems?.forEach((it) => { if (it.type === "chat") set.add(it.chatChannelName ?? "general"); });
    return [...set];
  }, [board]);

  // Map of channel → the on-canvas element id (box id, or board-level item id) of
  // its chat block, so the drawer can show which channels live on the board and
  // jump straight to them. A channel is allowed on the board at most once.
  const channelOnBoard = useMemo(() => {
    const map = new Map<string, string>();
    board?.boxes?.forEach((box) => box.items?.forEach((it) => {
      if (it.type === "chat") { const ch = it.chatChannelName ?? "general"; if (!map.has(ch)) map.set(ch, box.id); }
    }));
    board?.boardItems?.forEach((it) => {
      if (it.type === "chat") { const ch = it.chatChannelName ?? "general"; if (!map.has(ch)) map.set(ch, it.id); }
    });
    return map;
  }, [board]);

  const jumpToChannel = (ch: string) => {
    const id = channelOnBoard.get(ch);
    if (!id) return;
    window.dispatchEvent(new CustomEvent("crecoard:focus-box", { detail: { boxId: id } }));
    onClose();
  };

  const activeChannel = channels.includes(active) ? active : channels[0] ?? "general";
  const syntheticItem = { id: `drawer-${activeChannel}`, type: "chat", showInCollapsed: false, chatChannelName: activeChannel } as BlockItem;

  // Load this channel's pinned messages whenever the Pins panel is open.
  useEffect(() => {
    if (!showPins) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("board_chat_messages")
        .select("id, author_name, content, gif_url, image_url, pinned_at")
        .eq("board_id", boardId)
        .eq("channel", activeChannel)
        .eq("pinned", true)
        .order("pinned_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setPins((data ?? []).map((r) => ({
        id: r.id as string,
        author: r.author_name as string,
        content: r.content as string,
        gif: (r.gif_url as string | null) ?? undefined,
        image: (r.image_url as string | null) ?? undefined,
        ts: r.pinned_at as string,
      })));
    })();
    return () => { cancelled = true; };
  }, [showPins, activeChannel, boardId]);

  const unpin = (id: string) => {
    void togglePin(id, boardId, activeChannel, false);
    setPins((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    addChatChannel(boardId, name);
    const clean = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (clean) setActive(clean);
    setNewName("");
  };

  return (
    <div
      className="fixed right-0 top-0 z-[1100] flex h-full w-full flex-col border-l border-[var(--border)] shadow-2xl md:w-[380px]"
      style={{ background: "var(--surface-raised)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Chat</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => { setShowPins((v) => !v); setSearching(false); }} title="Pinned messages" className={cn("rounded p-1 transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]", showPins ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>
            <Pin size={15} />
          </button>
          <button onClick={() => { setSearching((v) => !v); setSearchQuery(""); setShowPins(false); }} className={cn("rounded p-1 transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]", searching ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>
            <Search size={15} />
          </button>
          <button onClick={onClose} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {searching ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[var(--border)] p-2">
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full rounded-lg bg-[var(--surface-overlay)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {searchResults.length === 0 ? (
              <p className="p-4 text-center text-xs text-[var(--text-muted)]">{searchQuery.trim().length < 2 ? "Type to search this board's messages." : "No matches."}</p>
            ) : searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => { setActive(r.channel); setSearching(false); }}
                className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-overlay)]"
              >
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <Hash size={10} />{r.channel} · {r.author} · {new Date(r.ts).toLocaleDateString()}
                </span>
                <span className="truncate text-sm text-[var(--text-secondary)]">{r.content || "(attachment)"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : showPins ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <Pin size={12} className="text-[var(--accent)]" />
            <span>Pinned in</span>
            <Hash size={11} />
            <span className="font-semibold text-[var(--text-primary)]">{activeChannel}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {pins.length === 0 ? (
              <p className="p-4 text-center text-xs text-[var(--text-muted)]">No pinned messages in this channel yet.</p>
            ) : pins.map((p) => (
              <div key={p.id} className="group flex items-start gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-overlay)]">
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                    {p.author} · {new Date(p.ts).toLocaleDateString()}
                  </span>
                  <span className="block truncate text-sm text-[var(--text-secondary)]">
                    {p.content || (p.gif ? "(GIF)" : p.image ? "(image)" : "(attachment)")}
                  </span>
                </div>
                <button
                  onClick={() => unpin(p.id)}
                  title="Unpin"
                  className="mt-0.5 hidden shrink-0 rounded p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] group-hover:block"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <>
      {/* Channel list */}
      <div className="max-h-[42%] flex-shrink-0 overflow-y-auto border-b border-[var(--border)] p-2">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Channels</p>
        {channels.map((ch) => {
          const count = unread[chatKeyFor(boardId, ch)] ?? 0;
          const onBoard = channelOnBoard.has(ch);
          return (
            <div
              key={ch}
              className={cn(
                "group/ch flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                ch === activeChannel
                  ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
              )}
            >
              <button onClick={() => setActive(ch)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Hash size={13} className={cn("shrink-0", onBoard ? "text-[var(--accent)]" : "text-[var(--text-muted)]")} />
                <span className={cn("flex-1 truncate", !onBoard && "text-[var(--text-muted)]")}>{ch}</span>
                {!onBoard && <span className="shrink-0 rounded bg-[var(--surface-overlay)] px-1 text-[8px] uppercase tracking-wide text-[var(--text-muted)]">drawer</span>}
              </button>
              {count > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
              {onBoard && (
                <button
                  onClick={() => jumpToChannel(ch)}
                  title="Jump to this chat on the board"
                  className="shrink-0 rounded p-0.5 text-[var(--text-muted)] opacity-0 transition-colors hover:text-[var(--accent)] group-hover/ch:opacity-100"
                >
                  <LocateFixed size={13} />
                </button>
              )}
            </div>
          );
        })}
        <div className="mt-1 flex items-center gap-1.5 px-2">
          <Plus size={13} className="shrink-0 text-[var(--text-muted)]" />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            placeholder="New channel…"
            className="flex-1 bg-transparent py-1 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </div>
      </div>

      {/* Active channel conversation */}
      <div className="min-h-0 flex-1">
        <ChatBlock key={activeChannel} item={syntheticItem} boardId={boardId} boxId="" expanded />
      </div>
      </>
      )}
    </div>
  );
}
