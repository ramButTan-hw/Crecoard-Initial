"use client";

import { createContext, useContext } from "react";
import { useBoardStore } from "@/store/boardStore";
import type { MemberRole, ServerMember } from "@/types/server";

export interface ServerBoardContextValue {
  serverId: string | null;
  /** The board ID belonging to this server — null in personal view */
  boardId: string | null;
  serverName: string;
  viewerRole: MemberRole | null;
  viewerId: string;
  members: ServerMember[];
}

export const ServerBoardContext = createContext<ServerBoardContextValue>({
  serverId: null,
  boardId: null,
  serverName: "",
  viewerRole: null,
  viewerId: "local-user",
  members: [],
});

export function useServerBoard() {
  return useContext(ServerBoardContext);
}

/** Alias for useServerBoard — use this inside permission hooks. */
export function useServerBoardContext() {
  return useContext(ServerBoardContext);
}

/** Returns the server board object for the current server context, or undefined in personal view. */
export function useServerBoardData() {
  const { boardId } = useContext(ServerBoardContext);
  return useBoardStore((s) => (boardId ? s.serverBoards[boardId] : undefined));
}

/**
 * True if the viewer can edit board layout (move/resize/add blocks).
 * - null viewerRole  → personal board, always editable
 * - "owner" / "admin" → full edit access
 * - "member" → read-only
 */
export function useCanEditBoard() {
  const { viewerRole } = useServerBoardContext();
  return viewerRole === null || viewerRole === "owner" || viewerRole === "admin";
}

// TODO: wire to file upload UI — no file upload button exists in ServerBoardHeader yet
/**
 * True if the viewer can upload files to file-bank blocks.
 * - null viewerRole  → personal board, always allowed
 * - "owner" / "admin" → allowed
 * - "member" → not allowed
 */
export function useCanUploadFiles() {
  const { viewerRole } = useServerBoardContext();
  return viewerRole === null || viewerRole === "owner" || viewerRole === "admin";
}

/**
 * True if the viewer can invite new members to the server.
 * - null viewerRole  → personal board (no concept of invites), returns false
 * - "owner" / "admin" → allowed
 * - "member" → not allowed
 */
export function useCanInviteMembers() {
  const { viewerRole } = useServerBoardContext();
  return viewerRole === "owner" || viewerRole === "admin";
}

/**
 * True if the viewer can manage (kick/ban/edit) existing members.
 * Only owners have this permission; admins can invite but not manage.
 * - null viewerRole  → personal board, returns false
 * - "owner" → allowed
 * - "admin" / "member" → not allowed
 */
export function useCanManageMembers() {
  const { viewerRole } = useServerBoardContext();
  return viewerRole === "owner";
}
