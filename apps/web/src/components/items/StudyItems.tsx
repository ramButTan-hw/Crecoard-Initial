"use client";

/**
 * Study items — Flashcards and Quiz. Self-contained interactive items:
 * the item itself is the study/play surface; content (cards, questions) is
 * managed in the style panel. Wired in ItemRenderer via WithItemMenu.
 */

import { useMemo, useState } from "react";
import {
  RotateCw, ChevronLeft, ChevronRight, Shuffle, Check, X as XIcon,
  Plus, Trash2, RefreshCw, GraduationCap, HelpCircle,
} from "lucide-react";
import { nanoid } from "nanoid";
import type { BlockItem, Flashcard, QuizQuestion } from "@/store/boardStore";
import { FontPicker } from "@/components/ui/FontPicker";
import { cn } from "@/lib/utils";

type Upd = (p: Partial<BlockItem>) => void;

function shuffledOrder(n: number, on?: boolean): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (on) for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// ─── Flashcards ────────────────────────────────────────────────────────────────

export function FlashcardItem({ item, collapsed }: { item: BlockItem; upd: Upd; collapsed?: boolean; isFinished?: boolean }) {
  const cards = item.flashcards ?? [];
  const accent = item.flashcardAccent || "var(--accent)";
  const font = item.flashcardFontFamily || undefined;
  const order = useMemo(() => shuffledOrder(cards.length, item.flashcardShuffle), [cards.length, item.flashcardShuffle]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center" style={{ fontFamily: font }}>
        <GraduationCap size={22} className="text-[var(--text-muted)] opacity-40" />
        <p className="text-xs text-[var(--text-muted)]">No cards yet — add some in the style panel.</p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 px-3" style={{ fontFamily: font }}>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: accent }}>
          <GraduationCap size={12} /> Flashcards
        </span>
        <span className="truncate text-xs text-[var(--text-primary)]">{cards[0]?.front || "—"}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{cards.length} card{cards.length !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  const safePos = Math.min(pos, order.length - 1);
  const card = cards[order[safePos]];
  const go = (d: number) => { setFlipped(false); setPos((p) => (p + d + order.length) % order.length); };

  return (
    <div className="flex h-full w-full flex-col gap-2 p-3" style={{ fontFamily: font }} onPointerDown={(e) => e.stopPropagation()}>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="relative flex flex-1 items-center justify-center rounded-xl border p-5 text-center transition-colors"
        style={{ borderColor: `color-mix(in srgb, ${accent} 45%, transparent)`, background: flipped ? `color-mix(in srgb, ${accent} 8%, var(--surface-overlay))` : "var(--surface-overlay)" }}
      >
        <span className="absolute left-3 top-2 text-[10px] uppercase tracking-wider" style={{ color: accent, opacity: 0.75 }}>
          {flipped ? "Answer" : "Term"}
        </span>
        <span className="whitespace-pre-wrap break-words text-base font-medium text-[var(--text-primary)]">
          {(flipped ? card?.back : card?.front) || <span className="italic text-[var(--text-muted)]">(empty)</span>}
        </span>
        <span className="absolute bottom-2 right-3 flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><RotateCw size={9} /> tap to flip</span>
      </button>
      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"><ChevronLeft size={16} /></button>
        <span className="text-[11px] tabular-nums text-[var(--text-muted)]">{safePos + 1} / {order.length}</span>
        <button onClick={() => go(1)} className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function FlashcardStylePanel({ item, upd }: { item: BlockItem; upd: Upd }) {
  const cards = item.flashcards ?? [];
  const accent = item.flashcardAccent || "#d59ee8";
  const setCards = (next: Flashcard[]) => upd({ flashcards: next });
  const patch = (id: string, p: Partial<Flashcard>) => setCards(cards.map((c) => (c.id === id ? { ...c, ...p } : c)));

  return (
    <div className="flex flex-col gap-0 divide-y divide-[var(--border)] text-xs">
      <section className="p-3">
        <SLabel>Cards</SLabel>
        <div className="flex flex-col gap-2">
          {cards.map((c, i) => (
            <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-[var(--border)] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Card {i + 1}</span>
                <button onClick={() => setCards(cards.filter((x) => x.id !== c.id))} className="text-[var(--text-muted)] transition-colors hover:text-red-400"><Trash2 size={11} /></button>
              </div>
              <input value={c.front} onChange={(e) => patch(c.id, { front: e.target.value })} placeholder="Term / question"
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              <input value={c.back} onChange={(e) => patch(c.id, { back: e.target.value })} placeholder="Answer / definition"
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
            </div>
          ))}
          <button onClick={() => setCards([...cards, { id: nanoid(), front: "", back: "" }])}
            className="flex items-center gap-1 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"><Plus size={11} /> Add card</button>
        </div>
      </section>
      <StudyOptions
        accent={accent}
        font={item.flashcardFontFamily ?? ""}
        onFont={(v) => upd({ flashcardFontFamily: v })}
        onAccent={(v) => upd({ flashcardAccent: v })}
        shuffle={!!item.flashcardShuffle}
        onShuffle={(v) => upd({ flashcardShuffle: v })}
      />
    </div>
  );
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

export function QuizItem({ item, collapsed }: { item: BlockItem; upd: Upd; collapsed?: boolean; isFinished?: boolean }) {
  const questions = item.quizQuestions ?? [];
  const accent = item.quizAccent || "var(--accent)";
  const font = item.quizFontFamily || undefined;
  const instant = item.quizInstant !== false;
  const order = useMemo(() => shuffledOrder(questions.length, item.quizShuffle), [questions.length, item.quizShuffle]);

  const [pos, setPos] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const reset = () => { setPos(0); setAnswers({}); setDone(false); };

  if (questions.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center" style={{ fontFamily: font }}>
        <HelpCircle size={22} className="text-[var(--text-muted)] opacity-40" />
        <p className="text-xs text-[var(--text-muted)]">No questions yet — add some in the style panel.</p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex h-full flex-col justify-center gap-1 px-3" style={{ fontFamily: font }}>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: accent }}><HelpCircle size={12} /> Quiz</span>
        <span className="truncate text-xs text-[var(--text-primary)]">{questions[0]?.prompt || "—"}</span>
        <span className="text-[10px] text-[var(--text-muted)]">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
      </div>
    );
  }

  if (done) {
    const score = order.reduce((acc, qi, i) => acc + (questions[qi]?.correctIndex === answers[i] ? 1 : 0), 0);
    const pct = Math.round((score / order.length) * 100);
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center" style={{ fontFamily: font }} onPointerDown={(e) => e.stopPropagation()}>
        <span className="text-3xl font-bold" style={{ color: accent }}>{score}/{order.length}</span>
        <span className="text-xs text-[var(--text-muted)]">{pct}% correct</span>
        <button onClick={reset} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
          <RefreshCw size={12} /> Retake
        </button>
      </div>
    );
  }

  const q = questions[order[pos]];
  const chosen = answers[pos];
  const answered = chosen !== undefined;
  const choose = (i: number) => { if (answered && instant) return; setAnswers((a) => ({ ...a, [pos]: i })); };
  const next = () => { if (pos + 1 >= order.length) setDone(true); else setPos(pos + 1); };

  return (
    <div className="flex h-full w-full flex-col gap-2 p-3" style={{ fontFamily: font }} onPointerDown={(e) => e.stopPropagation()}>
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--surface-overlay)]">
          <div className="h-full rounded-full transition-all" style={{ width: `${((pos + 1) / order.length) * 100}%`, background: accent }} />
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{pos + 1}/{order.length}</span>
      </div>
      {/* Prompt */}
      <p className="text-sm font-medium text-[var(--text-primary)]">{q?.prompt || <span className="italic text-[var(--text-muted)]">(no prompt)</span>}</p>
      {/* Options */}
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
        {(q?.options ?? []).map((opt, i) => {
          const isChosen = chosen === i;
          const showRight = instant && answered && i === q.correctIndex;
          const showWrong = instant && answered && isChosen && i !== q.correctIndex;
          return (
            <button key={i} onClick={() => choose(i)} disabled={answered && instant}
              className={cn("flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                showRight ? "border-green-500/60 bg-green-500/10 text-green-300"
                : showWrong ? "border-red-500/60 bg-red-500/10 text-red-300"
                : isChosen ? "text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]")}
              style={isChosen && !showRight && !showWrong ? { borderColor: accent, background: `color-mix(in srgb, ${accent} 10%, transparent)` } : undefined}
            >
              <span className="whitespace-pre-wrap break-words">{opt || <span className="italic opacity-60">(empty)</span>}</span>
              {showRight && <Check size={13} className="flex-shrink-0" />}
              {showWrong && <XIcon size={13} className="flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      {/* Footer */}
      <button onClick={next} disabled={!answered}
        className="rounded-lg py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-40"
        style={{ background: accent }}>
        {pos + 1 >= order.length ? "Finish" : "Next"}
      </button>
    </div>
  );
}

export function QuizStylePanel({ item, upd }: { item: BlockItem; upd: Upd }) {
  const questions = item.quizQuestions ?? [];
  const accent = item.quizAccent || "#d59ee8";
  const setQs = (next: QuizQuestion[]) => upd({ quizQuestions: next });
  const patch = (id: string, p: Partial<QuizQuestion>) => setQs(questions.map((q) => (q.id === id ? { ...q, ...p } : q)));

  return (
    <div className="flex flex-col gap-0 divide-y divide-[var(--border)] text-xs">
      <section className="p-3">
        <SLabel>Questions</SLabel>
        <div className="flex flex-col gap-2">
          {questions.map((q, qi) => (
            <div key={q.id} className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[var(--text-muted)]">Q{qi + 1}</span>
                <button onClick={() => setQs(questions.filter((x) => x.id !== q.id))} className="text-[var(--text-muted)] transition-colors hover:text-red-400"><Trash2 size={11} /></button>
              </div>
              <input value={q.prompt} onChange={(e) => patch(q.id, { prompt: e.target.value })} placeholder="Question"
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
              <div className="flex flex-col gap-1">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-1.5">
                    <button onClick={() => patch(q.id, { correctIndex: oi })} title="Mark correct"
                      className={cn("flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors",
                        q.correctIndex === oi ? "border-transparent bg-green-500 text-white" : "border-[var(--border)] text-transparent hover:border-green-500")}>
                      <Check size={9} />
                    </button>
                    <input value={opt} onChange={(e) => patch(q.id, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })}
                      placeholder={`Option ${oi + 1}`}
                      className="flex-1 min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                    {q.options.length > 2 && (
                      <button onClick={() => patch(q.id, { options: q.options.filter((_, k) => k !== oi), correctIndex: q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex })}
                        className="text-[var(--text-muted)] transition-colors hover:text-red-400"><XIcon size={10} /></button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button onClick={() => patch(q.id, { options: [...q.options, ""] })}
                    className="flex items-center gap-1 text-[11px] text-[var(--accent)] transition-opacity hover:opacity-80"><Plus size={10} /> Add option</button>
                )}
              </div>
            </div>
          ))}
          <button onClick={() => setQs([...questions, { id: nanoid(), prompt: "", options: ["", ""], correctIndex: 0 }])}
            className="flex items-center gap-1 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"><Plus size={11} /> Add question</button>
        </div>
      </section>
      <section className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">Instant feedback</span>
          <Toggle on={item.quizInstant !== false} onClick={() => upd({ quizInstant: !(item.quizInstant !== false) })} />
        </div>
      </section>
      <StudyOptions
        accent={accent}
        font={item.quizFontFamily ?? ""}
        onFont={(v) => upd({ quizFontFamily: v })}
        onAccent={(v) => upd({ quizAccent: v })}
        shuffle={!!item.quizShuffle}
        onShuffle={(v) => upd({ quizShuffle: v })}
      />
    </div>
  );
}

// ─── Shared panel bits ───────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{children}</div>;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("h-4 w-8 rounded-full transition-colors", on ? "bg-[var(--accent)]" : "bg-[var(--surface-overlay)]")}>
      <div className={cn("mx-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

function StudyOptions({ accent, font, onFont, onAccent, shuffle, onShuffle }: {
  accent: string; font: string; onFont: (v: string) => void; onAccent: (v: string) => void;
  shuffle: boolean; onShuffle: (v: boolean) => void;
}) {
  return (
    <section className="p-3">
      <SLabel>Options</SLabel>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">Shuffle</span>
          <Toggle on={shuffle} onClick={() => onShuffle(!shuffle)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">Font</span>
          <FontPicker value={font} onChange={onFont} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--text-secondary)]">Accent</span>
          <input type="color" value={accent.startsWith("#") ? accent : "#d59ee8"} onChange={(e) => onAccent(e.target.value)}
            className="h-6 w-10 cursor-pointer rounded border-0 p-0" />
        </div>
      </div>
    </section>
  );
}
