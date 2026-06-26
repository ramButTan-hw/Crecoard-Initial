"use client";

import { useState } from "react";
import { MessageCircle, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "online" | "offline" | "pending";

const DEMO_FRIENDS = [
  { id: "f1", dmId: "d1", username: "alex_dev", avatar: "A", online: true, status: "Working on a new board" },
  { id: "f2", dmId: "d2", username: "sarah.m", avatar: "S", online: false, status: "" },
  { id: "f3", dmId: "d3", username: "jordan", avatar: "J", online: true, status: "Building something cool" },
  { id: "f4", dmId: null, username: "riley_k", avatar: "R", online: true, status: "" },
  { id: "f5", dmId: null, username: "mia.dev", avatar: "M", online: false, status: "" },
];

export function FriendsView({ onDmSelect }: { onDmSelect: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("online");

  const online = DEMO_FRIENDS.filter((f) => f.online);
  const offline = DEMO_FRIENDS.filter((f) => !f.online);

  const displayed = tab === "online" ? online : tab === "offline" ? offline : [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* Header bar */}
      <div
        className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-[var(--border)] px-5"
        style={{ background: "var(--surface-raised)" }}
      >
        <span className="text-sm font-semibold text-[var(--text-primary)]">Friends</span>

        <div className="flex items-center gap-0.5">
          {(["online", "offline", "pending"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-3 py-1 text-sm capitalize transition-colors",
                tab === t
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {t}
              {t === "online" && (
                <span
                  className={cn(
                    "ml-1.5 rounded-full px-1 text-xs",
                    tab === "online" ? "bg-white/25" : "bg-[var(--surface-overlay)]"
                  )}
                >
                  {online.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto">
          <button className="flex items-center gap-1.5 rounded-xl border border-[var(--accent)] px-3 py-1 text-xs text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-white">
            <UserPlus size={12} />
            Add Friend
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {tab === "pending" ? (
          <EmptyState emoji="👋" title="No pending requests" subtitle="When someone sends you a friend request, it'll show up here." />
        ) : displayed.length === 0 ? (
          <EmptyState
            emoji={tab === "online" ? "🌙" : "💤"}
            title={tab === "online" ? "No friends online right now" : "No offline friends to show"}
            subtitle=""
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {displayed.map((f) => (
              <FriendCard
                key={f.id}
                friend={f}
                onMessage={f.dmId ? () => onDmSelect(f.dmId!) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FriendCard({
  friend, onMessage,
}: {
  friend: typeof DEMO_FRIENDS[number];
  onMessage?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--surface-overlay)]">
      {/* Avatar with online ring */}
      <div
        className={cn(
          "relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-base font-bold text-white bg-[var(--accent)]",
          friend.online ? "ring-2 ring-green-500 ring-offset-2 ring-offset-[var(--surface)]" : ""
        )}
      >
        {friend.avatar}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--surface)]",
            friend.online ? "bg-green-500" : "bg-[var(--text-muted)]"
          )}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{friend.username}</p>
        <p className="truncate text-xs text-[var(--text-muted)]">
          {friend.status || (friend.online ? "Online" : "Offline")}
        </p>
      </div>

      {onMessage && (
        <button
          onClick={onMessage}
          className="hidden h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--surface-overlay)] text-[var(--text-muted)] transition-colors hover:bg-[var(--accent)] hover:text-white group-hover:flex"
          title="Send message"
        >
          <MessageCircle size={14} />
        </button>
      )}
    </div>
  );
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      {subtitle && <p className="max-w-xs text-xs text-[var(--text-muted)]">{subtitle}</p>}
    </div>
  );
}
