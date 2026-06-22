"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check, Plus, Trash2, ExternalLink, Play, Pause, RotateCcw,
  Wifi, WifiOff, ImageIcon, Upload, X as XIcon,
} from "lucide-react";
import { WallpaperEditor } from "@/components/ui/WallpaperEditor";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { BlockItem, GameId, ListEntry, GraphPoint, useBoardStore, resolveVars } from "@/store/boardStore";
import { FontPicker } from "@/components/ui/FontPicker";
import { loadGoogleFont } from "@/lib/fonts";
import { DEFAULT_WIDGET_CODE } from "@/lib/defaultWidgetCode";
import { nanoid } from "nanoid";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#5865f2", "#48cfa6", "#f2994a", "#eb5757", "#9b51e0", "#2d9cdb"];

const GAME_META: Record<GameId, { name: string; color: string; bg: string; stats: { label: string; value: string }[]; detailStats: { label: string; value: string }[] }> = {
  valorant: {
    name: "Valorant", color: "#ff4655", bg: "#ff465512",
    stats: [{ label: "Rank", value: "Diamond 2" }, { label: "K/D", value: "1.42" }],
    detailStats: [{ label: "Win Rate", value: "54%" }, { label: "HS%", value: "28%" }, { label: "ACS", value: "234" }, { label: "Games", value: "182" }],
  },
  lol: {
    name: "League of Legends", color: "#c89b3c", bg: "#c89b3c12",
    stats: [{ label: "Rank", value: "Plat I" }, { label: "KDA", value: "3.2" }],
    detailStats: [{ label: "Win Rate", value: "51%" }, { label: "Main", value: "Mid" }, { label: "CS/min", value: "7.4" }, { label: "Games", value: "210" }],
  },
  apex: {
    name: "Apex Legends", color: "#da3b20", bg: "#da3b2012",
    stats: [{ label: "K/D", value: "1.8" }, { label: "Dmg/Game", value: "1240" }],
    detailStats: [{ label: "Win Rate", value: "7.2%" }, { label: "Level", value: "412" }, { label: "Kills", value: "3,820" }, { label: "Games", value: "820" }],
  },
  csgo: {
    name: "CS2", color: "#f5a623", bg: "#f5a62312",
    stats: [{ label: "Rating", value: "1.12" }, { label: "HS%", value: "46%" }],
    detailStats: [{ label: "K/D", value: "1.05" }, { label: "ADR", value: "78.4" }, { label: "KAST", value: "71%" }, { label: "Impact", value: "1.08" }],
  },
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ItemRendererProps {
  item: BlockItem;
  boardId: string;
  boxId: string;
  vars: Record<string, number>;
  collapsed?: boolean;
  isFinished?: boolean;
  /** Card pixel width — used for font auto-scaling */
  containerW?: number;
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function ItemRenderer({ item, boardId, boxId, vars, collapsed, isFinished, containerW }: ItemRendererProps) {
  const upd = (patch: Partial<BlockItem>) =>
    useBoardStore.getState().updateItem(boardId, boxId, item.id, patch);

  switch (item.type) {
    case "text":     return <TextItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} />;
    case "list":     return <ListItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} containerW={containerW} />;
    case "variable": return <VariableItem item={item} upd={upd} vars={vars} collapsed={collapsed} isFinished={isFinished} />;
    case "embed":    return <EmbedItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} />;
    case "timer":    return <TimerItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} />;
    case "image":    return <ImageItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} />;
    case "graph":    return <GraphItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} />;
    case "gaming":   return <GamingItem item={item} upd={upd} collapsed={collapsed} isFinished={isFinished} />;
    case "divider":  return <hr className="border-[var(--border)] my-1" />;
    case "widget":   return <WidgetItem item={item} upd={upd} vars={vars} collapsed={collapsed} isFinished={isFinished} />;
    default:         return null;
  }
}

// ─── Text ─────────────────────────────────────────────────────────────────────

const TEXT_BORDER_STYLES = [
  { id: "solid",  label: "Solid"  },
  { id: "dashed", label: "Dashed" },
  { id: "dotted", label: "Dotted" },
  { id: "double", label: "Double" },
  { id: "groove", label: "Groove" },
  { id: "ridge",  label: "Ridge"  },
  { id: "inset",  label: "Inset"  },
  { id: "outset", label: "Outset" },
  { id: "glow",   label: "Glow"   },
] as const;


