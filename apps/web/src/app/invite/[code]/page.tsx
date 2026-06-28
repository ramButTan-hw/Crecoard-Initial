"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface InviteInfo {
  code: string;
  serverName: string;
  serverIcon: string;
  serverDescription: string;
  memberCount: number;
  isPublic: boolean;
  expired: boolean;
  alreadyMember: boolean;
}

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      // Fetch invite + server info in one query
      const { data, error: fetchErr } = await supabase
        .from("server_invites")
        .select("code, expires_at, max_uses, uses_count, server_id, servers(name, icon, description, member_count, is_public)")
        .eq("code", code)
        .single();

      if (fetchErr || !data) { setNotFound(true); return; }

      const server = (data.servers as unknown as Record<string, unknown> | null) ?? {};
      const expired =
        (data.expires_at && new Date(data.expires_at as string) < new Date()) ||
        (data.max_uses && (data.uses_count as number) >= (data.max_uses as number));

      // Check if already a member
      const { data: { user } } = await supabase.auth.getUser();
      let alreadyMember = false;
      if (user) {
        const { data: membership } = await supabase
          .from("server_members")
          .select("user_id")
          .eq("server_id", data.server_id as string)
          .eq("user_id", user.id)
          .maybeSingle();
        alreadyMember = !!membership;
      }

      setInfo({
        code: data.code as string,
        serverName: (server.name as string) || "Unknown Server",
        serverIcon: (server.icon as string) || "🌐",
        serverDescription: (server.description as string) || "",
        memberCount: (server.member_count as number) || 0,
        isPublic: (server.is_public as boolean) || false,
        expired: !!expired,
        alreadyMember,
      });
    })();
  }, [code]);

  const handleJoin = async () => {
    if (!info) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/login?redirect=/invite/${code}`);
      return;
    }

    setJoining(true);
    setError(null);

    // Get the server_id from the invite
    const { data: invite } = await supabase
      .from("server_invites")
      .select("server_id")
      .eq("code", code)
      .single();

    if (!invite) { setError("Invite not found."); setJoining(false); return; }

    const { error: joinErr } = await supabase
      .from("server_members")
      .insert({ server_id: invite.server_id, user_id: user.id, role: "member" });

    if (joinErr && !joinErr.message.includes("duplicate")) {
      setError("Failed to join server. Please try again.");
      setJoining(false);
      return;
    }

    // Increment uses_count
    await supabase
      .from("server_invites")
      .update({ uses_count: (info.memberCount || 0) + 1 })
      .eq("code", code);

    setJoined(true);
    setJoining(false);

    setTimeout(() => { router.push("/"); }, 1500);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0d0e11",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, sans-serif",
    padding: "20px",
  };

  const cardStyle: React.CSSProperties = {
    background: "#1a1b1e",
    border: "1px solid #2e3035",
    borderRadius: 20,
    padding: "40px 36px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
  };

  if (!info && !notFound) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: "#8b8d99", fontSize: 14 }}>Loading invite…</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔗</p>
          <h1 style={{ color: "#f2f2f2", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Invite not found
          </h1>
          <p style={{ color: "#8b8d99", fontSize: 14, marginBottom: 24 }}>
            This invite link may have expired or been deleted.
          </p>
          <a
            href="/"
            style={{
              display: "inline-block", background: "#d59ee8", color: "#fff",
              borderRadius: 12, padding: "10px 24px", fontSize: 14, fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Go to PlanCraft
          </a>
        </div>
      </div>
    );
  }

  if (joined) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
          <h1 style={{ color: "#f2f2f2", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Joined {info!.serverName}!
          </h1>
          <p style={{ color: "#8b8d99", fontSize: 14 }}>Redirecting you now…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Server icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: "#2e3035", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 36, margin: "0 auto 20px",
          border: "2px solid #3e4045",
        }}>
          {info!.serverIcon}
        </div>

        <p style={{ color: "#8b8d99", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
          You've been invited to join
        </p>
        <h1 style={{ color: "#f2f2f2", fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
          {info!.serverName}
        </h1>
        {info!.serverDescription && (
          <p style={{ color: "#8b8d99", fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
            {info!.serverDescription}
          </p>
        )}
        <p style={{ color: "#6d6f75", fontSize: 12, marginBottom: 28 }}>
          {info!.memberCount} member{info!.memberCount !== 1 ? "s" : ""}
          {info!.isPublic ? " · Public" : " · Private"}
        </p>

        {info!.expired ? (
          <div style={{
            background: "#2a1a1a", border: "1px solid #4a2020",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          }}>
            <p style={{ color: "#f87171", fontSize: 13 }}>This invite has expired or reached its use limit.</p>
          </div>
        ) : info!.alreadyMember ? (
          <div style={{
            background: "#1a2a1a", border: "1px solid #2a4a2a",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20,
          }}>
            <p style={{ color: "#4ade80", fontSize: 13 }}>You're already a member of this server.</p>
          </div>
        ) : null}

        {error && (
          <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16 }}>{error}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {info!.alreadyMember ? (
            <a
              href="/"
              style={{
                display: "block", background: "#d59ee8", color: "#fff",
                borderRadius: 12, padding: "12px 24px", fontSize: 14,
                fontWeight: 700, textDecoration: "none", cursor: "pointer",
              }}
            >
              Open PlanCraft
            </a>
          ) : (
            <button
              onClick={handleJoin}
              disabled={joining || !!info!.expired}
              style={{
                background: info!.expired ? "#2e3035" : "#d59ee8",
                color: info!.expired ? "#6d6f75" : "#fff",
                border: "none", borderRadius: 12, padding: "12px 24px",
                fontSize: 14, fontWeight: 700, cursor: info!.expired ? "not-allowed" : "pointer",
                width: "100%",
              }}
            >
              {joining ? "Joining…" : info!.expired ? "Invite Expired" : "Accept Invite"}
            </button>
          )}
          <a
            href="/"
            style={{
              display: "block", color: "#6d6f75", fontSize: 13,
              textDecoration: "none", cursor: "pointer",
            }}
          >
            No thanks
          </a>
        </div>
      </div>
    </div>
  );
}
