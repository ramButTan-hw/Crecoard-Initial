"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Trash2, Edit2, Camera, Upload, Check } from "lucide-react";
import { ImageCropModal } from "@/components/shell/ImageCropModal";

function loadServerStorage(serverId: string) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(`plancraft-server-${serverId}`) ?? "null") as { iconUrl?: string; name?: string; description?: string } | null; } catch { return null; }
}
function saveServerStorage(serverId: string, data: { iconUrl?: string; name: string; description: string }) {
  localStorage.setItem(`plancraft-server-${serverId}`, JSON.stringify(data));
}
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/store/boardStore";
import { useUser } from "@/contexts/UserContext";
import { uploadFile, uploadDataUrl } from "@/lib/storage";
import { useServerBoard, useServerBoardData } from "@/contexts/ServerBoardContext";
import { useServers } from "@/contexts/ServersContext";
import { WallpaperEditor } from "@/components/ui/WallpaperEditor";
import { MOCK_SERVERS, MOCK_SERVER_MEMBERS } from "@/lib/mockServerData";
import { PRESET_THEMES, BG_FILTERS, type ThemeVarMap } from "@/lib/appThemes";
import type { ServerRole, MemberRole } from "@/types/server";

interface ServerSettingsProps {
  serverId: string;
  onClose: () => void;
}

type Tab = "overview" | "appearance" | "roles" | "members";

const COLOR_KEYS: { key: keyof ThemeVarMap; label: string }[] = [
  { key: "surface",        label: "Surface" },
  { key: "surfaceRaised",  label: "Panels" },
  { key: "surfaceOverlay", label: "Overlay" },
  { key: "sidebar",        label: "Sidebar" },
  { key: "accent",         label: "Accent" },
  { key: "accentHover",    label: "Acc. Hover" },
  { key: "border",         label: "Border" },
  { key: "textPrimary",    label: "Text" },
  { key: "textSecondary",  label: "Text 2" },
  { key: "textMuted",      label: "Muted" },
];

const PERMISSION_LABELS: Array<{ key: keyof ServerRole["permissions"]; label: string }> = [
  { key: "canViewBoard",      label: "View board" },
  { key: "canEditBoard",      label: "Edit board" },
  { key: "canUploadFiles",    label: "Upload files" },
  { key: "canManageMembers",  label: "Manage members" },
  { key: "canInviteMembers",  label: "Invite members" },
];

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: "text-yellow-400",
  admin: "text-[var(--accent)]",
  member: "text-[var(--text-muted)]",
};

