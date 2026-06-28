"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Smile, ImageIcon, X } from "lucide-react";
import type { BlockItem } from "@/store/boardStore";
import { useBoardChatItem } from "@/contexts/BoardChatContext";
import { useUser } from "@/contexts/UserContext";
import { uploadFile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/messaging/EmojiPicker";
import { GifPicker } from "@/components/messaging/GifPicker";

interface ChatBlockProps {
  item: BlockItem;
  boardId: string;
  boxId: string;
  /** When true we're inside the full-screen ExpandedBlock view */
  expanded?: boolean;
}

export function ChatBlock({ item, boardId, expanded = false }: ChatBlockProps) {
  const { identity } = useUser();
  const { messages, send } = useBoardChatItem(item.id, boardId);
  const channelName = item.chatChannelName ?? "general";

  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ file: File; dataUrl: string; name: string } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const authorAvatar = identity.displayName.charAt(0).toUpperCase() || "?";

  const handleSend = async () => {
    const text = input.trim();
    if (!text && !pendingImage) return;
    let imageUrl: string | undefined = pendingImage?.dataUrl;
    if (pendingImage) {
      const uploaded = await uploadFile(pendingImage.file, identity.userId, "chat", pendingImage.name);
      if (uploaded) imageUrl = uploaded;
    }
    void send(
      identity.userId,
      identity.displayName,
      authorAvatar,
      text,
      pendingImage ? { imageUrl, fileName: pendingImage.name } : undefined
    );
    setInput("");
    setPendingImage(null);
  };

  const sendGif = (gifUrl: string) => {
    void send(identity.userId, identity.displayName, authorAvatar, "", { gifUrl });
    setShowGif(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      setPendingImage({ file, dataUrl: ev.target!.result as string, name: file.name });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Collapsed preview ────────────────────────────────────────────────────────
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
                {latest.gif ? (
                  <span className="text-[10px] italic text-[var(--text-muted)]">sent a GIF</span>
                ) : latest.image ? (
                  <span className="text-[10px] italic text-[var(--text-muted)]">sent an image</span>
                ) : (
                  <span className="truncate text-[10px] text-[var(--text-secondary)]">{latest.content}</span>
                )}
              </div>
            </>
          ) : (
            <span className="text-[10px] italic text-[var(--text-muted)]">No messages yet</span>
          )}
        </div>
      </div>
    );
  }

  // ── Expanded view ────────────────────────────────────────────────────────────
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
        ref={scrollContainerRef}
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
            const isYou = msg.authorId === identity.userId;

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
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{msg.authorName}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  )}
                  {msg.content && (
                    <p
                      className="break-words leading-relaxed text-sm"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {msg.content}
                    </p>
                  )}
                  {msg.gif && (
                    <img
                      src={msg.gif}
                      alt="gif"
                      className="mt-1 max-h-[200px] rounded-xl object-cover"
                    />
                  )}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt={msg.fileName ?? "image"}
                      className="mt-1 max-h-[200px] rounded-xl object-cover"
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="relative flex-shrink-0 border-t border-[var(--border)] px-2 py-2">
        {showEmoji && (
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setShowEmoji(false)} />
            <div className="absolute bottom-full left-2 z-[201] mb-1">
              <EmojiPicker
                onSelect={(emoji) => {
                  setInput((v) => v + emoji);
                  setShowEmoji(false);
                }}
              />
            </div>
          </>
        )}

        {showGif && (
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setShowGif(false)} />
            <div className="absolute bottom-full left-2 z-[201] mb-1">
              <GifPicker onSelect={sendGif} onClose={() => setShowGif(false)} />
            </div>
          </>
        )}

        {pendingImage && (
          <div className="mb-1.5 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] p-2">
            <img
              src={pendingImage.dataUrl}
              alt="preview"
              className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--text-secondary)]">
              {pendingImage.name}
            </span>
            <button
              onClick={() => setPendingImage(null)}
              className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] py-1 pl-1.5 pr-1.5">
          <button
            onClick={() => { setShowEmoji((v) => !v); setShowGif(false); }}
            title="Emoji"
            className="flex-shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--accent)]"
          >
            <Smile size={13} />
          </button>

          <button
            onClick={() => { setShowGif((v) => !v); setShowEmoji(false); }}
            title="GIF"
            className="flex-shrink-0 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            GIF
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload image"
            className="flex-shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--accent)]"
          >
            <ImageIcon size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="mx-0.5 h-3.5 w-px flex-shrink-0 bg-[var(--border)]" />

          <input
            className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder={`Message #${channelName}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />

          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() && !pendingImage}
            className="flex-shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] disabled:opacity-30"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
