"use client";

import {
  createContext, useCallback, useContext, useEffect, useState,
} from "react";
import { supabase } from "@/lib/supabase";
import type { Server, ServerMember } from "@/types/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSupabaseReady(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return Boolean(url) && !url.includes("placeholder");
}

type ServerRow = Record<string, unknown>;
type MemberRow = Record<string, unknown>;

function rowToServer(row: ServerRow): Server {
  return {
    id:          row.id as string,
    name:        row.name as string,
    icon:        row.icon as string,
    description: (row.description as string) || "",
    ownerId:     row.owner_id as string,
    boardId:     row.board_id as string,
    isPublic:    row.is_public as boolean,
    memberCount: (row.member_count as number) || 1,
    onlineCount: 0,
    createdAt:   row.created_at as string,
  };
}

function rowToMember(row: MemberRow): ServerMember {
  return {
    userId:   row.user_id as string,
    username: (row.display_name as string) || "Unknown",
    avatar:   (row.avatar_url as string) || ((row.display_name as string)?.[0] ?? "?").toUpperCase(),
    role:     row.role as ServerMember["role"],
    online:   false,
    status:   undefined,
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface ServersContextValue {
  /** Real servers from Supabase that the current user belongs to */
  servers: Server[];
  /** Members keyed by server_id, loaded on first visit to a real server */
  serverMembers: Record<string, ServerMember[]>;
  loading: boolean;
  createServer: (input: {
    name: string;
    icon: string;
    description: string;
    isPublic: boolean;
  }) => Promise<Server | null>;
  leaveServer: (serverId: string) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  /** Creates an invite row and returns a full invite URL */
  generateInvite: (serverId: string) => Promise<string | null>;
  /** Loads members for a server if not yet cached */
  loadMembers: (serverId: string) => Promise<void>;
  /** Update name / description / icon for a real server in Supabase */
  updateServer: (serverId: string, patch: { name?: string; description?: string; icon?: string }) => Promise<void>;
}

const ServersContext = createContext<ServersContextValue | null>(null);

export function useServers(): ServersContextValue {
  const ctx = useContext(ServersContext);
  if (!ctx) throw new Error("useServers must be inside <ServersProvider>");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ServersProvider({ children }: { children: React.ReactNode }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [serverMembers, setServerMembers] = useState<Record<string, ServerMember[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseReady()) { setLoading(false); return; }

    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }

      // Fetch all servers the user is a member of
      const { data: memberRows } = await supabase
        .from("server_members")
        .select("server_id")
        .eq("user_id", user.id);

      if (!memberRows?.length) { if (!cancelled) setLoading(false); return; }

      const serverIds = memberRows.map((r) => r.server_id as string);
      const { data: serverRows } = await supabase
        .from("servers")
        .select("*")
        .in("id", serverIds)
        .order("created_at", { ascending: false });

      if (!cancelled && serverRows) {
        setServers(serverRows.map(rowToServer));
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const createServer = useCallback(async (input: {
    name: string;
    icon: string;
    description: string;
    isPublic: boolean;
  }): Promise<Server | null> => {
    if (!isSupabaseReady()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("servers")
      .insert({
        name:        input.name.trim(),
        icon:        input.icon || "🌐",
        description: input.description.trim(),
        is_public:   input.isPublic,
        owner_id:    user.id,
      })
      .select()
      .single();

    if (error || !data) { console.error(error); return null; }

    const newServer = rowToServer(data);
    setServers((prev) => [newServer, ...prev]);
    return newServer;
  }, []);

  const leaveServer = useCallback(async (serverId: string) => {
    if (!isSupabaseReady()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("server_members")
      .delete()
      .eq("server_id", serverId)
      .eq("user_id", user.id);

    setServers((prev) => prev.filter((s) => s.id !== serverId));
    setServerMembers((prev) => {
      const next = { ...prev };
      delete next[serverId];
      return next;
    });
  }, []);

  const deleteServer = useCallback(async (serverId: string) => {
    if (!isSupabaseReady()) return;
    await supabase.from("servers").delete().eq("id", serverId);
    setServers((prev) => prev.filter((s) => s.id !== serverId));
    setServerMembers((prev) => {
      const next = { ...prev };
      delete next[serverId];
      return next;
    });
  }, []);

  const generateInvite = useCallback(async (serverId: string): Promise<string | null> => {
    if (!isSupabaseReady()) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("server_invites")
      .insert({ server_id: serverId, created_by: user.id })
      .select("code")
      .single();

    if (error || !data) { console.error(error); return null; }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/invite/${data.code}`;
  }, []);

  const updateServer = useCallback(async (
    serverId: string,
    patch: { name?: string; description?: string; icon?: string }
  ) => {
    if (!isSupabaseReady()) return;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.description !== undefined) update.description = patch.description.trim();
    if (patch.icon !== undefined) update.icon = patch.icon;
    const { error } = await supabase.from("servers").update(update).eq("id", serverId);
    if (error) { console.error(error); return; }
    setServers((prev) =>
      prev.map((s) => s.id === serverId ? { ...s, ...patch } : s)
    );
  }, []);

  const loadMembers = useCallback(async (serverId: string) => {
    if (!isSupabaseReady()) return;
    if (serverMembers[serverId]) return; // already loaded

    // Join server_members with profiles for display name + avatar
    const { data, error } = await supabase
      .from("server_members")
      .select("user_id, role, joined_at, profiles(display_name, avatar_url, color)")
      .eq("server_id", serverId);

    if (error || !data) return;

    const members: ServerMember[] = data.map((row) => {
      const profile = (row.profiles as unknown as Record<string, unknown> | null) ?? {};
      const displayName = (profile.display_name as string) || "Unknown";
      const avatarUrl = profile.avatar_url as string | undefined;
      return {
        userId:   row.user_id as string,
        username: displayName,
        avatar:   avatarUrl ?? displayName[0]?.toUpperCase() ?? "?",
        role:     row.role as ServerMember["role"],
        online:   false,
      };
    });

    setServerMembers((prev) => ({ ...prev, [serverId]: members }));
  }, [serverMembers]);

  return (
    <ServersContext.Provider value={{
      servers, serverMembers, loading,
      createServer, leaveServer, deleteServer, generateInvite, loadMembers, updateServer,
    }}>
      {children}
    </ServersContext.Provider>
  );
}
