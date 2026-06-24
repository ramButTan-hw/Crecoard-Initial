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
  | "image" | "graph" | "api" | "calendar" | "table" | "divider" | "widget"
  | "playlist";

export type FilterOp =
  | "contains" | "not_contains"
  | "equals"   | "not_equals"
  | "is_empty" | "is_not_empty"
  | "gt" | "lt";

export interface TableFilter {
  id: string;
  colId: string;
  op: FilterOp;
  value: string;
}

export interface TableColumn {
  id: string;
  name: string;
  type: "text" | "number" | "checkbox" | "select" | "date" | "url";
  width?: number;
  options?: string[];
}

export interface TableRow {
  id: string;
  cells: Record<string, string | boolean>;
}

export interface CalendarEvent {
  id: string;
  date: string;       // YYYY-MM-DD
  title: string;
  color?: string;
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  description?: string;
  allDay?: boolean;
  feedId?: string;    // from iCal feed (read-only)
  location?: string;
}

export interface CalendarFeed {
  id: string;
  name: string;
  url: string;
  color: string;
  enabled: boolean;
}

export interface TableLink {
  id: string;         // link config id
  tableId: string;    // item id of the table in the same box
  dateCol: string;    // column id used as event date
  titleCol: string;   // column id used as event title
  colorCol?: string;  // column id used as event color (optional)
  color?: string;     // fallback accent color for events from this link
}

export interface PlaylistTrack {
  id: string;
  url: string;
  title: string;
}

export interface ListEntry {
  id: string;
  text: string;
  checked: boolean;
  isVariable?: boolean;
  variableName?: string;
  variableValue?: number;   // legacy plain number
  variableRawValue?: string; // formula string like "{x} + 5" or "10"
}
export interface GraphPoint { label: string; [key: string]: string | number }

export interface BlockItem {
  id: string;
  type: ItemType;
  showInCollapsed: boolean;

  // Layout inside expanded canvas
  expandedX?: number;
  expandedY?: number;
  expandedW?: number;
  expandedH?: number;

  // Layout inside collapsed view (absolute positioning)
  collapsedX?: number;
  collapsedY?: number;
  collapsedW?: number;
  collapsedH?: number;

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
  textPadding?: number;
  textLetterSpacing?: number;
  textLineHeight?: number;
  textShadow?: "none" | "drop" | "glow" | "neon" | "hard";
  textShadowColor?: string;

  // list
  listTitle?: string;
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
  listBgColor?: string;
  listPadding?: number;
  listShadow?: "none" | "drop" | "glow" | "hard";
  listShadowColor?: string;
  listLetterSpacing?: number;
  listLineHeight?: number;
  listDividerColor?: string;
  listDividerOpacity?: number;
  listDividerWidth?: number;
  listDividerStyle?: "solid" | "dashed" | "dotted" | "none";
  listCheckColor?: string;
  listCheckUncheckedIcon?: string;
  listCheckCheckedIcon?: string;
  listCheckIconSize?: number;
  listVarValueFontFamily?: string;
  listVarValueFontSize?: number;
  listVarValueFontColor?: string;
  listVarValueBold?: boolean;
  listShowProgress?: boolean;

  // variable
  varName?: string;
  varFormula?: string;

  // text paragraph style (Google Docs-style preset)
  textParaStyle?: string;

  // text modes: undefined = normal text, "number" = big number input (variable source), "formula" = shows computed result
  textMode?: "number" | "formula";
  textVarName?: string;     // variable name exposed for both number-mode and formula-mode items
  textCalcFormula?: string; // formula expression when textMode === "formula"

  // embed
  embedUrl?: string;
  embedBorderRadius?: number;
  embedBorderWidth?: number;
  embedBorderColor?: string;
  embedBorderStyle?: "solid" | "dashed" | "dotted" | "double" | "glow";
  embedFilterBrightness?: number;
  embedFilterContrast?: number;
  embedFilterSaturate?: number;
  embedFilterGrayscale?: number;
  embedFilterBlur?: number;
  embedFilterHueRotate?: number;
  embedFilterSepia?: number;
  embedShadow?: "none" | "sm" | "md" | "lg" | "glow";

