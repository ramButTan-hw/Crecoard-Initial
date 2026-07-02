"use client";

import { useEffect, useRef } from "react";
import { X, Hash } from "lucide-react";
import { useNotifications, type ChatToast } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useNotifications();
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ChatToast; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  // Slide-in on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translateX(calc(100% + 16px))";
    el.style.opacity = "0";
    requestAnimationFrame(() => {
      el.style.transition = "transform 0.25s ease, opacity 0.25s ease";
      el.style.transform = "translateX(0)";
      el.style.opacity = "1";
    });
  }, []);

  const preview = toast.content
    ? toast.content.slice(0, 80) + (toast.content.length > 80 ? "…" : "")
    : toast.isMention ? "mentioned you" : "sent a message";

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto w-[300px] rounded-xl border shadow-2xl overflow-hidden",
        "flex flex-col",
      )}
      style={{
        background: "var(--surface-raised)",
        borderColor: toast.isMention ? "var(--accent)" : "var(--border)",
        boxShadow: toast.isMention
          ? "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px var(--accent)"
          : "0 8px 32px rgba(0,0,0,0.5)",
      }}
    >
      {/* Mention accent bar */}
      {toast.isMention && (
        <div className="h-0.5 w-full" style={{ background: "var(--accent)" }} />
      )}

      <div className="flex items-start gap-2.5 p-3">
        {/* Avatar */}
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: toast.isMention ? "var(--accent)" : "#4f5882" }}
        >
          {toast.authorAvatar}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <Hash size={10} className="text-[var(--text-muted)] flex-shrink-0" />
            <span className="text-[11px] text-[var(--text-muted)] truncate">{toast.channelName}</span>
            {toast.isMention && (
              <span
                className="ml-1 rounded px-1 py-px text-[10px] font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                mention
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{toast.authorName}</p>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">{preview}</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Progress bar */}
      <ProgressBar duration={4000} isMention={toast.isMention} onDone={onDismiss} />
    </div>
  );
}

function ProgressBar({ duration, isMention, onDone }: { duration: number; isMention: boolean; onDone: () => void }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.width = "100%";
    bar.style.transition = "none";
    requestAnimationFrame(() => {
      bar.style.transition = `width ${duration}ms linear`;
      bar.style.width = "0%";
    });
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  // onDone is stable (comes from dismiss callback)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-0.5 w-full" style={{ background: "var(--border)" }}>
      <div
        ref={barRef}
        className="h-full"
        style={{ background: isMention ? "var(--accent)" : "var(--text-muted)", width: "100%" }}
      />
    </div>
  );
}
