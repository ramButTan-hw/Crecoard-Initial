/**
 * Collaboration layer — real-time room presence, timer sync, and shared logs.
 *
 * All functions are Supabase-ready stubs. The UI calls only these functions.
 * Replace each stub body with the real Supabase Realtime call shown in the
 * TODO comment when the backend is connected.
 */


// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollabPresence {
  userId: string;
  displayName: string;
  /** CSS hex color assigned to this member */
  color: string;
  joinedAt: string; // ISO 8601
}

export interface TimerSyncState {
  running: boolean;
  remaining: number;   // seconds remaining (countdown mode)
  elapsed: number;     // seconds elapsed (stopwatch mode)
  phase: "work" | "break" | "long-break";
  cycleCount: number;
  /** performance.now() snapshot at broadcast time — used for drift correction */
  sentAt: number;
}

/** A row change broadcast from one collaborator to others. */
export interface CollabTableRow {
  itemId: string;
  boardId: string;
  rowId: string;
  cells: Record<string, string | boolean>;
  deleted?: boolean;
}

// ─── Room management ──────────────────────────────────────────────────────────

/**
 * Join a collaboration room for a board.
 *
 * TODO (Supabase Realtime):
 *   const channel = supabase.channel(`room:${boardId}`, {
 *     config: { presence: { key: userId } },
 *   });
 *   channel.on('presence', { event: 'join' }, ({ newPresences }) => { ... });
 *   channel.on('presence', { event: 'leave' }, ({ leftPresences }) => { ... });
 *   await channel.subscribe(async (status) => {
 *     if (status === 'SUBSCRIBED') {
 *       await channel.track({ userId, displayName, color, joinedAt: new Date().toISOString() });
 *     }
 *   });
 *   return { boardId, channelName: `room:${boardId}` };
 */
export async function joinRoom(
  boardId: string
): Promise<{ boardId: string; channelName: string }> {
  void boardId;
  return { boardId, channelName: `room:${boardId}` };
}

/**
 * Leave a collaboration room and untrack presence.
 *
 * TODO (Supabase Realtime):
 *   const channel = supabase.channel(channelName);
 *   await channel.untrack();
 *   await supabase.removeChannel(channel);
 */
export async function leaveRoom(channelName: string): Promise<void> {
  void channelName;
}

/**
 * Subscribe to who is currently in the session.
 *
 * TODO (Supabase Realtime):
 *   const channel = supabase.channel(channelName);
 *   channel.on('presence', { event: 'sync' }, () => {
 *     const raw = channel.presenceState<CollabPresence>();
 *     cb(Object.values(raw).flat());
 *   }).subscribe();
 *   return () => supabase.removeChannel(channel);
 */
export function subscribeToPresence(
  channelName: string,
  cb: (members: CollabPresence[]) => void
): () => void {
  void channelName; void cb;
  return () => {};
}

// ─── Timer sync ───────────────────────────────────────────────────────────────

/**
 * Broadcast the current timer state to everyone in the room.
 *
 * TODO (Supabase Realtime):
 *   await supabase.channel(channelName).send({
 *     type: 'broadcast',
 *     event: `timer:${itemId}`,
 *     payload: { ...state, sentAt: performance.now() },
 *   });
 */
export async function broadcastTimerState(
  channelName: string,
  itemId: string,
  state: TimerSyncState
): Promise<void> {
  void channelName; void itemId; void state;
}

/**
 * Subscribe to timer sync events from other members.
 *
 * TODO (Supabase Realtime):
 *   const channel = supabase.channel(channelName);
 *   channel.on('broadcast', { event: `timer:${itemId}` }, ({ payload }) => {
 *     // drift correction
 *     const driftSecs = (performance.now() - payload.sentAt) / 1000;
 *     const corrected = {
 *       ...payload,
 *       remaining: Math.max(0, payload.remaining - (payload.running ? driftSecs : 0)),
 *       elapsed: payload.elapsed + (payload.running ? driftSecs : 0),
 *     };
 *     cb(corrected);
 *   }).subscribe();
 *   return () => supabase.removeChannel(channel);
 */
