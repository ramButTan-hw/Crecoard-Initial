import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "nanoid";
import {
  ThemeVarMap, SavedTheme, AppBgConfig,
  DEFAULT_THEME_VARS, DEFAULT_APP_BG, applyThemeVars, applyAppFont,
} from "@/lib/appThemes";

// ─── Item types ───────────────────────────────────────────────────────────────

export type ItemType =
  | "text" | "list" | "variable" | "embed" | "timer"
  | "image" | "graph" | "gaming" | "divider" | "widget";

export type GameId = "valorant" | "lol" | "apex" | "csgo";

export interface ListEntry { id: string; text: string; checked: boolean }
export interface GraphPoint { label: string; value: number }

export interface BlockItem {
  id: string;
  type: ItemType;
  showInCollapsed: boolean;

  // Layout inside expanded canvas
  expandedX?: number;
  expandedY?: number;
  expandedW?: number;
  expandedH?: number;

  // text
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  textColor?: string;
  textBgColor?: string;
  textBgImage?: string;
  textBorderStyle?: "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset" | "glow";
  textBorderColor?: string;
  textBorderWidth?: number;
  textBorderRadius?: number;

  // list
  listItems?: ListEntry[];
  listFontFamily?: string;
  listFontSize?: number;
  listFontColor?: string;
  listWallpaperUrl?: string;
  listWallpaperSize?: string;
  listWallpaperPosition?: string;
  listWallpaperOpacity?: number;
  listFontAutoScale?: boolean;
  listBorderWidth?: number;
  listBorderColor?: string;
  listBorderStyle?: string;
  listBorderRadius?: number;
  listMarker?: "checkbox" | "bullet" | "number" | "none";
  listRowSpacing?: number;

  // variable
  varName?: string;
  varFormula?: string;

  // embed
  embedUrl?: string;

  // timer
  timerSeconds?: number;
  timerLabel?: string;

  // image
  imageUrl?: string;
  imageObjectFit?: "cover" | "contain" | "fill";

  // graph
  graphType?: "bar" | "line" | "pie";
  graphData?: GraphPoint[];
  graphTitle?: string;

  // gaming
  game?: GameId;
  gameUsername?: string;
  gameTag?: string;

  // widget (custom HTML/CSS/JS)
  widgetCode?: string;
}

// ─── Block (box on the board) ─────────────────────────────────────────────────

export interface BoxStyle {
  backgroundColor: string;
  wallpaperUrl: string;
  wallpaperOpacity: number;
  wallpaperSize?: string;
  wallpaperPosition?: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  borderStyle: "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset" | "glow";
  shadow: "none" | "sm" | "md" | "lg";
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  fontWeight: "normal" | "medium" | "bold";
  padding: number;
  customCss?: string;
}

export const DEFAULT_BOX_STYLE: BoxStyle = {
  backgroundColor: "#25262b",
  wallpaperUrl: "",
  wallpaperOpacity: 1,
  borderColor: "#373a40",
  borderWidth: 1,
  borderRadius: 10,
  borderStyle: "solid",
  shadow: "sm",
  fontFamily: "Inter",
  fontSize: 14,
  fontColor: "#f2f2f2",
  fontWeight: "normal",
  padding: 14,
};

export interface Box {
  id: string;
  boardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
  title: string;
  isExpanded: boolean;
  items: BlockItem[];
  style: BoxStyle;
}

// ─── Board ────────────────────────────────────────────────────────────────────

export interface Board {
  id: string;
  name: string;
  isPublic: boolean;
  isFinished: boolean;
  // Board background
  backgroundColor: string;
  backgroundImage?: string;
  backgroundOpacity?: number;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundFilter?: string;
  backgroundOverlayColor?: string;
  backgroundOverlayOpacity?: number;
  // Board-scoped theme (applied only inside the board area, never to the document root)
  boardThemeVars?: ThemeVarMap;
  boxes: Box[];
  createdAt: number;
  updatedAt: number;
}

// ─── Variable evaluator ───────────────────────────────────────────────────────

export function resolveVars(items: BlockItem[]): Record<string, number> {
  const vars: Record<string, number> = {};
  const varItems = items.filter((i) => i.type === "variable" && i.varName);
  const unresolved = new Set(varItems.map((i) => i.varName!));

  for (let pass = 0; pass < varItems.length + 1; pass++) {
    let progress = false;
    for (const item of varItems) {
      const name = item.varName!;
      if (!unresolved.has(name)) continue;
      const result = evalVarFormula(item.varFormula ?? "0", vars);
      if (result !== "pending") {
        vars[name] = typeof result === "number" ? result : NaN;
        unresolved.delete(name);
        progress = true;
      }
    }
    if (unresolved.size === 0) break;
    if (!progress) {
      for (const name of unresolved) vars[name] = NaN;
      break;
    }
  }
  return vars;
}

