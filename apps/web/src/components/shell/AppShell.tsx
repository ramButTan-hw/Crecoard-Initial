"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ServerView } from "./ServerView";
import { ServerBoardHeader } from "../server/ServerBoardHeader";
import { SettingsPanel } from "./SettingsPanel";
import { TemplatesModal } from "./TemplatesModal";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";
import { createSnapToGrid } from "@/lib/snapToGrid";
import { CANVAS_WIDTH, CANVAS_HEIGHT, GRID_MINOR } from "@/lib/boardConstants";
import { applyThemeVars, applyAppFont, CSS_VAR_NAMES, ThemeVarMap } from "@/lib/appThemes";
import { CollabContext, useCollabSessionSetup } from "@/lib/useCollabSession";
import { ServerBoardContext } from "@/contexts/ServerBoardContext";
import { MOCK_SERVERS, MOCK_SERVER_MEMBERS, MOCK_SERVER_BOARDS } from "@/lib/mockServerData";
import type { MemberRole } from "@/types/server";

const DEMO_DMS: Record<string, { username: string; online: boolean }> = {
  d1: { username: "alex_dev", online: true },
  d2: { username: "sarah.m", online: false },
  d3: { username: "jordan", online: true },
};


export function AppShell() {
  const [activeView, setActiveView] = useState<"board" | "server" | "dm" | "friends">("board");
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [storageError, setStorageError] = useState(false);
  // Server board context — role can be toggled in the header for preview
  const [viewerRole, setViewerRole] = useState<MemberRole>("admin");

  const { addItem, moveBox, bringToFront, selectBox, setDraggingBlock, activeBoardId, zoom, themeVars, appFont, appBg, persistBoards, hydrateBoards, addBoardItem, injectServerBoards, setDragPos } = useBoardStore();
  const selectedBoardItemId = useBoardStore((s) => s.selectedBoardItemId);
  const boardThemeVars = useBoardStore((s) => {
    if (activeView === "server" && activeServerId) {
      const server = MOCK_SERVERS.find((srv) => srv.id === activeServerId);
      return server ? s.serverBoards[server.boardId]?.boardThemeVars : undefined;
    }
    return s.boards.find((b) => b.id === s.activeBoardId)?.boardThemeVars;
  });
  const selectedBoxId = useBoardStore((s) => s.selectedBoxId);
  const expandedBoxId = useBoardStore((s) => s.expandedBoxId);
  const board = useActiveBoard();
  const isFinished = board?.isFinished ?? false;

  const collabSession = useCollabSessionSetup(activeBoardId, board?.collabEnabled ?? false);

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
    if (activeView === "server" && boardThemeVars) {
      applyThemeVars(boardThemeVars);
    } else if (activeView !== "server") {
      applyThemeVars(themeVars);
    }
  }, [activeView, boardThemeVars, themeVars]);

  useEffect(() => {
    setIsDesktopApp(!!window.electron);
  }, []);

  // Escape key: close settings / templates overlays
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showTemplates) { setShowTemplates(false); return; }
      if (showSettings) { setShowSettings(false); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSettings, showTemplates]);

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
        ? MOCK_SERVERS.find((s) => s.id === activeServerId)?.boardId ?? activeBoardId
        : activeBoardId;
      bringToFront(effectiveBoardId, id);
      selectBox(id);
    }
  }, [activeView, activeServerId, activeBoardId, bringToFront, selectBox, setDraggingBlock]);

  const handleDragMove = useCallback((e: DragMoveEvent) => {
    if (e.active.data.current?.kind !== "block") return;
    const state = useBoardStore.getState();
    const boxId = e.active.id as string;
    const effectiveBoardId = (activeView === "server" && activeServerId)
      ? MOCK_SERVERS.find((s) => s.id === activeServerId)?.boardId ?? state.activeBoardId
      : state.activeBoardId;
    const board = state.boards.find((b) => b.id === effectiveBoardId) ?? state.serverBoards[effectiveBoardId];
    const box = board?.boxes.find((b) => b.id === boxId);
    if (!box) return;
    const snap = (v: number) => Math.round(v / GRID_MINOR) * GRID_MINOR;
    setDragPos({
      x: snap(box.x + e.delta.x / state.zoom),
      y: snap(box.y + e.delta.y / state.zoom),
    });
  }, [activeView, activeServerId, setDragPos]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setDragPos(null);
    const data = e.active.data.current;
    const state = useBoardStore.getState();
    // Resolve the correct board for the current view — server boards have their own ID
    const boardId = (activeView === "server" && activeServerId)
      ? MOCK_SERVERS.find((s) => s.id === activeServerId)?.boardId ?? state.activeBoardId
      : state.activeBoardId;

    if (data?.kind === "block") {
      const boxId = e.active.id as string;
      const board = state.boards.find((b) => b.id === boardId) ?? state.serverBoards[boardId];
      const box = board?.boxes.find((b) => b.id === boxId);
      if (box && e.delta) {
        const snap = (v: number) => Math.round(v / GRID_MINOR) * GRID_MINOR;
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
        state.addItem(boardId, boxId, {
          ...data.defaultItem(),
          showInCollapsed: !box.isExpanded,
        });
      } else {
        const canvasEl = document.querySelector("[data-board-canvas]") as HTMLElement | null;
        const scrollEl = canvasEl?.parentElement;
        if (canvasEl && scrollEl) {
          const activator = e.activatorEvent as MouseEvent | PointerEvent;
          const finalX = activator.clientX + e.delta.x;
          const finalY = activator.clientY + e.delta.y;
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
          state.addBoardItem(boardId, {
            ...data.defaultItem(),
            showInCollapsed: false,
            boardX: Math.max(0, snapV(canvasX - itemW / 2)),
            boardY: Math.max(0, snapV(canvasY - itemH / 2)),
            boardW: itemW,
            boardH: itemH,
          });
        }
      }
    }
  }, [activeView, activeServerId, moveBox, setDraggingBlock]);

  const handleServerSelect = (serverId: string) => {
    const server = MOCK_SERVERS.find((s) => s.id === serverId);
    if (!server) return;
    // Only reset the viewer role when actually switching to a different server —
    // re-clicking the active server icon shouldn't wipe a manually-toggled role.
    if (serverId !== activeServerId) {
      const myMembership = MOCK_SERVER_MEMBERS[serverId]?.find((m) => m.userId === "local-user");
      setViewerRole(myMembership?.role ?? "member");
    }
    setActiveServerId(serverId);
    setActiveDmId(null);
    setActiveView("server");
    // Apply server theme synchronously to avoid a one-frame flash of the personal theme
    const serverBoardVars = useBoardStore.getState().serverBoards[server.boardId]?.boardThemeVars;
    if (serverBoardVars) applyThemeVars(serverBoardVars);
  };

  const handleLeaveServer = () => {
    setActiveView("board");
    setActiveServerId(null);
    applyThemeVars(themeVars); // Restore personal theme immediately
  };

  const handleViewChange = (v: "board" | "server" | "dm" | "friends") => {
    if (v === "board" && activeView === "server") {
      setActiveServerId(null);
      applyThemeVars(themeVars); // Restore personal theme immediately
    }
    setActiveView(v);
  };

  const handleDmSelect = (dmId: string) => {
    setActiveDmId(dmId);
    setActiveServerId(null);
    setActiveView("dm");
  };


  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* App background layer */}
      {appBg.image && (
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
            <div className="flex flex-1 flex-col overflow-hidden" style={boardAreaCssVars}>
              <BoardTabs />
              <TopBar />
              <DndContext sensors={sensors} modifiers={[snapToGrid]} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
                <div className="flex flex-1 overflow-hidden">
                  <ItemPalette />
                  <BoardCanvas />
                  {selectedBoxId && !isFinished && !expandedBoxId && !selectedBoardItemId && <StylePanel boxId={selectedBoxId} />}
                  {selectedBoardItemId && !isFinished && !expandedBoxId && <BoardItemPanel />}
                </div>
              </DndContext>
            </div>
          </CollabContext.Provider>
        )}

        {/* Server board view — the server IS the board */}
        {activeView === "server" && activeServerId && (() => {
          const server = MOCK_SERVERS.find((s) => s.id === activeServerId);
          if (!server) return null;
          const members = MOCK_SERVER_MEMBERS[activeServerId] ?? [];
          const onlineCount = members.filter((m) => m.online).length;
          return (
            <ServerBoardContext.Provider key={activeServerId} value={{
              serverId: activeServerId,
              boardId: server.boardId,
              serverName: server.name,
              viewerRole,
              viewerId: "local-user",
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
                />
                <CollabContext.Provider value={collabSession}>
                  <DndContext sensors={sensors} modifiers={[snapToGrid]} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
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

        {activeView === "friends" && (
          <FriendsView onDmSelect={handleDmSelect} />
        )}

        {activeView === "dm" && (
          <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
            <ServerView
              mode="dm"
              dmId={activeDmId}
              dmUsername={activeDmId ? DEMO_DMS[activeDmId]?.username : undefined}
              dmOnline={activeDmId ? DEMO_DMS[activeDmId]?.online : undefined}
            />
          </div>
        )}
      </div>

      {/* Bottom navigation bar */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <BottomBar
          activeView={activeView}
          activeServerId={activeServerId}
          onViewChange={handleViewChange}
          onServerSelect={handleServerSelect}
          onSettingsOpen={() => setShowSettings((v) => !v)}
          onTemplatesOpen={() => setShowTemplates(true)}
          showMembers={showMembers}
          onToggleMembers={() => setShowMembers((v) => !v)}
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
    </div>
  );
}
