import { supabase } from "@/lib/supabase";

/** Lead times offered by the "Remind me" control, as ms before the event start. */
export interface ReminderLead { label: string; ms: number }
export const REMINDER_LEADS: ReminderLead[] = [
  { label: "At start", ms: 0 },
  { label: "10 minutes before", ms: 10 * 60_000 },
  { label: "1 hour before", ms: 60 * 60_000 },
  { label: "1 day before", ms: 24 * 60 * 60_000 },
];

/**
 * Resolve a calendar event's local date+time into an absolute Date. All-day events
 * default to 9:00 on the day so a "1 day before" reminder still has a sensible time.
 */
export function eventStartDate(date: string, startTime?: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (startTime ?? "09:00").split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 9, mm ?? 0);
}

export async function createReminder(input: {
  userId: string;
  title: string;
  body?: string;
  remindAt: Date;
  boardId?: string;
  itemId?: string;
  url?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("reminders").insert({
    user_id: input.userId,
    title: input.title,
    body: input.body ?? "",
    remind_at: input.remindAt.toISOString(),
    channel: "email",
    board_id: input.boardId ?? null,
    item_id: input.itemId ?? null,
    url: input.url ?? null,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