function evalVarFormula(
  formula: string,
  known: Record<string, number>
): number | "pending" | "error" {
  let expr = formula.trim();
  const refs = [...expr.matchAll(/\{([^}]+)\}/g)];
  for (const [full, name] of refs) {
    const trimmed = name.trim();
    if (!(trimmed in known)) return "pending";
    expr = expr.replace(full, String(known[trimmed]));
  }
  if (!/^[\d\s+\-*/%.(),]+$/.test(expr)) return "error";
  try {
    // eslint-disable-next-line no-new-func
    const v = Function(`"use strict"; return (${expr})`)();
    return typeof v === "number" && isFinite(v) ? v : "error";
  } catch {
    return "error";
  }
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function getSavedThemeVars(): ThemeVarMap {
  if (typeof window === "undefined") return DEFAULT_THEME_VARS;
  try {
    const raw = localStorage.getItem("plancraft-theme-vars");
    return raw ? (JSON.parse(raw) as ThemeVarMap) : DEFAULT_THEME_VARS;
  } catch { return DEFAULT_THEME_VARS; }
}

function getSavedThemes(): SavedTheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("plancraft-saved-themes");
    return raw ? (JSON.parse(raw) as SavedTheme[]) : [];
  } catch { return []; }
}

function getSavedFont(): string {
  if (typeof window === "undefined") return "Inter";
  return localStorage.getItem("plancraft-app-font") ?? "Inter";
}