  // timer
  timerSeconds?: number;
  timerLabel?: string;
  timerMode?: "countdown" | "stopwatch" | "clock";
  timerFontFamily?: string;
  timerFontSize?: number;
  timerFontColor?: string;
  timerAccentColor?: string;
  timerBold?: boolean;
  timerShowLabel?: boolean;
  timerLabelPosition?: "top" | "bottom";
  timerBgColor?: string;
  timerBgOpacity?: number;
  timerBgImage?: string;
  timerBgImageSize?: string;
  timerBgImageOpacity?: number;
  timerBorderWidth?: number;
  timerBorderColor?: string;
  timerBorderRadius?: number;
  timerBorderStyle?: "solid" | "dashed" | "dotted" | "glow";
  timerFormat24h?: boolean;
  timerShowSeconds?: boolean;
  timerShowDate?: boolean;
  // timer — pomodoro cycle
  timerPomodoroEnabled?: boolean;
  timerPomodoroWorkSecs?: number;
  timerPomodoroBreakSecs?: number;
  timerPomodoroLongBreakSecs?: number;
  timerPomodoroCyclesBeforeLongBreak?: number;
  timerCollabEnabled?: boolean;
  timerProgressStyle?: "none" | "bar" | "thick-bar" | "ring" | "bg-fill" | "bg-dim" | "bg-sweep";
  timerProgressDir?: "ltr" | "rtl" | "ttb" | "btt"; // direction for bg-fill / bg-sweep
  timerProgressColor?: string; // override accent for progress elements
  timerVarName?: string;       // export elapsed/remaining as a named variable
  timerElapsedSecs?: number;   // last-synced elapsed seconds (stopwatch / pomodoro)
  timerRemainingSecs?: number; // last-synced remaining seconds (countdown mode)

  // playlist
  playlistTracks?: PlaylistTrack[];
  playlistCurrentIndex?: number;
  playlistTitle?: string;
  playlistLoop?: boolean;
  playlistAutoplay?: boolean;
  playlistShuffle?: boolean;
  playlistVolume?: number;        // 0–100
  playlistShowList?: boolean;     // default true
  playlistCompact?: boolean;      // kept for compat; prefer playlistLayout
  playlistLayout?: "stack" | "card" | "side" | "minimal" | "artwork";
  playlistBgColor?: string;
  playlistBgOpacity?: number;     // 0–100, default 100
  playlistBgBlur?: number;        // backdrop-filter blur px, default 0
  playlistBgGradient?: boolean;
  playlistBgGradientTo?: string;
  playlistBgGradientAngle?: number;
  playlistBgImage?: string;
  playlistBgImageOpacity?: number; // 0–100, default 100
  playlistAccentColor?: string;
  playlistBorderRadius?: number;
  playlistBorderWidth?: number;
  playlistBorderColor?: string;

  // image
  imageUrl?: string;
  imageObjectFit?: "cover" | "contain" | "fill";

  // graph
  graphType?: "bar" | "bar-h" | "bar-stacked" | "line" | "multiline" | "area" | "area-stacked" | "pie" | "donut" | "scatter" | "radar";
  graphData?: GraphPoint[];
  graphSeriesKeys?: string[];
  graphTitle?: string;
  graphColors?: string[];
  graphShowGrid?: boolean;
  graphShowLegend?: boolean;
  graphSmooth?: boolean;
  // graph appearance
  graphBgColor?: string;
  graphBgOpacity?: number;
  graphBgImage?: string;
  graphBgImageSize?: string;
  graphBgImageOpacity?: number;
  graphFontFamily?: string;
  graphFontSize?: number;
  graphFontColor?: string;
  graphBarRadius?: number;
  graphStrokeWidth?: number;
  graphListSourceItemId?: string;  // derives data from a list item's variable entries

  // embedded chart in table item
  tableChartEnabled?: boolean;
  tableChartType?: string;
  tableChartLabelColId?: string;
  tableChartValueColIds?: string[];
  tableChartSplitRatio?: number;   // 0–1 fraction that table occupies
  tableChartColors?: string[];
  tableChartShowGrid?: boolean;
  tableChartShowLegend?: boolean;
  tableChartShowDataLabels?: boolean;
  tableChartSmooth?: boolean;
  tableChartBarRadius?: number;
  tableChartStrokeWidth?: number;
  tableChartTitle?: string;
  tableChartXAxisTitle?: string;
  tableChartYAxisTitle?: string;
  tableChartBgColor?: string;
  tableChartFontFamily?: string;
  tableChartFontSize?: number;
  tableChartFontColor?: string;

