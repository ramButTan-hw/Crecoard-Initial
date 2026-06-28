"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import {
  DndContext, DragEndEvent, DragMoveEvent, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { BottomBar } from "./BottomBar";
import { FriendsView } from "./FriendsView";
import { BoardTabs } from "./BoardTabs";
import { TopBar } from "./TopBar";
import { BoardCanvas } from "../board/BoardCanvas";
import { ItemPalette } from "../board/ItemPalette";
import { ExpandedBlock } from "../board/ExpandedBlock";
import { BoardItemPanel } from "../board/BoardItemPanel";
import { StylePanel } from "../box/StylePanel";
import { ServerBoardHeader } from "../server/ServerBoardHeader";
import { DmPopout } from "./DmPopout";
import { SettingsPanel } from "./SettingsPanel";
import { TemplatesModal } from "./TemplatesModal";
import { ProfileModal } from "./ProfileModal";
import { SettingsModal } from "./SettingsModal";
import { UserProfileModal, type ViewableUser } from "./UserProfileModal";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";
import { createSnapToGrid } from "@/lib/snapToGrid";
import { CANVAS_WIDTH, CANVAS_HEIGHT, SNAP_UNIT } from "@/lib/boardConstants";
import { applyThemeVars, applyAppFont, CSS_VAR_NAMES, ThemeVarMap } from "@/lib/appThemes";
import { CollabContext, useCollabSessionSetup } from "@/lib/useCollabSession";
import { ServerBoardContext } from "@/contexts/ServerBoardContext";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { ServersProvider, useServers } from "@/contexts/ServersContext";
import { BoardSyncProvider, useBoardSync } from "@/contexts/BoardSyncContext";
import { MessagingProvider, useMessaging } from "@/contexts/MessagingContext";
import { BoardChatProvider } from "@/contexts/BoardChatContext";
import { FriendsProvider } from "@/contexts/FriendsContext";
import { MOCK_SERVERS, MOCK_SERVER_MEMBERS, MOCK_SERVER_BOARDS } from "@/lib/mockServerData";
import type { MemberRole } from "@/types/server";

