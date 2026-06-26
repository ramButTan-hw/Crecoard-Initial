"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useBoardStore } from "@/store/boardStore";
import type { BlockItem } from "@/store/boardStore";
import { cn } from "@/lib/utils";

interface ChatBlockProps {
  item: BlockItem;
  boardId: string;
  boxId: string;
  /** When true we're inside the full-screen ExpandedBlock view */
  expanded?: boolean;
}

export function ChatBlock({ item, boardId, boxId, expanded = false }: ChatBlockProps) {
  const addChatMessage = useBoardStore((s) => s.addChatMessage);
  const messages = item.chatMessages ?? [];
  const channelName = item.chatChannelName ?? "general";
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    addChatMessage(boardId, boxId, item.id, {
      authorId: "local-user",
      authorName: "You",
      authorAvatar: "Y",
      content: text,
      timestamp: new Date().toISOString(),
    });
    setInput("");
  };

  // Collapsed state: show only the latest message, no input
  if (!expanded) {
    const latest = messages[messages.length - 1];
    return (
      <div className="flex h-full flex-col" style={{ minHeight: 0 }}>
        <div className="flex flex-shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
          <span className="text-[11px] text-[var(--text-muted)]">#</span>
          <span className="text-[11px] font-semibold text-[var(--text-primary)]">{channelName}</span>
          <span className="ml-auto text-[9px] text-[var(--text-muted)]">{messages.length} msg</span>
        </div>
        <div className="flex flex-1 items-start gap-1.5 overflow-hidden px-2 py-1.5">
          {latest ? (
            <>
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white">
                {latest.authorAvatar}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold text-[var(--text-primary)]">{latest.authorName} </span>
                <span className="text-[10px] text-[var(--text-secondary)] truncate">{latest.content}</span>
              </div>
            </>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] italic">No messages yet</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ minHeight: 0 }}>
      {/* Channel header */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-3 py-2">
        <span className="text-sm text-[var(--text-muted)]">#</span>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{channelName}</span>
        <span className="ml-auto text-[10px] text-[var(--text-muted)]">{messages.length} msg</span>
      </div>

      {/* Message list */}
      <div
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2"
        style={{ minHeight: 0, scrollbarWidth: "thin" }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="text-2xl">#</span>
            <p className="text-xs font-semibold text-[var(--text-primary)]">#{channelName}</p>
            <p className="text-[11px] text-[var(--text-muted)]">This is the beginning of #{channelName}.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prev = messages[i - 1];
            const consecutive = !!prev && prev.authorId === msg.authorId;
            const isYou = msg.authorId === "local-user";

            return (
              <div
                key={msg.id}
                className={cn(
                  "group flex items-start gap-2 rounded px-1 py-0.5 transition-colors hover:bg-[var(--surface-overlay)]/40",
                  consecutive ? "mt-0" : "mt-2.5"
                )}
              >
                {!consecutive ? (
                  <div
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      isYou ? "bg-green-600" : "bg-[var(--accent)]"
                    )}
                  >
                    {msg.authorAvatar}
                  </div>
                ) : (
                  <div className="w-7 flex-shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  {!consecutive && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {msg.authorName}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                  <p
                    className={cn(
                      "break-words leading-relaxed",
                      expanded ? "text-sm" : "text-xs"
                    )}
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-[var(--border)] px-2 py-2">
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-2.5 py-1.5">
          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder={`Message #${channelName}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className="flex-shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