function getSavedAppBg(): AppBgConfig {
  if (typeof window === "undefined") return { ...DEFAULT_APP_BG };
  try {
    const raw = localStorage.getItem("plancraft-app-bg");
    // Merge with defaults so old saved data without new fields still works
    return raw ? { ...DEFAULT_APP_BG, ...(JSON.parse(raw) as Partial<AppBgConfig>) } : { ...DEFAULT_APP_BG };
  } catch { return { ...DEFAULT_APP_BG }; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultBoard(name = "My Board"): Board {
  return {
    id: nanoid(),
    name,
    isPublic: false,
    isFinished: false,
    backgroundColor: "#1a1b1e",
    boxes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function findBox(boards: Board[], boardId: string, boxId: string) {
  return boards.find((b) => b.id === boardId)?.boxes.find((b) => b.id === boxId);
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface BoardState {
  boards: Board[];
  activeBoardId: string;
  selectedBoxId: string | null;
  expandedBoxId: string | null;
  draggingBlockId: string | null;
  showGrid: boolean;
  showRuler: boolean;
  zoom: number;

  // App appearance
  themeVars: ThemeVarMap;
  savedThemes: SavedTheme[];
  appFont: string;
  appBg: AppBgConfig;

  // Board
  addBoard: (name?: string) => void;
  removeBoard: (id: string) => void;
  setActiveBoard: (id: string) => void;
  updateBoard: (id: string, patch: Partial<Omit<Board, "id" | "boxes">>) => void;
  finishBoard: (id: string) => void;
  editBoard: (id: string) => void;

  // Box (block)
  addBox: (boardId: string, box: Omit<Box, "id" | "boardId" | "zIndex">) => string;
  removeBox: (boardId: string, boxId: string) => void;
  updateBox: (boardId: string, boxId: string, patch: Partial<Omit<Box, "id" | "boardId" | "items">>) => void;
  moveBox: (boardId: string, boxId: string, x: number, y: number) => void;
  resizeBox: (boardId: string, boxId: string, width: number, height: number) => void;
  updateBoxStyle: (boardId: string, boxId: string, style: Partial<BoxStyle>) => void;
  bringToFront: (boardId: string, boxId: string) => void;

  // Items inside blocks
  addItem: (boardId: string, boxId: string, item: Omit<BlockItem, "id">) => void;
  removeItem: (boardId: string, boxId: string, itemId: string) => void;
  updateItem: (boardId: string, boxId: string, itemId: string, patch: Partial<BlockItem>) => void;
  moveItemUp: (boardId: string, boxId: string, itemId: string) => void;
  moveItemDown: (boardId: string, boxId: string, itemId: string) => void;
  toggleItemInCollapsed: (boardId: string, boxId: string, itemId: string) => void;
  moveExpandedItem: (boardId: string, boxId: string, itemId: string, x: number, y: number) => void;
  resizeExpandedItem: (boardId: string, boxId: string, itemId: string, w: number, h: number) => void;

  // Selection & expand
  selectBox: (id: string | null) => void;
  setExpandedBox: (id: string | null) => void;
  setDraggingBlock: (id: string | null) => void;

  // View
  toggleGrid: () => void;
  toggleRuler: () => void;
  setZoom: (z: number) => void;

  // Appearance actions
  setThemeVars: (vars: ThemeVarMap) => void;        // app-level (Settings)
  setBoardTheme: (boardId: string, vars: ThemeVarMap) => void; // board-level (ThemePanel)
  clearBoardTheme: (boardId: string) => void;
  saveCurrentTheme: (name: string, vars: ThemeVarMap) => void;
  deleteSavedTheme: (id: string) => void;
  setAppFont: (name: string) => void;
  setAppBg: (patch: Partial<AppBgConfig>) => void;

  // User fonts (for box style panel)
  userFonts: UserFont[];
  addUserFont: (font: UserFont) => void;
  removeUserFont: (name: string) => void;
}

export interface UserFont {
  name: string;
  dataUrl: string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialBoard = makeDefaultBoard("My First Board");

export const useBoardStore = create<BoardState>()(
  immer((set, get) => ({
    boards: [initialBoard],
    activeBoardId: initialBoard.id,
    selectedBoxId: null,
    expandedBoxId: null,
    draggingBlockId: null,
    showGrid: true,
    showRuler: true,
    zoom: 1,
    themeVars: getSavedThemeVars(),
    savedThemes: getSavedThemes(),
    appFont: getSavedFont(),
    appBg: getSavedAppBg(),
    userFonts: [],

    addBoard: (name) =>
      set((s) => {
        const b = makeDefaultBoard(name);
        s.boards.push(b);
        s.activeBoardId = b.id;
      }),

    removeBoard: (id) =>
      set((s) => {
        s.boards = s.boards.filter((b) => b.id !== id);
        if (s.activeBoardId === id && s.boards.length > 0)
          s.activeBoardId = s.boards[0].id;
      }),

    setActiveBoard: (id) => set((s) => { s.activeBoardId = id; }),

    updateBoard: (id, patch) =>
      set((s) => {
        const b = s.boards.find((b) => b.id === id);
        if (b) Object.assign(b, patch, { updatedAt: Date.now() });
      }),

    finishBoard: (id) =>
      set((s) => {
        const b = s.boards.find((b) => b.id === id);
        if (!b) return;
        b.isFinished = true;
        b.boxes.forEach((bx) => { bx.locked = true; bx.isExpanded = false; });
        s.showGrid = false;
        s.showRuler = false;
        s.selectedBoxId = null;
        s.expandedBoxId = null;
      }),

    editBoard: (id) =>
      set((s) => {
        const b = s.boards.find((b) => b.id === id);
        if (!b) return;
        b.isFinished = false;
        b.boxes.forEach((bx) => { bx.locked = false; });
        s.showGrid = true;
        s.showRuler = true;
      }),

    addBox: (boardId, box) => {
      const newId = nanoid();
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const maxZ = board.boxes.reduce((m, b) => Math.max(m, b.zIndex), 0);
        board.boxes.push({ ...box, id: newId, boardId, zIndex: maxZ + 1 });
      });
      return newId;
    },

    removeBox: (boardId, boxId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (board) board.boxes = board.boxes.filter((b) => b.id !== boxId);
        if (s.selectedBoxId === boxId) s.selectedBoxId = null;
        if (s.expandedBoxId === boxId) s.expandedBoxId = null;
      }),

    updateBox: (boardId, boxId, patch) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (box) Object.assign(box, patch);
      }),

    moveBox: (boardId, boxId, x, y) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (box) { box.x = x; box.y = y; }
      }),

    resizeBox: (boardId, boxId, width, height) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (box) { box.width = width; box.height = height; }
      }),

    updateBoxStyle: (boardId, boxId, style) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (box) Object.assign(box.style, style);
      }),

    bringToFront: (boardId, boxId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const maxZ = board.boxes.reduce((m, b) => Math.max(m, b.zIndex), 0);
        const box = board.boxes.find((b) => b.id === boxId);
        if (box) box.zIndex = maxZ + 1;
      }),

    addItem: (boardId, boxId, item) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (!box) return;
        box.items.push({ ...item, id: nanoid() });
      }),

    removeItem: (boardId, boxId, itemId) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (box) box.items = box.items.filter((i) => i.id !== itemId);
      }),

    updateItem: (boardId, boxId, itemId, patch) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        const item = box?.items.find((i) => i.id === itemId);
        if (item) Object.assign(item, patch);
      }),

    moveItemUp: (boardId, boxId, itemId) =>
      set((s) => {
        const items = findBox(s.boards, boardId, boxId)?.items;
        if (!items) return;
        const i = items.findIndex((x) => x.id === itemId);
        if (i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
      }),

    moveItemDown: (boardId, boxId, itemId) =>
      set((s) => {
        const items = findBox(s.boards, boardId, boxId)?.items;
        if (!items) return;
        const i = items.findIndex((x) => x.id === itemId);
        if (i < items.length - 1) [items[i], items[i + 1]] = [items[i + 1], items[i]];
      }),

    toggleItemInCollapsed: (boardId, boxId, itemId) =>
      set((s) => {
        const item = findBox(s.boards, boardId, boxId)?.items.find((i) => i.id === itemId);
        if (item) item.showInCollapsed = !item.showInCollapsed;
      }),

    moveExpandedItem: (boardId, boxId, itemId, x, y) =>
      set((s) => {
        const item = findBox(s.boards, boardId, boxId)?.items.find((i) => i.id === itemId);
        if (item) { item.expandedX = x; item.expandedY = y; }
      }),

    resizeExpandedItem: (boardId, boxId, itemId, w, h) =>
      set((s) => {
        const item = findBox(s.boards, boardId, boxId)?.items.find((i) => i.id === itemId);
        if (item) { item.expandedW = w; item.expandedH = h; }
      }),

    selectBox: (id) => set((s) => { s.selectedBoxId = id; }),
    setExpandedBox: (id) => set((s) => { s.expandedBoxId = id; }),
    setDraggingBlock: (id) => set((s) => { s.draggingBlockId = id; }),

    toggleGrid: () => set((s) => { s.showGrid = !s.showGrid; }),
    toggleRuler: () => set((s) => { s.showRuler = !s.showRuler; }),
    setZoom: (z) => set((s) => { s.zoom = z; }),

    setThemeVars: (vars) => {
      // App-level theme only — applies to document root (sidebar, panels, etc.)
      // Board theme is scoped separately via inline CSS vars on the board area div.
      applyThemeVars(vars);
      if (typeof window !== "undefined")
        localStorage.setItem("plancraft-theme-vars", JSON.stringify(vars));
      set((s) => { s.themeVars = vars; });
    },

    setBoardTheme: (boardId, vars) =>
      set((s) => {
        const b = s.boards.find((b) => b.id === boardId);
        if (b) b.boardThemeVars = vars;
      }),

    clearBoardTheme: (boardId) =>
      set((s) => {
        const b = s.boards.find((b) => b.id === boardId);
        if (b) delete b.boardThemeVars;
      }),

    saveCurrentTheme: (name, vars) => {
      const id = nanoid(8);
      set((s) => { s.savedThemes.push({ id, name, vars: { ...vars } }); });
      if (typeof window !== "undefined")
        localStorage.setItem("plancraft-saved-themes", JSON.stringify(get().savedThemes));
    },

    deleteSavedTheme: (id) => {
      set((s) => { s.savedThemes = s.savedThemes.filter((t) => t.id !== id); });
      if (typeof window !== "undefined")
        localStorage.setItem("plancraft-saved-themes", JSON.stringify(get().savedThemes));
    },

    setAppFont: (name) => {
      applyAppFont(name);
      if (typeof window !== "undefined")
        localStorage.setItem("plancraft-app-font", name);
      set((s) => { s.appFont = name; });
    },

    setAppBg: (patch) => {
      // Spread → new reference → guaranteed re-render for all subscribers
      set((s) => { s.appBg = { ...s.appBg, ...patch }; });
      if (typeof window !== "undefined")
        localStorage.setItem("plancraft-app-bg", JSON.stringify(get().appBg));
    },

    addUserFont: (font) => set((s) => {
      if (!s.userFonts.find((f) => f.name === font.name)) s.userFonts.push(font);
    }),
    removeUserFont: (name) => set((s) => { s.userFonts = s.userFonts.filter((f) => f.name !== name); }),
  }))
);

// Apply app-level appearance on module load (client only).
// Board theme vars are scoped via inline styles on the board area div — never applied here.
if (typeof window !== "undefined") {
  const state = useBoardStore.getState();
  applyThemeVars(state.themeVars);
  applyAppFont(state.appFont);
}

export const useActiveBoard = () =>
  useBoardStore((s) => s.boards.find((b) => b.id === s.activeBoardId)!);