function getEventCoords(e: PointerEvent | MouseEvent | TouchEvent) {
  if ("changedTouches" in e) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

const DEMO_DMS: Record<string, { username: string; online: boolean }> = {
  d1: { username: "alex_dev", online: true },
  d2: { username: "sarah.m", online: false },
  d3: { username: "jordan", online: true },
};


// Module-level RAF id — AppShell is a singleton so this is safe and avoids a ref.
let _dragMoveRafId: number | null = null;

// ─── Inner component: uses all contexts, contains all logic ──────────────────

function AppShellInner() {
  const [activeView, setActiveView] = useState<"board" | "server">("board");
  const [showFriends, setShowFriends] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  // boardId of the currently-active server (real or mock); avoids re-querying MOCK_SERVERS in hot paths
  const [activeServerBoardId, setActiveServerBoardId] = useState<string | null>(null);
  const [openDmIds, setOpenDmIds] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [viewingUser, setViewingUser] = useState<ViewableUser | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [storageError, setStorageError] = useState(false);
  // Gate localStorage-derived UI (appBg) until after mount so SSR markup and the
  // first client render match — otherwise React throws a hydration error.
  const [mounted, setMounted] = useState(false);
  // Server board context — role can be toggled in the header for preview
  const [viewerRole, setViewerRole] = useState<MemberRole>("admin");

  const { servers: realServers, serverMembers, loadMembers } = useServers();
  const { identity } = useUser();
  const { loadServerBoard } = useBoardSync();
  const { openConversation } = useMessaging();

  const { addItem, moveBox, bringToFront, selectBox, setDraggingBlock, activeBoardId, zoom, themeVars, appFont, appBg, persistBoards, hydrateBoards, addBoardItem, injectServerBoards, setDragPos } = useBoardStore();
  const selectedBoardItemId = useBoardStore((s) => s.selectedBoardItemId);
  const boardThemeVars = useBoardStore((s) => {
    if (activeView === "server" && activeServerBoardId) {
      return s.serverBoards[activeServerBoardId]?.boardThemeVars;
    }
    return s.boards.find((b) => b.id === s.activeBoardId)?.boardThemeVars;
  });
  const selectedBoxId = useBoardStore((s) => s.selectedBoxId);
  const expandedBoxId = useBoardStore((s) => s.expandedBoxId);
  const board = useActiveBoard();
  const isFinished = board?.isFinished ?? false;

  const collabSession = useCollabSessionSetup(activeBoardId, board?.collabEnabled ?? false);
  const collabRef = useRef(collabSession);
  useEffect(() => { collabRef.current = collabSession; }, [collabSession]);

  // Re-apply app theme vars and font on mount (SSR → client hydration)
  useEffect(() => {
    applyThemeVars(themeVars);
    applyAppFont(appFont);
    hydrateBoards();
    injectServerBoards(MOCK_SERVER_BOARDS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While in a server, apply the server board's theme to the document root so the
  // entire UI (sidebar, header, bottom bar) adopts the server's colour scheme.
  // When leaving, restore the user's personal theme.
  useEffect(() => {
    if (activeView === "server") {
      // Apply server board theme if available; fall back to personal theme so
      // stale colors from a previous board never persist (Bug M16/M17).
      applyThemeVars(boardThemeVars ?? themeVars);
    } else {
      // Always reset document root to the global personal theme when not in server
      // view. This ensures per-board CSS vars set by a previous server theme never
      // leak into the shell chrome (Bug M18).
      applyThemeVars(themeVars);
    }
  }, [activeView, boardThemeVars, themeVars]);

  useEffect(() => {
    setIsDesktopApp(!!window.electron);
    setMounted(true);
  }, []);

  // Escape key: close friends / settings / templates overlays
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Friends #11 — Escape closes friends modal first
      if (showFriends) { setShowFriends(false); return; }
      if (showProfile) { setShowProfile(false); return; }
      if (showUserSettings) { setShowUserSettings(false); return; }
      if (showTemplates) { setShowTemplates(false); return; }
      if (showSettings) { setShowSettings(false); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showFriends, showSettings, showTemplates, showProfile, showUserSettings]);

  // Storage-quota error notification (fired by persistBoards)
  useEffect(() => {
    const handler = () => setStorageError(true);
    window.addEventListener("plancraft:storage-error", handler as EventListener);
    return () => window.removeEventListener("plancraft:storage-error", handler as EventListener);
  }, []);

  // Debounced board persistence — saves all board data to localStorage on change
  useEffect(() => {
    const id = setTimeout(() => persistBoards(), 800);
    return () => clearTimeout(id);
  });

  // Build inline CSS var object for the board area — scopes board theme to that div only
  const boardAreaCssVars = boardThemeVars
    ? (Object.fromEntries(
        (Object.entries(CSS_VAR_NAMES) as [keyof ThemeVarMap, string][]).map(
          ([key, cssVar]) => [cssVar, boardThemeVars[key]]
        )
      ) as React.CSSProperties)
    : {};

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 6 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);
  // Zoom-aware snap: snap to GRID_MINOR canvas px regardless of zoom level
  const snapToGrid = useMemo(() => createSnapToGrid(zoom), [zoom]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.kind === "block") {
      const id = e.active.id as string;
      setDraggingBlock(id);
      const effectiveBoardId = (activeView === "server" && activeServerId)
        ? activeServerBoardId ?? activeBoardId
        : activeBoardId;
      bringToFront(effectiveBoardId, id);
      selectBox(id);
    }
  }, [activeView, activeServerId, activeServerBoardId, activeBoardId, bringToFront, selectBox, setDraggingBlock]);

  const handleDragMove = useCallback((e: DragMoveEvent) => {
    if (e.active.data.current?.kind !== "block") return;
    if (_dragMoveRafId !== null) return;
    // Capture snapshot of event data before the RAF fires (dnd-kit may recycle the event)
    const boxId = e.active.id as string;
    const deltaX = e.delta.x;
    const deltaY = e.delta.y;
    _dragMoveRafId = requestAnimationFrame(() => {
      _dragMoveRafId = null;
      const state = useBoardStore.getState();
      const effectiveBoardId = (activeView === "server" && activeServerId)
        ? activeServerBoardId ?? state.activeBoardId
        : state.activeBoardId;
      const board = state.boards.find((b) => b.id === effectiveBoardId) ?? state.serverBoards[effectiveBoardId];
      const box = board?.boxes.find((b) => b.id === boxId);
      if (!box) return;
      const snap = (v: number) => Math.round(v / SNAP_UNIT) * SNAP_UNIT;
      setDragPos({
        x: snap(box.x + deltaX / state.zoom),
        y: snap(box.y + deltaY / state.zoom),
      });
    });
  }, [activeView, activeServerId, activeServerBoardId, setDragPos]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    // Cancel any pending RAF from handleDragMove so stale updates don't fire after drop
    if (_dragMoveRafId !== null) {
      cancelAnimationFrame(_dragMoveRafId);
      _dragMoveRafId = null;
    }
    setDragPos(null);
    const data = e.active.data.current;
    const state = useBoardStore.getState();
    // Resolve the correct board for the current view — server boards have their own ID
    const boardId = (activeView === "server" && activeServerId)
      ? activeServerBoardId ?? state.activeBoardId
      : state.activeBoardId;

    if (data?.kind === "block") {
      const boxId = e.active.id as string;
      const board = state.boards.find((b) => b.id === boardId) ?? state.serverBoards[boardId];
      const box = board?.boxes.find((b) => b.id === boxId);
      if (box && e.delta) {
        const snap = (v: number) => Math.round(v / SNAP_UNIT) * SNAP_UNIT;
        const newX = Math.max(0, Math.min(CANVAS_WIDTH - box.width, snap(box.x + e.delta.x / state.zoom)));
        const newY = Math.max(0, Math.min(CANVAS_HEIGHT - box.height, snap(box.y + e.delta.y / state.zoom)));
        const cx = newX + box.width / 2;
        const cy = newY + box.height / 2;
        const target = !box.deckOwnerId ? board!.boxes.find(b =>
          b.id !== boxId &&
          !b.deckOwnerId &&
          cx >= b.x && cx <= b.x + b.width &&
          cy >= b.y && cy <= b.y + b.height
        ) : undefined;
        if (target) {
          if (target.isDeck) {
            state.addToDeck(boardId, target.id, boxId);
          } else {
            state.createDeck(boardId, boxId, target.id);
          }
          setDraggingBlock(null);
          return;
        }
        moveBox(boardId, boxId, newX, newY);
        collabRef.current.broadcastOp({ op: "moveBox", boardId, boxId, x: newX, y: newY });
      }
      setDraggingBlock(null);
      return;
    }

    if (data?.kind === "new-item") {
      const overId = e.over?.id as string | undefined;
      const boxId = overId?.startsWith("drop-") ? overId.slice(5) : overId;
      const b = state.boards.find((bd) => bd.id === boardId) ?? state.serverBoards[boardId];
      if (boxId && b?.boxes.some((bx) => bx.id === boxId)) {
        const box = b.boxes.find((bx) => bx.id === boxId)!;
        const itemId = nanoid();
        const item = { ...data.defaultItem(), id: itemId, showInCollapsed: !box.isExpanded };
        state.addItem(boardId, boxId, item);
        collabRef.current.broadcastOp({ op: "addItem", boardId, boxId, item });
      } else {
        const canvasEl = document.querySelector("[data-board-canvas]") as HTMLElement | null;
        const scrollEl = canvasEl?.parentElement;
        if (canvasEl && scrollEl) {
          const activator = e.activatorEvent as MouseEvent | PointerEvent | TouchEvent;
          const { x: activatorX, y: activatorY } = getEventCoords(activator);
          const finalX = activatorX + e.delta.x;
          const finalY = activatorY + e.delta.y;
          const scrollRect = scrollEl.getBoundingClientRect();
          const canvasX = (finalX - scrollRect.left - state.panOffset.x) / state.zoom;
          const canvasY = (finalY - scrollRect.top - state.panOffset.y) / state.zoom;
          const snapV = (v: number) => Math.round(v / 20) * 20;
          const defaultSizes: Partial<Record<string, [number, number]>> = {
            text: [280, 120], list: [280, 200], timer: [200, 200],
            graph: [360, 260], table: [500, 300], calendar: [400, 340],
            image: [280, 200], embed: [360, 260], widget: [360, 260],
            api: [280, 180], variable: [200, 80], playlist: [280, 300],
            chat: [320, 420],
          };
          const [itemW, itemH] = defaultSizes[data.itemType as string] ?? [280, 200];
          const boardItemId = nanoid();
          const boardItem = {
            ...data.defaultItem(),
            id: boardItemId,
            showInCollapsed: false as const,
            boardX: Math.max(0, snapV(canvasX - itemW / 2)),
            boardY: Math.max(0, snapV(canvasY - itemH / 2)),
            boardW: itemW,
            boardH: itemH,
          };
          state.addBoardItem(boardId, boardItem);
          collabRef.current.broadcastOp({ op: "addBoardItem", boardId, item: boardItem });
        }
      }
    }

    // Catch-all: always clear draggingBlockId regardless of data.kind so the
    // store never gets stuck with a stale dragging block reference (Bug M9).
    setDraggingBlock(null);
  }, [activeView, activeServerId, activeServerBoardId, moveBox, setDraggingBlock]);

  const handleServerSelect = (serverId: string) => {
    const realServer = realServers.find((s) => s.id === serverId);
    const mockServer = MOCK_SERVERS.find((s) => s.id === serverId);
    const server = realServer ?? mockServer;
    if (!server) return;

    // Track boardId so drag handlers and theme resolution don't re-query the lists
    setActiveServerBoardId(server.boardId);

    if (realServer) {
      // Inject a stub board immediately so the canvas renders without waiting for Supabase
      const state = useBoardStore.getState();
      if (!state.serverBoards[realServer.boardId]) {
        injectServerBoards([{
          id: realServer.boardId,
          name: realServer.name,
          isPublic: realServer.isPublic,
          isFinished: false,
          backgroundColor: "#131417",
          serverId: realServer.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          boxes: [],
        }]);
      }
      // Then load the real board from Supabase in the background (replaces stub if it exists)
      void loadServerBoard(realServer.boardId, realServer.id);
      void loadMembers(serverId);
    }

    // Only reset the viewer role when actually switching to a different server
    if (serverId !== activeServerId) {
      if (realServer) {
        const myMembership = (serverMembers[serverId] ?? []).find((m) => m.userId === identity.userId);
        setViewerRole(myMembership?.role ?? "member");
      } else {
        const myMembership = MOCK_SERVER_MEMBERS[serverId]?.find((m) => m.userId === "local-user");
        setViewerRole(myMembership?.role ?? "member");
      }
    }

    setActiveServerId(serverId);
    setActiveView("server");
    const serverBoardVars = useBoardStore.getState().serverBoards[server.boardId]?.boardThemeVars;
    applyThemeVars(serverBoardVars ?? themeVars);
    setTimeout(() => window.dispatchEvent(new CustomEvent("plancraft:fit-board")), 0);
  };

  const handleLeaveServer = () => {
    setActiveView("board");
    setActiveServerId(null);
    setActiveServerBoardId(null);
    applyThemeVars(themeVars); // Restore personal theme immediately
  };

  const handleViewChange = (v: "board" | "server") => {
    if (v === "board" && activeView === "server") {
      setActiveServerId(null);
      setActiveServerBoardId(null);
      applyThemeVars(themeVars); // Restore personal theme immediately
    }
    setActiveView(v);
  };

  const handleDmSelect = (dmId: string) => {
    setOpenDmIds((prev) => prev.includes(dmId) ? prev : [...prev, dmId]);
  };


  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* App background layer */}
      {mounted && appBg.image && (
        <>
          <div
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              backgroundImage: `url(${appBg.image})`,
              backgroundSize: appBg.size,
              backgroundPosition: "center",
              backgroundRepeat: appBg.size === "auto" ? "no-repeat" : undefined,
              opacity: appBg.opacity,
              filter: appBg.filter || undefined,
              pointerEvents: "none",
            }}
          />
          {appBg.overlayOpacity > 0 && (
            <div
              aria-hidden
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 0,
                backgroundColor: appBg.overlayColor,
                opacity: appBg.overlayOpacity,
                pointerEvents: "none",
              }}
            />
          )}
        </>
      )}

      {/* Main content area — fills all space above the bottom bar */}
      <div className="flex flex-1 overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
        {/* Personal board view */}
        {activeView === "board" && (
          <CollabContext.Provider value={collabSession}>
            {/* Outer DndContext wraps BoardTabs so its inner DndContext (tab reorder)
                is nested here — dnd-kit inner contexts take priority for their own
                draggables, preventing pointer-event bleed between tab and canvas drags. */}
            <DndContext id="dnd-board-canvas" sensors={sensors} modifiers={[snapToGrid]} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
              <div className="flex flex-1 flex-col overflow-hidden" style={boardAreaCssVars}>
                <BoardTabs />
                <TopBar />
                <div className="flex flex-1 overflow-hidden">
                  <ItemPalette />
                  <BoardCanvas />
                  {selectedBoxId && !isFinished && !expandedBoxId && !selectedBoardItemId && <StylePanel boxId={selectedBoxId} />}
                  {selectedBoardItemId && !isFinished && !expandedBoxId && <BoardItemPanel />}
                </div>
              </div>
            </DndContext>
          </CollabContext.Provider>
        )}

        {/* Server board view — the server IS the board */}
        {activeView === "server" && activeServerId && (() => {
          const realServer = realServers.find((s) => s.id === activeServerId);
          const mockServer = MOCK_SERVERS.find((s) => s.id === activeServerId);
          const server = realServer ?? mockServer;
          if (!server) return null;
          const members = realServer
            ? (serverMembers[activeServerId] ?? [])
            : (MOCK_SERVER_MEMBERS[activeServerId] ?? []);
          const onlineCount = members.filter((m) => m.online).length;
          return (
            <ServerBoardContext.Provider key={activeServerId} value={{
              serverId: activeServerId,
              boardId: server.boardId,
              serverName: server.name,
              viewerRole,
              viewerId: realServer ? identity.userId : "local-user",
              members,
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <ServerBoardHeader
                  serverId={activeServerId}
                  serverName={server.name}
                  serverIcon={server.icon}
                  description={server.description}
                  memberCount={server.memberCount}
                  onlineCount={onlineCount}
                  viewerRole={viewerRole}
                  members={members}
                  showMembers={showMembers}
                  onToggleMembers={() => setShowMembers((v) => !v)}
                  onRoleToggle={setViewerRole}
                  onViewProfile={(u) => setViewingUser(u)}
                />
                <CollabContext.Provider value={collabSession}>
                  <DndContext id="dnd-server-canvas" sensors={sensors} modifiers={[snapToGrid]} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
                    <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
                      {(viewerRole === "owner" || viewerRole === "admin") && <ItemPalette />}
                      <BoardCanvas />
                    </div>
                  </DndContext>
                </CollabContext.Provider>
              </div>
              {expandedBoxId && <ExpandedBlock boxId={expandedBoxId} />}
            </ServerBoardContext.Provider>
          );
        })()}

      </div>

      {/* Friends popup */}
      {showFriends && (
        <>
          {/* Friends #1 — backdrop fade-in; Friends #2 — backdrop click closes */}
          <div
            className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setShowFriends(false)}
          />
          {/* Friends #1 — modal entry animation; Friends #2 — viewport overflow guard */}
          <div
            className="fixed z-[999] w-[520px] max-h-[min(600px,calc(100vh-120px))] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in-0 duration-150"
            style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
          >
            <FriendsView
              onDmSelect={(id) => { handleDmSelect(id); setShowFriends(false); }}
              onClose={() => setShowFriends(false)}
              onViewProfile={(u) => setViewingUser(u)}
            />
          </div>
        </>
      )}

      {/* DM popout modals */}
      {openDmIds.map((dmId, idx) => (
        <DmPopout
          key={dmId}
          dmId={dmId}
          username={DEMO_DMS[dmId]?.username ?? dmId}
          online={DEMO_DMS[dmId]?.online ?? false}
          index={idx}
          onClose={() => setOpenDmIds((prev) => prev.filter((id) => id !== dmId))}
        />
      ))}

      {/* Bottom navigation bar */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <BottomBar
          activeView={activeView}
          activeServerId={activeServerId}
          showFriends={showFriends}
          onViewChange={handleViewChange}
          onFriendsToggle={() => setShowFriends((v) => !v)}
          onServerSelect={handleServerSelect}
          onSettingsOpen={() => setShowUserSettings(true)}
          onTemplatesOpen={() => setShowTemplates(true)}
          onProfileOpen={() => setShowProfile(true)}
        />
      </div>

      {storageError && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-lg border border-red-500/40 bg-[var(--surface)] px-4 py-2.5 shadow-xl text-sm text-red-400">
          <span>⚠️ Storage is full — changes may not be saved. Free up space or export your data.</span>
          <button onClick={() => setStorageError(false)} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors">Dismiss</button>
        </div>
      )}

      {expandedBoxId && activeView === "board" && <ExpandedBlock boxId={expandedBoxId} />}
      {/* Server view ExpandedBlock is rendered inside ServerBoardContext.Provider above */}

      {showSettings && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setShowSettings(false)} />
          <SettingsPanel onClose={() => setShowSettings(false)} />
        </>
      )}

      {showTemplates && (
        <TemplatesModal onClose={() => setShowTemplates(false)} />
      )}

      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}

      {viewingUser && (
        <UserProfileModal
          user={viewingUser}
          onClose={() => setViewingUser(null)}
          onDm={
        viewingUser.dmId
          ? () => { handleDmSelect(viewingUser.dmId!); setViewingUser(null); setShowFriends(false); }
          : viewingUser.userId && viewingUser.userId !== identity.userId
          ? async () => {
              const convId = await openConversation(viewingUser.userId!);
              if (convId) { handleDmSelect(convId); setViewingUser(null); }
            }
          : undefined
      }
        />
      )}

      {showUserSettings && (
        <SettingsModal onClose={() => setShowUserSettings(false)} />
      )}
    </div>
  );
}

// ─── Outer shell: provides all contexts ──────────────────────────────────────

export function AppShell() {
  return (
    <UserProvider>
      <ServersProvider>
        <BoardSyncProvider>
          <MessagingProvider>
            <BoardChatProvider>
              <FriendsProvider>
                <AppShellInner />
              </FriendsProvider>
            </BoardChatProvider>
          </MessagingProvider>
        </BoardSyncProvider>
      </ServersProvider>
    </UserProvider>
  );
}
