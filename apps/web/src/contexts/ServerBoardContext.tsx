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

/** Returns the server board object for the current server context, or undefined in personal view. */
export function useServerBoardData() {
  const { boardId } = useContext(ServerBoardContext);
  return useBoardStore((s) => (boardId ? s.serverBoards[boardId] : undefined));
}

/** True if viewer can edit board layout (move/resize/add blocks). */
export function useCanEditBoard() {
  const { viewerRole } = useContext(ServerBoardContext);
  return viewerRole === null || viewerRole === "owner" || viewerRole === "admin";
}