  // graph item linked to a table item (extracted chart)
  graphTableSourceItemId?: string;
  graphTableLabelColId?: string;
  graphTableValueColIds?: string[];

  // api
  apiUrl?: string;
  apiMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  apiHeaders?: string;
  apiBody?: string;
  apiAuthType?: "none" | "bearer" | "apikey" | "basic";
  apiAuthHeader?: string;
  apiAuthValue?: string;
  apiAuthUser?: string;
  apiResponsePath?: string;
  apiDisplayMode?: "value" | "json" | "table";
  apiRefreshInterval?: number;
  apiLabel?: string;
  apiVarName?: string;    // export the resolved value as this variable name
  apiCachedValue?: number; // numeric value at apiResponsePath, updated on each successful fetch

  // calendar
  calendarEvents?: CalendarEvent[];
  calendarFeeds?: CalendarFeed[];
  calendarFeedEvents?: CalendarEvent[]; // cached from feeds
  calendarView?: "month" | "week" | "agenda";
  calendarFirstDayMonday?: boolean;
  calendarAccentColor?: string;
  calendarShowWeekends?: boolean;
  calendarShowDeclined?: boolean;
  calendarFontFamily?: string;
  calendarFontSize?: number;
  calendarFontColor?: string;
  calendarBgColor?: string;
  calendarBgOpacity?: number;
  calendarBgImage?: string;
  calendarBgImageSize?: string;
  calendarBgImageOpacity?: number;
  calendarBorderRadius?: number;
  calendarCellBgColor?: string;
  calendarCellBgImage?: string;
  calendarCellBgImageSize?: string;
  calendarCellBgImageOpacity?: number;
  calendarWeekendBgColor?: string;
  calendarWeekendBgImage?: string;
  calendarWeekendBgImageSize?: string;
  calendarWeekendBgImageOpacity?: number;
  calendarTodayColor?: string;
  calendarHeaderBgColor?: string;
  calendarHeaderBgImage?: string;
  calendarLinkedTables?: TableLink[]; // multiple table→calendar links
  // legacy single-link fields (kept for migration)
  calendarLinkedTableId?: string;
  calendarLinkedDateCol?: string;
  calendarLinkedTitleCol?: string;
  calendarLinkedColorCol?: string;
  calendarHeaderBgImageSize?: string;
  calendarHeaderBgImageOpacity?: number;

  // table
  tableTitle?: string;
  tableShowTitle?: boolean;
  tableColumns?: TableColumn[];
  tableRows?: TableRow[];
  tableStriped?: boolean;
  tableHeaderColor?: string;
  tableFontFamily?: string;
  tableFontSize?: number;
  tableFontColor?: string;
  tableHeaderFontColor?: string;
  tableCellBgColor?: string;
  tableStripedColor?: string;
  tableBorderColor?: string;
  tableBorderWidth?: number;
  tableBorderRadius?: number;
  tableBgColor?: string;
  tableBgOpacity?: number;
  tableBgImage?: string;
  tableBgImageSize?: string;
  tableBgImageOpacity?: number;
  tableRowHeight?: number;
  tableCollabEnabled?: boolean;

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
  // Deck (slideshow) container
  isDeck?: boolean;
  deckSlideIds?: string[];   // ordered IDs of slide boxes
  deckFocusIndex?: number;   // which slide is center
  // Deck appearance & behaviour
  deckTransition?: "slide" | "fade" | "scale" | "flip";
  deckLayout?: "centered" | "flat" | "stack";  // visual layout style
  deckAutoPlay?: boolean;        // default true
  deckAutoPlayMs?: number;       // default 3500
  deckShowArrows?: boolean;      // default true
  deckShowDots?: boolean;        // default true
  deckShowPeek?: boolean;        // show adjacent slides (default true)
  deckPeekScale?: number;        // adjacent slide scale  (default 0.82)
  deckPeekOpacity?: number;      // adjacent slide opacity (default 0.5)
  deckPeekBlur?: boolean;        // blur adjacent slides
  // Slide membership — set when this box is owned by a deck
  deckOwnerId?: string;
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
  collabEnabled?: boolean;
  boxes: Box[];
  createdAt: number;
  updatedAt: number;
}

// ─── Variable evaluator ───────────────────────────────────────────────────────

