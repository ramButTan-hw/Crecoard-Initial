"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext, DragEndEvent, DragStartEvent,
  MouseSensor, TouchSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import { Sidebar } from "./Sidebar";
import { BoardTabs } from "./BoardTabs";
import { TopBar } from "./TopBar";
import { BoardCanvas } from "../board/BoardCanvas";
import { ItemPalette } from "../board/ItemPalette";
import { ExpandedBlock } from "../board/ExpandedBlock";
import { StylePanel } from "../box/StylePanel";
import { ServerView } from "./ServerView";
import { SettingsPanel } from "./SettingsPanel";
import { TemplatesModal } from "./TemplatesModal";
import { useBoardStore, useActiveBoard } from "@/store/boardStore";
import { snapToGrid } from "@/lib/snapToGrid";
import { applyThemeVars, applyAppFont, CSS_VAR_NAMES, ThemeVarMap } from "@/lib/appThemes";
import { CollabContext, useCollabSessionSetup } from "@/lib/useCollabSession";

const DEMO_SERVERS: Record<string, { name: string }> = {
  s1: { name: "Design Team" },
  s2: { name: "Startup Hub" },
  s3: { name: "Dev Community" },
};

const DEMO_DMS: Record<string, { username: string; online: boolean }> = {
  d1: { username: "alex_dev", online: true },
  d2: { username: "sarah.m", online: false },
  d3: { username: "jordan", online: true },
};

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<"board" | "server" | "dm">("board");
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const { addItem, moveBox, bringToFront, selectBox, setDraggingBlock, activeBoardId, zoom, themeVars, appFont, appBg, persistBoards, hydrateBoards } = useBoardStore();
  const boardThemeVars = useBoardStore((s) => s.boards.find((b) => b.id === s.activeBoardId)?.boardThemeVars);
  const selectedBoxId = useBoardStore((s) => s.selectedBoxId);
  const expandedBoxId = useBoardStore((s) => s.expandedBoxId);
  const board = useActiveBoard();
  const isFinished = board?.isFinished ?? false;

  const collabSession = useCollabSessionSetup(activeBoardId, board?.collabEnabled ?? false);

  // Re-apply app theme vars and font on mount (SSR → client hydration)
  // Board theme is scoped via inline styles — not applied to the document root.
  useEffect(() => {
    applyThemeVars(themeVars);
    applyAppFont(appFont);
    hydrateBoards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.kind === "block") {
      const id = e.active.id as string;
      setDraggingBlock(id);
      bringToFront(activeBoardId, id);
      selectBox(id);
    }
  }, [activeBoardId, bringToFront, selectBox, setDraggingBlock]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const data = e.active.data.current;

    if (data?.kind === "block") {
      const boxId = e.active.id as string;
      const state = useBoardStore.getState();
      const boardId = state.activeBoardId;
      const board = state.boards.find((b) => b.id === boardId);
      const box = board?.boxes.find((b) => b.id === boxId);
      if (box && e.delta) {
        const snap = (v: number) => Math.round(v / 20) * 20;
        const newX = Math.max(0, snap(box.x + e.delta.x / state.zoom));
        const newY = Math.max(0, snap(box.y + e.delta.y / state.zoom));
        const cx = newX + box.width / 2;
        const cy = newY + box.height / 2;
        // Check if center of dragged box lands inside another box → merge into deck
        const target = board!.boxes.find(b =>
          b.id !== boxId &&
          !b.deckOwnerId &&
          cx >= b.x && cx <= b.x + b.width &&
          cy >= b.y && cy <= b.y + b.height
        );
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
      const state = useBoardStore.getState();
      const b = state.boards.find((bd) => bd.id === state.activeBoardId);
      if (boxId && b?.boxes.some((bx) => bx.id === boxId)) {
        const box = b.boxes.find((bx) => bx.id === boxId)!;
        state.addItem(state.activeBoardId, boxId, {
          ...data.defaultItem(),
          showInCollapsed: !box.isExpanded,
        });
      }
    }
  }, [moveBox, setDraggingBlock]);

  const handleServerSelect = (serverId: string) => {
    setActiveServerId(serverId);
    setActiveDmId(null);
    setActiveView("server");
  };

  const handleDmSelect = (dmId: string) => {
    setActiveDmId(dmId);
    setActiveServerId(null);
    setActiveView("dm");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: "var(--surface)" }}>
      {/* App background layer — sits at z-index 0; panels (z=1) paint on top */}
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

      {/* Sidebar wrapper — z-index 1 ensures it paints above the fixed bg */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", height: "100%", flexShrink: 0 }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          activeView={activeView}
          activeServerId={activeServerId}
          activeDmId={activeDmId}
          onViewChange={setActiveView}
          onServerSelect={handleServerSelect}
          onDmSelect={handleDmSelect}
          onSettingsOpen={() => setShowSettings((v) => !v)}
          onTemplatesOpen={() => setShowTemplates(true)}
        />
      </div>

      {/* Main content — z-index 1 */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ position: "relative", zIndex: 1 }}>
        {/* Board area — board CSS vars scoped here so they never reach ServerView */}
        {activeView === "board" && (
          <CollabContext.Provider value={collabSession}>
          <div className="flex flex-1 flex-col overflow-hidden" style={boardAreaCssVars}>
            <BoardTabs />
            <TopBar />
            <DndContext sensors={sensors} modifiers={[snapToGrid]} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="flex flex-1 overflow-hidden">
                <ItemPalette />
                <BoardCanvas />
                {selectedBoxId && !isFinished && !expandedBoxId && <StylePanel boxId={selectedBoxId} />}
              </div>
            </DndContext>
          </div>
          </CollabContext.Provider>
        )}

        {activeView !== "board" && (
          /* ServerView always gets an opaque surface background — app wallpaper must not bleed through */
          <div className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--surface)" }}>
          <ServerView
            mode={activeView as "server" | "dm"}
            serverId={activeServerId}
            dmId={activeDmId}
            serverName={activeServerId ? DEMO_SERVERS[activeServerId]?.name : undefined}
            dmUsername={activeDmId ? DEMO_DMS[activeDmId]?.username : undefined}
            dmOnline={activeDmId ? DEMO_DMS[activeDmId]?.online : undefined}
          />
          </div>
        )}
      </div>

      {expandedBoxId && activeView === "board" && <ExpandedBlock boxId={expandedBoxId} />}

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