export function subscribeToTimerSync(
  channelName: string,
  itemId: string,
  cb: (state: TimerSyncState) => void
): () => void {
  void channelName; void itemId; void cb;
  return () => {};
}

// ─── Cursor presence ──────────────────────────────────────────────────────────

export interface CursorState {
  userId: string;
  displayName: string;
  color: string;
  /** Canvas coordinates (before zoom) */
  x: number;
  y: number;
}

export interface SelfIdentity {
  userId: string;
  displayName: string;
  color: string;
}

const COLLAB_COLORS = [
  "#5865f2", "#eb459e", "#57f287", "#fee75c",
  "#ed4245", "#00b0f4", "#faa61a", "#9c84ef",
];

export function getSelfIdentity(): SelfIdentity {
  if (typeof window === "undefined") return { userId: "ssr", displayName: "You", color: COLLAB_COLORS[0] };
  const stored = localStorage.getItem("plancraft-user-identity");
  if (stored) { try { return JSON.parse(stored) as SelfIdentity; } catch {} }
  const userId = Math.random().toString(36).slice(2, 10);
  const color = COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)];
  const identity: SelfIdentity = { userId, displayName: "Anonymous", color };
  localStorage.setItem("plancraft-user-identity", JSON.stringify(identity));
  return identity;
}

export function updateSelfIdentity(patch: Partial<Omit<SelfIdentity, "userId">>): void {
  if (typeof window === "undefined") return;
  const identity = getSelfIdentity();
  localStorage.setItem("plancraft-user-identity", JSON.stringify({ ...identity, ...patch }));
}

/**
 * Broadcast your cursor position to all room members.
 *
 * TODO (Supabase Realtime):
 *   await supabase.channel(channelName).send({
 *     type: 'broadcast', event: 'cursor', payload: cursor,
 *   });
 */
export async function broadcastCursor(channelName: string, cursor: CursorState): Promise<void> {
  void channelName; void cursor;
}

/**
 * Subscribe to remote cursor moves.
 *
 * TODO (Supabase Realtime):
 *   const map = new Map<string, CursorState>();
 *   const channel = supabase.channel(channelName);
 *   channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
 *     map.set(payload.userId, payload as CursorState);
 *     cb(Array.from(map.values()));
 *   }).subscribe();
 *   return () => supabase.removeChannel(channel);
 */
export function subscribeToCursors(
  channelName: string,
  cb: (cursors: CursorState[]) => void,
): () => void {
  void channelName; void cb;
  return () => {};
}

// ─── Collaborative table rows ─────────────────────────────────────────────────

/**
 * Broadcast a row add/edit/delete to all room members and persist it.
 *
 * TODO (Supabase Realtime + DB):
 *   // 1. Upsert or delete in database
 *   if (row.deleted) {
 *     await supabase.from('table_rows').delete().eq('id', row.rowId).eq('item_id', row.itemId);
 *   } else {
 *     await supabase.from('table_rows').upsert({ id: row.rowId, item_id: row.itemId, cells: row.cells });
 *   }
 *   // 2. Broadcast to peers
 *   await supabase.channel(channelName).send({
 *     type: 'broadcast', event: `table:${row.itemId}`, payload: row,
 *   });
 */
export async function broadcastTableRow(
  channelName: string,
  row: CollabTableRow
): Promise<void> {
  void channelName; void row;
}

/**
 * Subscribe to incoming table row changes from collaborators.
 *
 * TODO (Supabase Realtime):
 *   const channel = supabase.channel(channelName);
 *   channel.on('broadcast', { event: `table:${itemId}` }, ({ payload }) => {
 *     cb(payload as CollabTableRow);
 *   }).subscribe();
 *   return () => supabase.removeChannel(channel);
 */
export function subscribeToTableRows(
  channelName: string,
  itemId: string,
  cb: (row: CollabTableRow) => void
): () => void {
  void channelName; void itemId; void cb;
  return () => {};
}