export function resolveVars(items: BlockItem[]): Record<string, number> {
  const vars: Record<string, number> = {};

  // Pass 1: direct (non-formula) sources — plain list entry values + text number-mode items
  for (const item of items) {
    if (item.type === "list") {
      for (const entry of item.listItems ?? []) {
        if (entry.isVariable && entry.variableName?.trim() && !entry.variableRawValue?.trim()) {
          vars[entry.variableName.trim()] = entry.variableValue ?? 0;
        }
      }
    }
    if (item.type === "text" && item.textMode === "number" && item.textVarName?.trim()) {
      vars[item.textVarName.trim()] = Number(item.text ?? "0") || 0;
    }
    if (item.type === "timer" && item.timerVarName?.trim() && item.timerElapsedSecs !== undefined) {
      vars[item.timerVarName.trim()] = item.timerElapsedSecs;
      const remainKey = `${item.timerVarName.trim()}_remaining`;
      if (item.timerRemainingSecs !== undefined) vars[remainKey] = item.timerRemainingSecs;
    }
    if (item.type === "api" && item.apiVarName?.trim() && item.apiCachedValue !== undefined) {
      vars[item.apiVarName.trim()] = item.apiCachedValue;
    }
  }

  // Pass 2+: single dependency-aware loop for everything formula-based
  const pending: Array<{ name: string; formula: string }> = [];
  for (const item of items) {
    if (item.type === "list") {
      for (const entry of item.listItems ?? []) {
        if (entry.isVariable && entry.variableName?.trim() && entry.variableRawValue?.trim()) {
          pending.push({ name: entry.variableName.trim(), formula: entry.variableRawValue.trim() });
        }
      }
    }
    if (item.type === "text" && item.textMode === "formula" && item.textVarName?.trim() && item.textCalcFormula) {
      pending.push({ name: item.textVarName.trim(), formula: item.textCalcFormula });
    }
    if (item.type === "variable" && item.varName) {
      pending.push({ name: item.varName, formula: item.varFormula ?? "0" });
    }
  }

  const unresolved = new Set(pending.map((p) => p.name));
  for (let pass = 0; pass < pending.length + 1; pass++) {
    let progress = false;
    for (const { name, formula } of pending) {
      if (!unresolved.has(name)) continue;
      const result = evalVarFormula(formula, vars);
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
  createBoardFromTemplate: (template: import("@/lib/communityTemplates").CommunityBoard) => void;
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
  sendToBack: (boardId: string, boxId: string) => void;
  duplicateBox: (boardId: string, boxId: string) => void;
  copiedBox: Box | null;
  copyBox: (boardId: string, boxId: string) => void;
  pasteBox: (boardId: string, x: number, y: number) => void;
  // Deck actions
  createDeck: (boardId: string, draggedBoxId: string, targetBoxId: string) => void;
  addToDeck: (boardId: string, deckId: string, boxId: string) => void;
  setDeckFocus: (boardId: string, deckId: string, index: number) => void;
  ejectSlide: (boardId: string, deckId: string, slideIndex: number) => void;
  disbandDeck: (boardId: string, deckId: string) => void;

  // Items inside blocks
  addItem: (boardId: string, boxId: string, item: Omit<BlockItem, "id">) => void;
  removeItem: (boardId: string, boxId: string, itemId: string) => void;
  updateItem: (boardId: string, boxId: string, itemId: string, patch: Partial<BlockItem>) => void;
  moveItemUp: (boardId: string, boxId: string, itemId: string) => void;
  moveItemDown: (boardId: string, boxId: string, itemId: string) => void;
  toggleItemInCollapsed: (boardId: string, boxId: string, itemId: string) => void;
  moveExpandedItem: (boardId: string, boxId: string, itemId: string, x: number, y: number) => void;
  resizeExpandedItem: (boardId: string, boxId: string, itemId: string, w: number, h: number) => void;
  duplicateItem: (boardId: string, boxId: string, itemId: string) => void;
  resetItemLayout: (boardId: string, boxId: string, itemId: string) => void;
  moveCollapsedItem: (boardId: string, boxId: string, itemId: string, x: number, y: number) => void;
  resizeCollapsedItem: (boardId: string, boxId: string, itemId: string, w: number, h: number) => void;

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

  // Board persistence
  persistBoards: () => void;
  hydrateBoards: () => void;
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
    copiedBox: null,
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

    createBoardFromTemplate: (template) =>
      set((s) => {
        const boardId = nanoid();
        const board: Board = {
          ...makeDefaultBoard(template.name),
          id: boardId,
          backgroundColor: template.boardData.backgroundColor ?? "#1a1b1e",
          boxes: template.boardData.boxes.map((tBox, i) => ({
            id: nanoid(),
            boardId,
            x: tBox.x,
            y: tBox.y,
            width: tBox.width,
            height: tBox.height,
            zIndex: i + 1,
            locked: false,
            title: tBox.title,
            isExpanded: false,
            style: { ...DEFAULT_BOX_STYLE, ...(tBox.style ?? {}) },
            items: tBox.items.map((item) => ({
              ...item,
              id: nanoid(),
              showInCollapsed: false,
            })),
          })),
        };
        s.boards.push(board);
        s.activeBoardId = boardId;
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

    sendToBack: (boardId, boxId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const minZ = board.boxes.reduce((m, b) => Math.min(m, b.zIndex), Infinity);
        const box = board.boxes.find((b) => b.id === boxId);
        if (box) box.zIndex = minZ > 0 ? minZ - 1 : 0;
      }),

    duplicateBox: (boardId, boxId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const box = board.boxes.find((b) => b.id === boxId);
        if (!box) return;
        const maxZ = board.boxes.reduce((m, b) => Math.max(m, b.zIndex), 0);
        const clone: Box = JSON.parse(JSON.stringify(box));
        clone.id = nanoid();
        clone.x = box.x + 24;
        clone.y = box.y + 24;
        clone.zIndex = maxZ + 1;
        clone.title = box.title ? box.title + " (copy)" : "";
        clone.items = clone.items.map((item) => ({ ...item, id: nanoid() }));
        board.boxes.push(clone);
        s.selectedBoxId = clone.id;
      }),

    copyBox: (boardId, boxId) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (box) s.copiedBox = JSON.parse(JSON.stringify(box));
      }),

    pasteBox: (boardId, x, y) =>
      set((s) => {
        if (!s.copiedBox) return;
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const maxZ = board.boxes.reduce((m, b) => Math.max(m, b.zIndex), 0);
        const clone: Box = JSON.parse(JSON.stringify(s.copiedBox));
        clone.id = nanoid();
        clone.x = x;
        clone.y = y;
        clone.zIndex = maxZ + 1;
        clone.title = clone.title ? clone.title + " (copy)" : "";
        clone.items = clone.items.map((item) => ({ ...item, id: nanoid() }));
        board.boxes.push(clone);
        s.selectedBoxId = clone.id;
      }),

    createDeck: (boardId, draggedBoxId, targetBoxId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const dragged = board.boxes.find((b) => b.id === draggedBoxId);
        const target = board.boxes.find((b) => b.id === targetBoxId);
        if (!dragged || !target) return;
        const deckId = nanoid();
        const maxZ = board.boxes.reduce((m, b) => Math.max(m, b.zIndex), 0);
        const w = Math.max(dragged.width, target.width, 320);
        const h = Math.max(dragged.height, target.height, 220);
        // Mark both boxes as deck-owned
        dragged.deckOwnerId = deckId;
        target.deckOwnerId = deckId;
        // Insert deck container at target's position
        board.boxes.push({
          id: deckId, boardId,
          x: target.x, y: target.y,
          width: w, height: h,
          zIndex: maxZ + 1,
          locked: false,
          title: "",
          isExpanded: false,
          items: [],
          style: { ...DEFAULT_BOX_STYLE },
          isDeck: true,
          deckSlideIds: [targetBoxId, draggedBoxId],
          deckFocusIndex: 0,
        });
      }),

    addToDeck: (boardId, deckId, boxId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const deck = board.boxes.find((b) => b.id === deckId);
        const box = board.boxes.find((b) => b.id === boxId);
        if (!deck || !box || !deck.isDeck) return;
        box.deckOwnerId = deckId;
        deck.deckSlideIds = [...(deck.deckSlideIds ?? []), boxId];
        deck.deckFocusIndex = (deck.deckSlideIds.length) - 1;
      }),

    setDeckFocus: (boardId, deckId, index) =>
      set((s) => {
        const deck = findBox(s.boards, boardId, deckId);
        if (deck?.isDeck) deck.deckFocusIndex = index;
      }),

    ejectSlide: (boardId, deckId, slideIndex) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const deck = board.boxes.find((b) => b.id === deckId);
        if (!deck?.isDeck || !deck.deckSlideIds) return;
        const slideId = deck.deckSlideIds[slideIndex];
        const slide = board.boxes.find((b) => b.id === slideId);
        if (slide) {
          slide.deckOwnerId = undefined;
          slide.x = deck.x + slideIndex * 40;
          slide.y = deck.y + 40;
        }
        deck.deckSlideIds = deck.deckSlideIds.filter((_, i) => i !== slideIndex);
        deck.deckFocusIndex = Math.min(deck.deckFocusIndex ?? 0, Math.max(0, deck.deckSlideIds.length - 1));
        // If only 0 or 1 slides left, disband
        if (deck.deckSlideIds.length <= 1) {
          if (deck.deckSlideIds.length === 1) {
            const lastSlide = board.boxes.find((b) => b.id === deck.deckSlideIds![0]);
            if (lastSlide) { lastSlide.deckOwnerId = undefined; lastSlide.x = deck.x; lastSlide.y = deck.y; }
          }
          board.boxes = board.boxes.filter((b) => b.id !== deckId);
          if (s.selectedBoxId === deckId) s.selectedBoxId = null;
          if (s.expandedBoxId === deckId) s.expandedBoxId = null;
        }
      }),

    disbandDeck: (boardId, deckId) =>
      set((s) => {
        const board = s.boards.find((b) => b.id === boardId);
        if (!board) return;
        const deck = board.boxes.find((b) => b.id === deckId);
        if (!deck?.isDeck) return;
        (deck.deckSlideIds ?? []).forEach((sid, i) => {
          const slide = board.boxes.find((b) => b.id === sid);
          if (slide) { slide.deckOwnerId = undefined; slide.x = deck.x + i * 40; slide.y = deck.y + 40; }
        });
        board.boxes = board.boxes.filter((b) => b.id !== deckId);
        if (s.selectedBoxId === deckId) s.selectedBoxId = null;
        if (s.expandedBoxId === deckId) s.expandedBoxId = null;
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

    duplicateItem: (boardId, boxId, itemId) =>
      set((s) => {
        const box = findBox(s.boards, boardId, boxId);
        if (!box) return;
        const idx = box.items.findIndex((i) => i.id === itemId);
        if (idx < 0) return;
        const clone: BlockItem = JSON.parse(JSON.stringify(box.items[idx]));
        clone.id = nanoid();
        if (clone.expandedX !== undefined) clone.expandedX += 24;
        if (clone.expandedY !== undefined) clone.expandedY += 24;
        box.items.splice(idx + 1, 0, clone);
      }),

    resetItemLayout: (boardId, boxId, itemId) =>
      set((s) => {
        const item = findBox(s.boards, boardId, boxId)?.items.find((i) => i.id === itemId);
        if (item) { item.expandedX = undefined; item.expandedY = undefined; item.expandedW = undefined; item.expandedH = undefined; }
      }),

    moveCollapsedItem: (boardId, boxId, itemId, x, y) =>
      set((s) => {
        const item = findBox(s.boards, boardId, boxId)?.items.find((i) => i.id === itemId);
        if (item) { item.collapsedX = x; item.collapsedY = y; }
      }),

    resizeCollapsedItem: (boardId, boxId, itemId, w, h) =>
      set((s) => {
        const item = findBox(s.boards, boardId, boxId)?.items.find((i) => i.id === itemId);
        if (item) { item.collapsedW = w; item.collapsedH = h; }
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

    persistBoards: () => {
      try {
        const { boards, activeBoardId } = get();
        localStorage.setItem("plancraft-boards-v1", JSON.stringify({ boards, activeBoardId }));
      } catch { /* quota exceeded — ignore */ }
    },

    hydrateBoards: () => {
      try {
        const raw = localStorage.getItem("plancraft-boards-v1");
        if (!raw) return;
        const { boards, activeBoardId } = JSON.parse(raw) as { boards: Board[]; activeBoardId: string };
        if (!Array.isArray(boards) || boards.length === 0) return;
        set((s) => { s.boards = boards; s.activeBoardId = activeBoardId; });
      } catch { /* corrupt data — ignore */ }
    },
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