function TextItem({ item, upd, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean }) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const bgImageFileRef = useRef<HTMLInputElement>(null);

  const hasBorder = (item.textBorderWidth ?? 0) > 0;
  const hasBg = !!(item.textBgColor || item.textBgImage);
  const isTextGlow = hasBorder && item.textBorderStyle === "glow";

  const textStyle: React.CSSProperties = {
    fontSize: item.fontSize ?? 16,
    fontWeight: item.bold ? 700 : 400,
    fontStyle: item.italic ? "italic" : "normal",
    textAlign: item.align ?? "left",
    fontFamily: item.fontFamily ?? "Inter",
    color: item.textColor || undefined,
    backgroundColor: item.textBgColor || "transparent",
    backgroundImage: item.textBgImage ? `url(${item.textBgImage})` : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    borderRadius: item.textBorderRadius ?? 0,
    border: hasBorder && !isTextGlow
      ? `${item.textBorderWidth}px ${item.textBorderStyle ?? "solid"} ${item.textBorderColor ?? "#ffffff"}`
      : "none",
    boxShadow: isTextGlow
      ? `0 0 ${(item.textBorderWidth ?? 1) * 5}px ${item.textBorderColor ?? "#ffffff"}, 0 0 ${(item.textBorderWidth ?? 1) * 12}px ${item.textBorderColor ?? "#ffffff"}55`
      : undefined,
    padding: hasBg || hasBorder ? 8 : 0,
    lineHeight: 1.5,
  };

  const handleBgImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => upd({ textBgImage: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (collapsed) {
    return (
      <p className="truncate" style={textStyle}>
        {item.text || <span className="opacity-40 italic" style={{ fontSize: 12 }}>Empty text</span>}
      </p>
    );
  }

  const showToolbar = (focused || hovered) && !isFinished;

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowWallpaper(false); }}
    >
      {/* Hidden file input for bg image */}
      <input ref={bgImageFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgImageFile} />

      {/* Floating toolbar */}
      {showToolbar && (
        <div
          className="absolute z-30 flex items-center gap-1 rounded-lg border border-[var(--border)] shadow-xl px-2 py-1.5"
          style={{ bottom: "calc(100% + 6px)", left: 0, background: "var(--surface-raised)", whiteSpace: "nowrap" }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {/* Font family */}
          <FontPicker
            compact
            value={item.fontFamily ?? "Inter"}
            onChange={(font) => {
              loadGoogleFont(font);
              upd({ fontFamily: font });
            }}
          />

          {/* Font size */}
          <input
            type="number" min={6} max={200}
            value={item.fontSize ?? 16}
            onChange={(e) => upd({ fontSize: Number(e.target.value) })}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-11 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--text-primary)] outline-none"
          />

          <Divider />

          <TBtn active={!!item.bold} onClick={() => upd({ bold: !item.bold })} title="Bold">
            <span className="font-bold text-xs">B</span>
          </TBtn>
          <TBtn active={!!item.italic} onClick={() => upd({ italic: !item.italic })} title="Italic">
            <span className="italic text-xs">I</span>
          </TBtn>

          <Divider />

          {(["left", "center", "right"] as const).map((a) => (
            <TBtn key={a} active={(item.align ?? "left") === a} onClick={() => upd({ align: a })} title={`Align ${a}`}>
              <span className="text-[9px] font-mono">{a[0].toUpperCase()}</span>
            </TBtn>
          ))}

          <Divider />

          {/* Text color */}
          <label className="flex items-center gap-1 cursor-pointer" title="Text color">
            <span className="text-[10px] font-bold" style={{ color: item.textColor || "var(--text-primary)", textDecoration: "underline 2px" }}>A</span>
            <input type="color" value={item.textColor ?? "#f2f2f2"} onChange={(e) => upd({ textColor: e.target.value })} className="h-4 w-4 cursor-pointer rounded-sm border-0 bg-transparent p-0 outline-none" />
          </label>

          {/* Background fill color */}
          <label className="flex items-center gap-1 cursor-pointer" title="Fill color">
            <span className="text-[10px] text-[var(--text-muted)]">Fill</span>
            <input type="color" value={item.textBgColor ?? "#1a1b1e"} onChange={(e) => upd({ textBgColor: e.target.value })} className="h-4 w-4 cursor-pointer rounded-sm border-0 bg-transparent p-0 outline-none" />
            {item.textBgColor && (
              <button onClick={() => upd({ textBgColor: "" })} className="text-[var(--text-muted)] hover:text-red-400 leading-none text-xs">×</button>
            )}
          </label>

          {/* Wallpaper image — popover */}
          <div className="relative">
            <TBtn
              active={!!item.textBgImage || showWallpaper}
              onClick={() => setShowWallpaper((v) => !v)}
              title="Background image"
            >
              <ImageIcon size={11} />
            </TBtn>

            {showWallpaper && (
              <div
                className="absolute top-full left-0 z-40 mt-1.5 w-60 rounded-xl border border-[var(--border)] shadow-2xl p-3 flex flex-col gap-2"
                style={{ background: "var(--surface-raised)" }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Background Image</span>
                  {item.textBgImage && (
                    <button onClick={() => upd({ textBgImage: "" })} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300 transition-colors">
                      <XIcon size={10} /> Clear
                    </button>
                  )}
                </div>

                {/* Preview */}
                {item.textBgImage && (
                  <div className="h-14 w-full rounded-lg border border-[var(--border)] overflow-hidden">
                    <div className="h-full w-full" style={{ backgroundImage: `url(${item.textBgImage})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  </div>
                )}

                {/* URL input */}
                <input
                  type="text"
                  placeholder="Paste image URL…"
                  value={item.textBgImage?.startsWith("data:") ? "" : (item.textBgImage ?? "")}
                  onChange={(e) => upd({ textBgImage: e.target.value || "" })}
                  className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] transition-colors"
                />

                {/* File upload */}
                <button
                  onClick={() => bgImageFileRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-2 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  <Upload size={12} /> Upload from file
                </button>
              </div>
            )}
          </div>

          <Divider />

          {/* Border toggle */}
          <TBtn
            active={hasBorder}
            onClick={() => upd({ textBorderWidth: hasBorder ? 0 : 1, textBorderColor: item.textBorderColor ?? "#ffffff", textBorderStyle: item.textBorderStyle ?? "solid" })}
            title="Toggle border"
          >
            <span className="text-[10px]">⬜</span>
          </TBtn>
          {hasBorder && (
            <>
              <input type="color" value={item.textBorderColor ?? "#ffffff"} onChange={(e) => upd({ textBorderColor: e.target.value })} className="h-4 w-4 cursor-pointer rounded-sm border-0 bg-transparent p-0 outline-none" title="Border color" />
              <input type="number" min={1} max={16} value={item.textBorderWidth ?? 1} onChange={(e) => upd({ textBorderWidth: Number(e.target.value) })} className="w-9 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--text-primary)] outline-none" title="Border width" />
              <Divider />
              {/* Inline border style picker */}
              {TEXT_BORDER_STYLES.map((bs) => {
                const bc = item.textBorderColor ?? "#ffffff";
                const bw = Math.max(1, Math.min(item.textBorderWidth ?? 1, 4));
                const isGlow = bs.id === "glow";
                return (
                  <button
                    key={bs.id}
                    onClick={() => upd({ textBorderStyle: bs.id as BlockItem["textBorderStyle"] })}
                    title={bs.label}
                    className={cn(
                      "flex items-center justify-center rounded px-1 py-0.5 transition-colors",
                      (item.textBorderStyle ?? "solid") === bs.id
                        ? "bg-[var(--accent)]/20 ring-1 ring-[var(--accent)]"
                        : "hover:bg-[var(--surface-overlay)]"
                    )}
                    style={{ minWidth: 28 }}
                  >
                    <div
                      className="w-5 rounded-sm"
                      style={{
                        height: 10,
                        border: isGlow ? "none" : `${bw}px ${bs.id} ${bc}`,
                        boxShadow: isGlow ? `0 0 4px 1px ${bc}` : undefined,
                      }}
                    />
                  </button>
                );
              })}
            </>
          )}

          {/* Corner radius */}
          <label className="flex items-center gap-1 cursor-pointer" title="Corner radius">
            <span className="text-[10px] text-[var(--text-muted)]">⌒</span>
            <input type="number" min={0} max={200} value={item.textBorderRadius ?? 0} onChange={(e) => upd({ textBorderRadius: Number(e.target.value) })} className="w-11 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--text-primary)] outline-none" />
            <span className="text-[9px] text-[var(--text-muted)]">px</span>
          </label>
        </div>
      )}

      {/* The text itself */}
      <textarea
        readOnly={isFinished}
        className="w-full h-full resize-none outline-none placeholder:opacity-30"
        placeholder="Click to type…"
        value={item.text ?? ""}
        style={{ ...textStyle, width: "100%", height: "100%", display: "block" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => upd({ text: e.target.value })}
      />
    </div>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-[var(--border)] mx-0.5 flex-shrink-0" />;
}

function TBtn({ children, active, onClick, title }: { children: React.ReactNode; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center justify-center gap-0.5 rounded px-1.5 py-0.5 transition-colors min-w-[22px]",
        active ? "bg-[var(--accent)]/25 text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-overlay)] hover:text-[var(--text-primary)]"
      )}
    >
      {children}
    </button>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const LIST_BORDER_STYLES = ["solid","dashed","dotted","double","groove","ridge","inset","outset"] as const;

export function ListStylePanel({ item, upd }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void }) {
  const hasBorder = (item.listBorderWidth ?? 0) > 0;
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => upd({ listWallpaperUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-4 p-3 text-xs">

      {/* Wallpaper */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Wallpaper</p>
        <input
          className="mb-1.5 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Paste image URL…"
          value={item.listWallpaperUrl?.startsWith("data:") ? "" : (item.listWallpaperUrl ?? "")}
          onChange={(e) => upd({ listWallpaperUrl: e.target.value || undefined })}
        />
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] py-1.5 text-xs text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          >
            <Upload size={11} /> Upload
          </button>
          {item.listWallpaperUrl && (
            <button onClick={() => upd({ listWallpaperUrl: undefined })} className="rounded border border-[var(--border)] px-2.5 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">Clear</button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        {item.listWallpaperUrl && (
          <WallpaperEditor
            url={item.listWallpaperUrl}
            size={item.listWallpaperSize ?? "cover"}
            position={item.listWallpaperPosition ?? "center"}
            opacity={item.listWallpaperOpacity ?? 1}
            onSizeChange={(v) => upd({ listWallpaperSize: v })}
            onPositionChange={(v) => upd({ listWallpaperPosition: v })}
            onOpacityChange={(v) => upd({ listWallpaperOpacity: v })}
          />
        )}
      </div>

      {/* Font */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Font</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <FontPicker
              compact
              value={item.listFontFamily ?? "Inter"}
              onChange={(font) => { loadGoogleFont(font); upd({ listFontFamily: font }); }}
            />
            <input
              type="number" min={8} max={72}
              value={item.listFontSize ?? 14}
              onChange={(e) => upd({ listFontSize: Number(e.target.value) })}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              disabled={!!item.listFontAutoScale}
              className="w-14 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none disabled:opacity-40"
              title="Font size"
            />
            <span className="text-[10px] text-[var(--text-muted)]">px</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-[var(--border)] px-2.5 py-2 hover:border-[var(--text-muted)] transition-colors select-none">
            <input type="checkbox" checked={!!item.listFontAutoScale} onChange={(e) => upd({ listFontAutoScale: e.target.checked })} className="accent-[var(--accent)]" />
            <span className="flex-1 text-[var(--text-secondary)]">Scale with card size</span>
            <span className="text-[10px] text-[var(--text-muted)]">auto</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 cursor-pointer hover:border-[var(--text-muted)] transition-colors">
            <span className="relative h-5 w-5 flex-shrink-0 rounded border border-white/15 overflow-hidden" style={{ backgroundColor: item.listFontColor ?? "#f2f2f2" }}>
              <input type="color" value={item.listFontColor ?? "#f2f2f2"} onChange={(e) => upd({ listFontColor: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </span>
            <span className="flex-1 text-[var(--text-secondary)]">Text color</span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">{item.listFontColor ?? "default"}</span>
          </label>
        </div>
      </div>

      {/* Marker */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Marker style</p>
        <div className="flex gap-1.5">
          {([
            { id: "checkbox", icon: "☑", label: "Check" },
            { id: "bullet",   icon: "•", label: "Bullet" },
            { id: "number",   icon: "1.", label: "Number" },
            { id: "none",     icon: "—", label: "None" },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => upd({ listMarker: m.id })}
              className={cn(
                "flex-1 rounded-lg border py-1.5 flex flex-col items-center gap-0.5 transition-colors",
                (item.listMarker ?? "checkbox") === m.id
                  ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              )}
            >
              <span className="text-sm">{m.icon}</span>
              <span className="text-[9px]">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Border */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Border</p>
          <button
            onClick={() => upd({ listBorderWidth: hasBorder ? 0 : 1, listBorderColor: item.listBorderColor ?? "#ffffff", listBorderStyle: "solid" })}
            className={cn("rounded px-2 py-0.5 text-[10px] transition-colors border", hasBorder ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--text-muted)]")}
          >
            {hasBorder ? "On" : "Off"}
          </button>
        </div>
        {hasBorder && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 flex-1 rounded-lg border border-[var(--border)] px-2.5 py-2 cursor-pointer hover:border-[var(--text-muted)] transition-colors">
                <span className="relative h-5 w-5 flex-shrink-0 rounded border border-white/15 overflow-hidden" style={{ backgroundColor: item.listBorderColor ?? "#ffffff" }}>
                  <input type="color" value={item.listBorderColor ?? "#ffffff"} onChange={(e) => upd({ listBorderColor: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
                <span className="text-[var(--text-secondary)]">Color</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--text-muted)]">W</span>
                <input type="number" min={1} max={16} value={item.listBorderWidth ?? 1} onChange={(e) => upd({ listBorderWidth: Number(e.target.value) })} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="w-12 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-[var(--text-muted)]">R</span>
                <input type="number" min={0} max={200} value={item.listBorderRadius ?? 0} onChange={(e) => upd({ listBorderRadius: Number(e.target.value) })} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} className="w-12 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text-primary)] outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {LIST_BORDER_STYLES.map((bs) => {
                const bc = item.listBorderColor ?? "#ffffff";
                const bw = Math.max(1, Math.min(item.listBorderWidth ?? 1, 3));
                return (
                  <button
                    key={bs}
                    onClick={() => upd({ listBorderStyle: bs })}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-1.5 transition-all",
                      (item.listBorderStyle ?? "solid") === bs ? "bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]" : "hover:bg-[var(--surface-overlay)]"
                    )}
                  >
                    <div className="w-full rounded-sm" style={{ height: 10, border: `${bw}px ${bs} ${bc}` }} />
                    <span className={cn("text-[9px]", (item.listBorderStyle ?? "solid") === bs ? "text-[var(--accent)]" : "text-[var(--text-muted)]")}>{bs}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Row spacing */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Row spacing</p>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={24} step={1} value={item.listRowSpacing ?? 4} onChange={(e) => upd({ listRowSpacing: Number(e.target.value) })} className="flex-1 accent-[var(--accent)]" />
          <span className="w-8 text-right text-[var(--text-muted)]">{item.listRowSpacing ?? 4}px</span>
        </div>
      </div>
    </div>
  );
}

function ListItem({ item, upd, collapsed, isFinished, containerW }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean; containerW?: number }) {
  const entries = item.listItems ?? [];
  const shown = collapsed ? entries.slice(0, 4) : entries;
  const marker = item.listMarker ?? "checkbox";
  const hasBorder = (item.listBorderWidth ?? 0) > 0;

  const setEntries = (next: ListEntry[]) => upd({ listItems: next });

  const autoFontSize = item.listFontAutoScale && containerW
    ? Math.max(9, Math.round(containerW * 0.036))
    : undefined;

  const containerStyle: React.CSSProperties = {
    fontFamily: item.listFontFamily ?? "inherit",
    fontSize: autoFontSize ? `${autoFontSize}px` : (item.listFontSize ? `${item.listFontSize}px` : undefined),
    color: item.listFontColor || undefined,
    border: hasBorder ? `${item.listBorderWidth}px ${item.listBorderStyle ?? "solid"} ${item.listBorderColor ?? "#ffffff"}` : undefined,
    borderRadius: item.listBorderRadius ?? 0,
    padding: hasBorder ? 8 : 0,
    gap: item.listRowSpacing ?? 4,
    position: "relative",
  };

  return (
    <div className="flex flex-col" style={containerStyle}>
      {/* Wallpaper layer */}
      {item.listWallpaperUrl && (
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, borderRadius: item.listBorderRadius ?? 0,
          backgroundImage: `url(${item.listWallpaperUrl})`,
          backgroundSize: item.listWallpaperSize ?? "cover",
          backgroundPosition: item.listWallpaperPosition ?? "center",
          backgroundRepeat: "no-repeat",
          opacity: item.listWallpaperOpacity ?? 1,
        }} />
      )}
      {shown.map((entry, i) => (
        <div key={entry.id} className="flex items-center gap-2 group/le" style={{ position: "relative", zIndex: 1 }}>
          {marker === "checkbox" && (
            <button
              onClick={() => !isFinished && setEntries(entries.map((e) => e.id === entry.id ? { ...e, checked: !e.checked } : e))}
              className={cn("flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors", entry.checked ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--accent)]")}
            >
              {entry.checked && <Check size={10} className="text-white" />}
            </button>
          )}
          {marker === "bullet" && (
            <span className="w-4 flex-shrink-0 text-center" style={{ color: item.listFontColor || "var(--text-muted)" }}>•</span>
          )}
          {marker === "number" && (
            <span className="w-5 flex-shrink-0 text-right text-xs" style={{ color: item.listFontColor || "var(--text-muted)" }}>{i + 1}.</span>
          )}

          {isFinished || collapsed ? (
            <span className={cn("flex-1 text-sm", entry.checked && marker === "checkbox" && "line-through opacity-40")}>{entry.text}</span>
          ) : (
            <input
              className={cn("flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]", entry.checked && marker === "checkbox" && "line-through opacity-40")}
              placeholder="List item…"
              value={entry.text}
              onChange={(e) => setEntries(entries.map((x) => x.id === entry.id ? { ...x, text: e.target.value } : x))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = [...entries];
                  next.splice(i + 1, 0, { id: nanoid(), text: "", checked: false });
                  setEntries(next);
                } else if (e.key === "Backspace" && entry.text === "" && entries.length > 1) {
                  setEntries(entries.filter((x) => x.id !== entry.id));
                }
              }}
            />
          )}
          {!isFinished && !collapsed && (
            <button onClick={() => setEntries(entries.filter((x) => x.id !== entry.id))} className="opacity-0 group-hover/le:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-opacity flex-shrink-0">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}
      {collapsed && entries.length > 4 && (
        <p className="text-xs text-[var(--text-muted)]" style={{ position: "relative", zIndex: 1 }}>+{entries.length - 4} more items</p>
      )}
      {!isFinished && !collapsed && (
        <button onClick={() => setEntries([...entries, { id: nanoid(), text: "", checked: false }])} className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors w-fit" style={{ position: "relative", zIndex: 1 }}>
          <Plus size={11} /> Add item
        </button>
      )}
    </div>
  );
}

// ─── Variable ────────────────────────────────────────────────────────────────

function VariableItem({ item, upd, vars, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; vars: Record<string, number>; collapsed?: boolean; isFinished?: boolean }) {
  // Compute result using current known vars (which includes previously resolved vars in this block)
  const name = item.varName ?? "";
  const value = name in vars ? vars[name] : undefined;
  const isNum = typeof value === "number";
  const displayVal = isNum ? (isNaN(value) ? "Error" : String(Math.round(value * 10000) / 10000)) : "…";

  if (collapsed) {
    return (
      <div className="flex items-center justify-between rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm font-mono">
        <span className="text-[var(--text-secondary)]">{name || "unnamed"}</span>
        <span className={cn("font-semibold", displayVal === "Error" ? "text-red-400" : "text-[var(--accent)]")}>{displayVal}</span>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--surface)] p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Variable</span>
        <span className={cn("ml-auto text-sm font-mono font-bold", displayVal === "Error" ? "text-red-400" : "text-[var(--accent)]")}>= {displayVal}</span>
      </div>
      {isFinished ? (
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="font-semibold text-[var(--text-primary)]">{name}</span>
          <span className="text-[var(--text-muted)]">=</span>
          <span className="text-[var(--text-secondary)]">{item.varFormula}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--text-muted)]">Variable name</label>
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder='e.g. "cost of car"'
              value={name}
              onChange={(e) => upd({ varName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--text-muted)]">Value / formula — use {"{variable name}"} to reference others</label>
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-1 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors"
              placeholder='e.g. 32000 or {cost of car} - {what I have}'
              value={item.varFormula ?? ""}
              onChange={(e) => upd({ varFormula: e.target.value })}
            />
          </div>
          {Object.keys(vars).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {Object.entries(vars).filter(([n]) => n !== name).map(([n, v]) => (
                <button key={n} onClick={() => upd({ varFormula: (item.varFormula ?? "") + `{${n}}` })} className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[10px] font-mono text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors" title={`Insert {${n}}`}>
                  +{`{${n}}`}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Embed ────────────────────────────────────────────────────────────────────

function EmbedItem({ item, upd, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean }) {
  const url = item.embedUrl ?? "";
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  const ytId = ytMatch?.[1];
  const embedSrc = ytId ? `https://www.youtube.com/embed/${ytId}` : null;

  if (!url) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-[var(--border)] p-4 text-[var(--text-muted)]">
        <span className="text-2xl">🎥</span>
        <input
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none text-center placeholder:text-[var(--text-muted)]"
          placeholder="Paste YouTube or URL…"
          onBlur={(e) => { if (e.target.value) upd({ embedUrl: e.target.value }); }}
        />
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm">
        <span>🎥</span>
        <span className="flex-1 truncate text-[var(--text-secondary)]">{ytId ? "YouTube video" : url}</span>
        {!isFinished && <button onClick={() => upd({ embedUrl: "" })} className="text-[var(--text-muted)] hover:text-red-400"><Trash2 size={11} /></button>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {embedSrc ? (
        <div className="relative w-full overflow-hidden rounded" style={{ paddingBottom: "56.25%" }}>
          <iframe src={embedSrc} className="absolute inset-0 h-full w-full rounded border border-[var(--border)]" allowFullScreen title="embed" />
        </div>
      ) : (
        <iframe src={url} className="h-48 w-full rounded border border-[var(--border)]" title="embed" />
      )}
      {!isFinished && (
        <button onClick={() => upd({ embedUrl: "" })} className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">
          <Trash2 size={11} /> Remove embed
        </button>
      )}
    </div>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function TimerItem({ item, upd, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean }) {
  const total = item.timerSeconds ?? 60;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => setRemaining((r) => r - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (remaining <= 0) setRunning(false);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining]);

  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  if (collapsed) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-lg font-bold text-[var(--accent)]">{mm}:{ss}</span>
        <span className="text-xs text-[var(--text-muted)]">{item.timerLabel || "Timer"}</span>
        <button onClick={() => setRunning((r) => !r)} className="ml-auto rounded-full bg-[var(--accent)]/20 p-1 text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-colors">
          {running ? <Pause size={12} /> : <Play size={12} />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {!isFinished && (
        <input
          className="w-40 bg-transparent text-center text-sm text-[var(--text-secondary)] outline-none placeholder:text-[var(--text-muted)]"
          placeholder="Timer label…"
          value={item.timerLabel ?? ""}
          onChange={(e) => upd({ timerLabel: e.target.value })}
        />
      )}
      <span className="font-mono text-5xl font-bold tabular-nums text-[var(--text-primary)]">{mm}:{ss}</span>
      <div className="flex items-center gap-2">
        <button onClick={() => setRunning((r) => !r)} className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] transition-colors">
          {running ? <Pause size={14} /> : <Play size={14} />}
          {running ? "Pause" : "Start"}
        </button>
        <button onClick={() => { setRunning(false); setRemaining(total); }} className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <RotateCcw size={14} />
        </button>
      </div>
      {!isFinished && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>Duration:</span>
          <input type="number" min={1} value={Math.floor(total / 60)} onChange={(e) => { const s = Number(e.target.value) * 60 + (total % 60); upd({ timerSeconds: s }); setRemaining(s); }} className="w-12 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--text-primary)] outline-none" />
          <span>min</span>
          <input type="number" min={0} max={59} value={total % 60} onChange={(e) => { const s = Math.floor(total / 60) * 60 + Number(e.target.value); upd({ timerSeconds: s }); setRemaining(s); }} className="w-12 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-xs text-[var(--text-primary)] outline-none" />
          <span>sec</span>
        </div>
      )}
    </div>
  );
}

// ─── Image ────────────────────────────────────────────────────────────────────

function ImageItem({ item, upd, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => upd({ imageUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (!item.imageUrl) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-[var(--border)] p-4 text-[var(--text-muted)]">
        <span className="text-2xl">🖼️</span>
        <input
          className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-primary)] outline-none text-center placeholder:text-[var(--text-muted)]"
          placeholder="Paste image URL…"
          onBlur={(e) => { if (e.target.value) upd({ imageUrl: e.target.value }); }}
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-4 py-2 text-sm text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
        >
          <Upload size={14} /> Upload from file
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1">
      <img
        src={item.imageUrl}
        alt=""
        className={cn("w-full rounded border border-[var(--border)]", collapsed ? "h-24" : "max-h-64")}
        style={{ objectFit: item.imageObjectFit ?? "cover" }}
      />
      {!isFinished && !collapsed && (
        <div className="flex items-center gap-1">
          {(["cover", "contain", "fill"] as const).map((fit) => (
            <button
              key={fit}
              onClick={() => upd({ imageObjectFit: fit })}
              className={cn("rounded px-2 py-0.5 text-xs capitalize transition-colors", (item.imageObjectFit ?? "cover") === fit ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}
            >
              {fit}
            </button>
          ))}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border)]">
            <Upload size={11} /> Replace
          </button>
          <button onClick={() => upd({ imageUrl: "" })} className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors border border-[var(--border)]">
            <Trash2 size={11} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Graph ────────────────────────────────────────────────────────────────────

function GraphItem({ item, upd, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean }) {
  const data = item.graphData ?? [{ label: "A", value: 40 }, { label: "B", value: 65 }, { label: "C", value: 30 }];
  const type = item.graphType ?? "bar";

  return (
    <div className="flex flex-col gap-1" style={{ height: collapsed ? 80 : 200 }}>
      {!collapsed && !isFinished && (
        <div className="flex gap-1">
          {(["bar", "line", "pie"] as const).map((t) => (
            <button key={t} onClick={() => upd({ graphType: t })} className={cn("rounded px-2 py-0.5 text-xs capitalize transition-colors", type === t ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-overlay)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>{t}</button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data}><XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} hide={collapsed} /><YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} hide={collapsed} />{!collapsed && <Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 6 }} />}<Bar dataKey="value" fill="var(--accent)" radius={[3, 3, 0, 0]} /></BarChart>
          ) : type === "line" ? (
            <LineChart data={data}><XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 10 }} hide={collapsed} /><YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} hide={collapsed} />{!collapsed && <Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 6 }} />}<Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={!collapsed} /></LineChart>
          ) : (
            <PieChart><Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={collapsed ? "90%" : "80%"}>{data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie>{!collapsed && <Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 6 }} />}</PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Gaming ───────────────────────────────────────────────────────────────────

function GamingItem({ item, upd, collapsed, isFinished }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void; collapsed?: boolean; isFinished?: boolean }) {
  const game = item.game ?? "valorant";
  const meta = GAME_META[game];
  const connected = !!item.gameUsername;

  if (collapsed) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
        <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.name}</span>
        {connected ? (
          <div className="ml-auto flex gap-2">
            {meta.stats.map((s) => (
              <span key={s.label} className="text-xs font-mono font-semibold" style={{ color: meta.color }}>{s.value}</span>
            ))}
          </div>
        ) : (
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">Not connected</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
        <span className="font-bold text-sm" style={{ color: meta.color }}>{meta.name}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px]">
          {connected ? <><Wifi size={10} className="text-green-400" /><span className="text-green-400">Live</span></> : <><WifiOff size={10} className="text-[var(--text-muted)]" /><span className="text-[var(--text-muted)]">Not connected</span></>}
        </span>
      </div>
      {!isFinished && (
        <div className="flex gap-1">
          <input className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors" placeholder="Username" value={item.gameUsername ?? ""} onChange={(e) => upd({ gameUsername: e.target.value })} />
          <input className="w-16 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)] transition-colors" placeholder="#TAG" value={item.gameTag ?? ""} onChange={(e) => upd({ gameTag: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        {[...meta.stats, ...meta.detailStats].map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded p-2" style={{ background: meta.bg }}>
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">{s.label}</span>
            <span className="text-base font-bold" style={{ color: meta.color }}>{connected ? s.value : "—"}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-[10px] text-[var(--text-muted)] rounded border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-1">
        {connected ? `Preview for ${item.gameUsername}${item.gameTag ? `#${item.gameTag}` : ""} · API coming soon` : "Enter username to preview · API integration coming soon"}
      </p>
    </div>
  );
}

// ─── Custom Widget ────────────────────────────────────────────────────────────

function WidgetItem({ item, upd, vars, collapsed, isFinished }: {
  item: BlockItem;
  upd: (p: Partial<BlockItem>) => void;
  vars: Record<string, number>;
  collapsed?: boolean;
  isFinished?: boolean;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [draft, setDraft] = useState(item.widgetCode ?? DEFAULT_WIDGET_CODE);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft → store with debounce
  const handleCodeChange = (code: string) => {
    setDraft(code);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => upd({ widgetCode: code }), 600);
  };

  // Send vars whenever they change or iframe (re)loads
  const sendVars = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "plancraft-vars", vars },
      "*"
    );
  };

  useEffect(() => { sendVars(); }, [vars]); // eslint-disable-line react-hooks/exhaustive-deps

  const srcDoc = item.widgetCode ?? DEFAULT_WIDGET_CODE;

  if (collapsed) {
    return (
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="w-full border-none rounded"
        style={{ height: 80, pointerEvents: "none" }}
        onLoad={sendVars}
      />
    );
  }

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {/* Tab bar */}
      {!isFinished && (
        <div
          className="flex flex-shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1"
          style={{ background: "var(--surface-overlay)" }}
        >
          {(["preview", "code"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {t === "code" ? "< Code >" : "Preview"}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-[var(--text-muted)]">HTML · CSS · JS</span>
        </div>
      )}

      {/* Content */}
      {tab === "preview" || isFinished ? (
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="flex-1 w-full border-none min-h-0"
          style={{ display: "block" }}
          onLoad={sendVars}
        />
      ) : (
        <textarea
          value={draft}
          onChange={(e) => handleCodeChange(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full min-h-0 resize-none outline-none p-3 font-mono text-[11px] leading-relaxed"
          style={{
            background: "var(--surface)",
            color: "var(--text-primary)",
            tabSize: 2,
          }}
          onKeyDown={(e) => {
            // Tab key inserts spaces instead of changing focus
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const start = el.selectionStart;
              const end = el.selectionEnd;
              const next = draft.substring(0, start) + "  " + draft.substring(end);
              setDraft(next);
              setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2; }, 0);
            }
          }}
        />
      )}
    </div>
  );
}