const MEMBER_AVATAR_COLORS: Record<string, string> = {
  "u-alex":   "#d59ee8",
  "u-sarah":  "#eb459e",
  "u-jordan": "#57f287",
  "u-riley":  "#fee75c",
  "u-mia":    "#ed4245",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ServerSettings({ serverId, onClose }: ServerSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const bgFileRef = useRef<HTMLInputElement>(null);
  const themeBgFileRef = useRef<HTMLInputElement>(null);

  const { updateBoard, setBoardTheme, clearBoardTheme, themeVars } = useBoardStore();
  const { identity } = useUser();
  const { servers, serverMembers, loadMembers, updateServer } = useServers();
  const { boardId } = useServerBoard();
  const currentBoard = useServerBoardData();

  const isReal = UUID_RE.test(serverId);
  const mockServer = MOCK_SERVERS.find((s) => s.id === serverId);
  const realServer = isReal ? servers.find((s) => s.id === serverId) : undefined;
  // Unified display source — real server wins over mock
  const server = mockServer ?? realServer;

  // Real server members (loaded via context); mock servers use static data
  const mockMembers = MOCK_SERVER_MEMBERS[serverId] ?? [];
  const members = isReal ? (serverMembers[serverId] ?? []) : mockMembers;

  // Load real server members on mount
  useEffect(() => {
    if (isReal) void loadMembers(serverId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId, isReal]);

  // For real servers the icon field may be an emoji ("🎮") or a Storage URL.
  // We track them separately so removing an uploaded image reverts to the emoji.
  const iconEmoji = (() => {
    const ic = realServer?.icon ?? mockServer?.icon ?? "🌐";
    return ic.startsWith("http") ? "🌐" : ic;
  })();

  // Overview local state
  const [nameValue, setNameValue] = useState(() =>
    isReal ? (realServer?.name ?? "") : (loadServerStorage(serverId)?.name ?? server?.name ?? "")
  );
  const [descValue, setDescValue] = useState(() =>
    isReal ? (realServer?.description ?? "") : (loadServerStorage(serverId)?.description ?? server?.description ?? "")
  );
  const [iconUrl, setIconUrl] = useState<string | undefined>(() => {
    if (isReal) {
      const ic = realServer?.icon;
      return ic?.startsWith("http") ? ic : undefined;
    }
    return loadServerStorage(serverId)?.iconUrl;
  });
  const [iconCropSrc, setIconCropSrc] = useState<string | null>(null);
  const [savedOverview, setSavedOverview] = useState(false);
  const iconFileRef = useRef<HTMLInputElement>(null);

  const handleSaveOverview = async () => {
    let finalIconUrl = iconUrl;
    if (iconUrl?.startsWith("data:")) {
      const url = await uploadDataUrl(iconUrl, identity.userId, "server-icons", "icon.png");
      if (url) finalIconUrl = url;
    }
    if (isReal) {
      await updateServer(serverId, {
        name: nameValue,
        description: descValue,
        icon: finalIconUrl ?? iconEmoji,
      });
      if (finalIconUrl !== iconUrl) setIconUrl(finalIconUrl);
    } else {
      saveServerStorage(serverId, { iconUrl: finalIconUrl, name: nameValue, description: descValue });
      window.dispatchEvent(new CustomEvent("plancraft-server-updated", { detail: { serverId } }));
    }
    setSavedOverview(true);
    setTimeout(() => setSavedOverview(false), 2000);
  };

  // Roles local state
  const [roles, setRoles] = useState<ServerRole[]>(() => server?.roles ?? []);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  // Members local state
  const [memberRoles, setMemberRoles] = useState<Record<string, MemberRole>>(
    () => Object.fromEntries(members.map((m) => [m.userId, m.role]))
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!server && !realServer) return null;
  const displayServer = server ?? realServer!;

  // Appearance helpers
  const boardVars: ThemeVarMap = currentBoard?.boardThemeVars ?? themeVars;
  const hasBoardTheme = !!currentBoard?.boardThemeVars;

  const upd = (patch: Parameters<typeof updateBoard>[1]) => { if (boardId) updateBoard(boardId, patch); };

  const bgColor        = currentBoard?.backgroundColor ?? "#1a1b1e";
  const bgOpacity      = currentBoard?.backgroundOpacity ?? 1;
  const bgSize         = currentBoard?.backgroundSize ?? "cover";
  const bgPosition     = currentBoard?.backgroundPosition ?? "center";
  const bgFilter       = currentBoard?.backgroundFilter ?? "";
  const overlayColor   = currentBoard?.backgroundOverlayColor ?? "#000000";
  const overlayOpacity = currentBoard?.backgroundOverlayOpacity ?? 0;

  const themeBgColor   = currentBoard?.themeBgColor ?? "#0f1014";
  const themeBgOpacity = currentBoard?.themeBgOpacity ?? 1;
  const themeBgSize    = currentBoard?.themeBgSize ?? "cover";

  const handleBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      upd({ backgroundImage: dataUrl });
      void uploadFile(file, identity.userId, "themes", file.name).then((url) => {
        if (url) upd({ backgroundImage: url });
      });
    };
    reader.readAsDataURL(file);
  };

  const handleThemeBgFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      upd({ themeBgImage: dataUrl });
      void uploadFile(file, identity.userId, "themes", file.name).then((url) => {
        if (url) upd({ themeBgImage: url });
      });
    };
    reader.readAsDataURL(file);
  };

  // Roles helpers
  function handleAddRole() {
    const newRole: ServerRole = {
      id: `role-custom-${Date.now()}`,
      name: "New Role",
      color: "#6366f1",
      permissions: {
        canViewBoard: true,
        canEditBoard: false,
        canUploadFiles: false,
        canManageRoles: false,
        canManageMembers: false,
        canInviteMembers: false,
      },
    };
    setRoles((prev) => [...prev, newRole]);
    setEditingRoleId(newRole.id);
  }

  function handleDeleteRole(id: string) {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    if (editingRoleId === id) setEditingRoleId(null);
  }

  function patchRole(id: string, patch: Partial<ServerRole>) {
    setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function patchRolePermission(id: string, key: keyof ServerRole["permissions"], value: boolean) {
    setRoles((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, permissions: { ...r.permissions, [key]: value } } : r
      )
    );
  }

  const NAV_ITEMS: { id: Tab; label: string }[] = [
    { id: "overview",   label: "Overview" },
    { id: "appearance", label: "Appearance" },
    { id: "roles",      label: "Roles" },
    { id: "members",    label: "Members" },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-black/60" onClick={onClose} />

      <div className="fixed inset-0 z-[1001] flex" style={{ background: "var(--surface)" }}>
        {/* Left nav */}
        <div
          className="w-[220px] flex-shrink-0 border-r border-[var(--border)] flex flex-col p-4 gap-1"
          style={{ background: "var(--sidebar)" }}
        >
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Server Settings
          </p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                activeTab === item.id
                  ? "bg-[var(--surface-overlay)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)]/50 hover:text-[var(--text-primary)]"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>

          {/* ── Overview ─────────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="max-w-lg">
              <h2 className="mb-6 text-xl font-bold text-[var(--text-primary)]">Overview</h2>

              {/* Server icon */}
              <div className="mb-6">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Server Icon
                </label>
                <div className="flex items-center gap-4">
                  <div
                    className="relative cursor-pointer group rounded-2xl overflow-hidden flex-shrink-0"
                    style={{ width: 80, height: 80, background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                    onClick={() => iconFileRef.current?.click()}
                  >
                    {iconUrl
                      ? <img src={iconUrl} alt="" className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-[var(--text-primary)] select-none">{iconEmoji}</span>
                    }
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <Camera size={16} className="text-white" />
                      <span className="text-white text-[10px] font-medium">Change</span>
                    </div>
                    <input
                      ref={iconFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]; if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setIconCropSrc(ev.target?.result as string);
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-[var(--text-secondary)]">{nameValue || displayServer.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{displayServer.memberCount} members</p>
                    {iconUrl && (
                      <button
                        onClick={() => setIconUrl(undefined)}
                        className="self-start text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Server Name
                  </label>
                  <input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={descValue}
                    onChange={(e) => setDescValue(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] resize-none transition-colors"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => void handleSaveOverview()}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                      savedOverview
                        ? "bg-green-500/20 text-green-400"
                        : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    )}
                  >
                    {savedOverview ? <><Check size={14} /> Saved!</> : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Appearance ───────────────────────────────────────────────── */}
          {activeTab === "appearance" && (
            <div className="max-w-xl flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Appearance</h2>
                {hasBoardTheme && (
                  <button
                    onClick={() => { if (boardId) clearBoardTheme(boardId); }}
                    className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors underline"
                  >
                    Reset to app theme
                  </button>
                )}
              </div>

              {/* Color presets */}
              <div>
                <SectionLabel>Color presets</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_THEMES.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => { if (boardId) setBoardTheme(boardId, preset.vars); }}
                      className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]"
                    >
                      <span className="h-2.5 w-2.5 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: preset.vars.accent }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual color pickers */}
              <div>
                <SectionLabel>Colors</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                  {COLOR_KEYS.map(({ key, label }) => (
                    <ColorPickerRow
                      key={key}
                      label={label}
                      value={boardVars[key]}
                      onChange={(v) => { if (boardId) setBoardTheme(boardId, { ...boardVars, [key]: v }); }}
                    />
                  ))}
                </div>
              </div>

              {/* ── Theme Background (outer — behind canvas) ── */}
              <div className="rounded-lg border border-[var(--border)] p-4 flex flex-col gap-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Theme Background <span className="normal-case text-[var(--text-muted)] font-normal tracking-normal">· behind canvas</span>
                </p>

                <div>
                  <SectionLabel>Color</SectionLabel>
                  <div className="flex items-center gap-2.5">
                    <label className="relative h-8 w-12 cursor-pointer overflow-hidden rounded border border-[var(--border)]" style={{ backgroundColor: themeBgColor }}>
                      <input type="color" value={themeBgColor} onChange={(e) => upd({ themeBgColor: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{themeBgColor}</span>
                  </div>
                </div>

                <div>
                  <SectionLabel>Image</SectionLabel>
                  <input
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                    placeholder="https://… paste image URL"
                    value={currentBoard?.themeBgImage?.startsWith("data:") ? "" : (currentBoard?.themeBgImage ?? "")}
                    onChange={(e) => upd({ themeBgImage: e.target.value || undefined })}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => themeBgFileRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Upload size={12} /> Upload file
                    </button>
                    {currentBoard?.themeBgImage && (
                      <button onClick={() => upd({ themeBgImage: undefined })} className="rounded border border-[var(--border)] px-2.5 text-xs text-[var(--text-muted)] hover:border-red-400 hover:text-red-400 transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                  <input ref={themeBgFileRef} type="file" accept="image/*" className="hidden" onChange={handleThemeBgFileUpload} />
                </div>

                {currentBoard?.themeBgImage && (
                  <>
                    <div>
                      <SectionLabel>Size</SectionLabel>
                      <div className="flex gap-1.5">
                        {(["cover", "contain", "auto"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => upd({ themeBgSize: s })}
                            className={cn(
                              "flex-1 rounded border py-1 text-xs capitalize transition-colors",
                              themeBgSize === s
                                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <SectionLabel>Opacity</SectionLabel>
                        <span className="text-xs text-[var(--text-muted)]">{Math.round(themeBgOpacity * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.01} value={themeBgOpacity} onChange={(e) => upd({ themeBgOpacity: parseFloat(e.target.value) })} className="w-full accent-[var(--accent)]" />
                    </div>
                  </>
                )}
              </div>

              {/* ── Board Background (inner — part of canvas) ── */}
              <div className="rounded-lg border border-[var(--border)] p-4 flex flex-col gap-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                  Board Background <span className="normal-case text-[var(--text-muted)] font-normal tracking-normal">· moves with canvas</span>
                </p>

                <div>
                  <SectionLabel>Color</SectionLabel>
                  <div className="flex items-center gap-2.5">
                    <label className="relative h-8 w-12 cursor-pointer overflow-hidden rounded border border-[var(--border)]" style={{ backgroundColor: bgColor }}>
                      <input type="color" value={bgColor} onChange={(e) => upd({ backgroundColor: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                    <span className="font-mono text-xs text-[var(--text-muted)]">{bgColor}</span>
                  </div>
                </div>

                <div>
                  <SectionLabel>Wallpaper</SectionLabel>
                  <input
                    className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                    placeholder="https://… paste image URL"
                    value={currentBoard?.backgroundImage?.startsWith("data:") ? "" : (currentBoard?.backgroundImage ?? "")}
                    onChange={(e) => upd({ backgroundImage: e.target.value || undefined })}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => bgFileRef.current?.click()}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Upload size={12} /> Upload file
                    </button>
                    {currentBoard?.backgroundImage && (
                      <button onClick={() => upd({ backgroundImage: undefined })} className="rounded border border-[var(--border)] px-2.5 text-xs text-[var(--text-muted)] hover:border-red-400 hover:text-red-400 transition-colors">
                        Clear
                      </button>
                    )}
                  </div>
                  <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgFileUpload} />
                </div>

                {currentBoard?.backgroundImage && (
                  <div className="flex flex-col gap-4">
                    <WallpaperEditor
                      url={currentBoard.backgroundImage}
                      size={bgSize}
                      position={bgPosition}
                      opacity={bgOpacity}
                      backgroundColor={bgColor}
                      onSizeChange={(v) => upd({ backgroundSize: v })}
                      onPositionChange={(v) => upd({ backgroundPosition: v })}
                      onOpacityChange={(v) => upd({ backgroundOpacity: v })}
                    />
                    <div>
                      <SectionLabel>Filter</SectionLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {BG_FILTERS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => upd({ backgroundFilter: f.value })}
                            className={cn(
                              "rounded border px-2.5 py-1 text-xs transition-colors",
                              bgFilter === f.value
                                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            )}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <SectionLabel>Color Tint</SectionLabel>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 hover:border-[var(--text-muted)] transition-colors mb-1.5">
                        <span className="relative h-5 w-5 flex-shrink-0 rounded border border-white/15 overflow-hidden" style={{ backgroundColor: overlayColor }}>
                          <input type="color" value={overlayColor} onChange={(e) => upd({ backgroundOverlayColor: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </span>
                        <span className="flex-1 text-xs text-[var(--text-secondary)]">Tint color</span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">{overlayColor}</span>
                      </label>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-[var(--text-muted)]">Intensity</span>
                        <span className="text-xs text-[var(--text-muted)]">{Math.round(overlayOpacity * 100)}%</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.01} value={overlayOpacity} onChange={(e) => upd({ backgroundOverlayOpacity: parseFloat(e.target.value) })} className="w-full accent-[var(--accent)]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Roles ─────────────────────────────────────────────────────── */}
          {activeTab === "roles" && (
            <div className="max-w-lg">
              <h2 className="mb-6 text-xl font-bold text-[var(--text-primary)]">Roles</h2>

              <div className="flex flex-col gap-2 mb-4">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="rounded-xl border border-[var(--border)]"
                    style={{ background: "var(--surface-raised)" }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ background: role.color }} />
                      <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{role.name}</span>
                      {role.isDefault && (
                        <span className="text-[10px] text-[var(--text-muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                          default
                        </span>
                      )}
                      <button
                        onClick={() => setEditingRoleId(editingRoleId === role.id ? null : role.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      {!role.isDefault && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {editingRoleId === role.id && (
                      <div className="border-t border-[var(--border)] px-4 py-4 flex flex-col gap-4">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Role Name
                            </label>
                            <input
                              value={role.name}
                              onChange={(e) => patchRole(role.id, { name: e.target.value })}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Color
                            </label>
                            <input
                              type="color"
                              value={role.color}
                              onChange={(e) => patchRole(role.id, { color: e.target.value })}
                              className="h-[34px] w-10 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent p-0.5"
                            />
                          </div>
                        </div>

                        <div>
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Permissions
                          </p>
                          <div className="flex flex-col gap-2">
                            {PERMISSION_LABELS.map(({ key, label }) => (
                              <label key={key} className="flex items-center gap-3 cursor-pointer">
                                <div
                                  onClick={() => patchRolePermission(role.id, key, !role.permissions[key])}
                                  className={cn(
                                    "relative h-4 w-8 rounded-full transition-colors flex-shrink-0 cursor-pointer",
                                    role.permissions[key] ? "bg-[var(--accent)]" : "bg-[var(--surface-overlay)]"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                                      role.permissions[key] ? "translate-x-4" : "translate-x-0.5"
                                    )}
                                  />
                                </div>
                                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddRole}
                className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors w-full justify-center"
              >
                <Plus size={15} /> Create role
              </button>
            </div>
          )}

          {/* ── Members ───────────────────────────────────────────────────── */}
          {activeTab === "members" && (
            <div className="max-w-lg">
              <h2 className="mb-6 text-xl font-bold text-[var(--text-primary)]">Members</h2>

              <div className="flex flex-col gap-1">
                {members.map((member) => {
                  const isYou = member.userId === identity.userId;
                  const currentRole = memberRoles[member.userId] ?? member.role;
                  return (
                    <div
                      key={member.userId}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 border border-[var(--border)]"
                      style={{ background: "var(--surface-raised)" }}
                    >
                      <div className="relative flex-shrink-0">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: MEMBER_AVATAR_COLORS[member.userId] ?? "var(--accent)" }}
                        >
                          {member.avatar}
                        </span>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface-raised)]",
                            member.online ? "bg-green-500" : "bg-[var(--text-muted)]"
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {member.username}
                          {isYou && (
                            <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">(You)</span>
                          )}
                        </p>
                        {member.status && (
                          <p className="text-[11px] text-[var(--text-muted)] truncate">{member.status}</p>
                        )}
                      </div>

                      <select
                        value={currentRole}
                        onChange={(e) =>
                          setMemberRoles((prev) => ({
                            ...prev,
                            [member.userId]: e.target.value as MemberRole,
                          }))
                        }
                        className={cn(
                          "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium outline-none cursor-pointer",
                          ROLE_COLORS[currentRole]
                        )}
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {iconCropSrc && (
        <ImageCropModal
          src={iconCropSrc}
          shape="rect"
          previewW={280}
          previewH={280}
          outputW={256}
          outputH={256}
          onApply={(url) => { setIconUrl(url); setIconCropSrc(null); }}
          onClose={() => setIconCropSrc(null)}
        />
      )}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </p>
  );
}

function ColorPickerRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-2 py-1.5 hover:border-[var(--text-muted)] transition-colors">
      <span
        className="relative h-5 w-5 flex-shrink-0 rounded border border-white/15 shadow-sm overflow-hidden"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">{label}</span>
      <span className="font-mono text-[10px] text-[var(--text-muted)] flex-shrink-0">{value}</span>
    </label>
  );
}
