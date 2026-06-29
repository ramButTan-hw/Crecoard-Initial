"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertCircle, Settings, ExternalLink } from "lucide-react";
import type { BlockItem, TrackerGGConfig, TrackerGGData, TrackerGGGame, TrackerGGPlatform } from "@/store/boardStore";
import { useBoardStore } from "@/store/boardStore";

const STALE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Game / platform metadata ─────────────────────────────────────────────────

const GAME_LABEL: Record<TrackerGGGame, string> = {
  "valorant":      "VALORANT",
  "apex":          "APEX LEGENDS",
  "rocket-league": "ROCKET LEAGUE",
  "fortnite":      "FORTNITE",
  "csgo":          "CS2",
};

const GAME_PLATFORMS: Record<TrackerGGGame, { value: TrackerGGPlatform; label: string }[]> = {
  "valorant":      [{ value: "riot",   label: "Riot ID (PC)" }],
  "apex":          [{ value: "origin", label: "EA (PC)" }, { value: "psn", label: "PlayStation" }, { value: "xbl", label: "Xbox" }],
  "rocket-league": [{ value: "epic",   label: "Epic" }, { value: "steam", label: "Steam" }, { value: "psn", label: "PlayStation" }, { value: "xbl", label: "Xbox" }],
  "fortnite":      [{ value: "epic",   label: "Epic" }, { value: "psn", label: "PlayStation" }, { value: "xbl", label: "Xbox" }],
  "csgo":          [{ value: "steam",  label: "Steam ID" }],
};

const USERNAME_HINT: Record<TrackerGGGame, string> = {
  "valorant":      "e.g. TenZ#000",
  "apex":          "EA username",
  "rocket-league": "Epic username",
  "fortnite":      "Epic username",
  "csgo":          "Steam ID or vanity URL",
};

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchTrackerData(cfg: TrackerGGConfig): Promise<TrackerGGData> {
  const res = await fetch("/api/integrations/tracker-gg", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game:     cfg.game,
      platform: cfg.platform,
      username: cfg.username,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch stats.");
  return json as TrackerGGData;
}

// ─── Main item ────────────────────────────────────────────────────────────────

interface Props {
  item: BlockItem;
  boardId: string;
  boxId: string;
  collapsed?: boolean;
  isFinished?: boolean;
  onUpdate?: (patch: Partial<BlockItem>) => void;
}

export function TrackerGGItem({ item, boardId, boxId, collapsed, isFinished, onUpdate }: Props) {
  const updateItem    = useBoardStore((s) => s.updateItem);
  const updateBoardItem = useBoardStore((s) => s.updateBoardItem);

  const upd = useCallback((patch: Partial<BlockItem>) => {
    if (onUpdate) { onUpdate(patch); return; }
    if (boxId) updateItem(boardId, boxId, item.id, patch);
    else       updateBoardItem(boardId, item.id, patch);
  }, [onUpdate, updateItem, updateBoardItem, boardId, boxId, item.id]);

  const cfg  = item.trackerGG;
  const data = item.trackerGGData;
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(!cfg?.username);

  const isStale = !data || Date.now() - data.fetchedAt > STALE_MS;

  const doFetch = useCallback(async (config: TrackerGGConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTrackerData(config);
      upd({ trackerGGData: result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [upd]);

  // Auto-fetch on mount if stale
  useEffect(() => {
    if (cfg?.username && isStale && !loading) {
      void doFetch(cfg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg?.game, cfg?.platform, cfg?.username]);

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 text-xs truncate"
        style={{ color: data?.accentColor ?? "var(--accent)" }}>
        <span className="font-bold truncate">
          {data?.rankLabel ?? cfg?.username ?? "Tracker.gg"}
        </span>
        {data?.username && <span className="text-[var(--text-muted)] truncate">{data.username}</span>}
      </div>
    );
  }

  if (showSetup || !cfg?.username) {
    return (
      <SetupForm
        cfg={cfg}
        onSave={(newCfg) => {
          upd({ trackerGG: newCfg, trackerGGData: undefined });
          setShowSetup(false);
          void doFetch(newCfg);
        }}
        onCancel={cfg?.username ? () => setShowSetup(false) : undefined}
      />
    );
  }

  const accent = data?.accentColor ?? "var(--accent)";

  return (
    <div className="flex flex-col h-full w-full overflow-hidden rounded-md border border-[var(--border)]"
      style={{ background: "var(--surface-raised)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]"
        style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
        <span className="text-[10px] font-black tracking-widest flex-1 truncate"
          style={{ color: accent }}>
          {GAME_LABEL[cfg.game]}
        </span>
        {!isFinished && (
          <button
            onClick={() => setShowSetup(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Configure"
          >
            <Settings size={12} />
          </button>
        )}
        <button
          onClick={() => doFetch(cfg)}
          disabled={loading}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden p-3 gap-3">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400 leading-snug">{error}</p>
          </div>
        )}

        {loading && !data && (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-[var(--text-muted)]" />
          </div>
        )}

        {data && (
          <>
            {/* Player info */}
            <div className="flex items-center gap-2.5">
              {data.avatarUrl ? (
                <img src={data.avatarUrl} alt="" className="w-9 h-9 rounded-full border border-[var(--border)] flex-shrink-0 object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
                  style={{ background: accent + "33", color: accent }}>
                  {data.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{data.username}</p>
                {data.rankLabel && (
                  <div className="flex items-center gap-1.5">
                    {data.rankIconUrl && (
                      <img src={data.rankIconUrl} alt="" className="w-4 h-4 object-contain" />
                    )}
                    <span className="text-xs font-medium" style={{ color: accent }}>{data.rankLabel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats grid */}
            {data.stats.length > 0 && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {data.stats.map((stat) => (
                  <div key={stat.key}>
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide leading-none mb-0.5">
                      {stat.label}
                    </p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{stat.value}</p>
                      {stat.percentile !== undefined && stat.percentile >= 75 && (
                        <span className="text-[9px] font-semibold px-1 rounded-full"
                          style={{ background: accent + "30", color: accent }}>
                          top {100 - Math.round(stat.percentile)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-1 mt-auto pt-1 border-t border-[var(--border)]">
              <p className="text-[9px] text-[var(--text-muted)] flex-1">
                Updated {new Date(data.fetchedAt).toLocaleTimeString()}
              </p>
              <a
                href={`https://tracker.gg/${cfg.game}/profile/${cfg.platform}/${encodeURIComponent(cfg.username)}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ExternalLink size={10} />
              </a>
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-[var(--text-muted)]">No data yet — click refresh.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Setup form ───────────────────────────────────────────────────────────────

function SetupForm({
  cfg,
  onSave,
  onCancel,
}: {
  cfg?: TrackerGGConfig;
  onSave: (cfg: TrackerGGConfig) => void;
  onCancel?: () => void;
}) {
  const [game, setGame]         = useState<TrackerGGGame>(cfg?.game ?? "valorant");
  const [platform, setPlatform] = useState<TrackerGGPlatform>(cfg?.platform ?? "riot");
  const [username, setUsername] = useState(cfg?.username ?? "");

  // Reset platform when game changes
  useEffect(() => {
    const first = GAME_PLATFORMS[game][0].value;
    setPlatform(first);
  }, [game]);

  const handleSave = () => {
    if (!username.trim()) return;
    onSave({ game, platform, username: username.trim() });
  };

  return (
    <div className="flex flex-col gap-3 p-3 h-full justify-center">
      <p className="text-xs font-semibold text-[var(--text-primary)]">Configure Tracker.gg</p>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Game</span>
        <select
          value={game}
          onChange={(e) => setGame(e.target.value as TrackerGGGame)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        >
          {(Object.keys(GAME_LABEL) as TrackerGGGame[]).map((g) => (
            <option key={g} value={g}>{GAME_LABEL[g]}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Platform</span>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as TrackerGGPlatform)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        >
          {GAME_PLATFORMS[game].map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Username</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder={USERNAME_HINT[game]}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
      </label>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!username.trim()}
          className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          Load stats
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:bg-[var(--surface-overlay)] transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Style panel (for BoardItemPanel) ─────────────────────────────────────────

export function TrackerGGStylePanel({ item, upd }: { item: BlockItem; upd: (p: Partial<BlockItem>) => void }) {
  const cfg  = item.trackerGG;
  const data = item.trackerGGData;
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleRefresh() {
    if (!cfg?.username) return;
    setLoading(true); setError(null);
    try {
      const result = await fetchTrackerData(cfg);
      upd({ trackerGGData: result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 flex flex-col gap-4 text-xs">
      {cfg?.username ? (
        <section className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Player</p>
          <p className="text-[var(--text-primary)] font-medium">{cfg.username}</p>
          <p className="text-[var(--text-muted)]">{cfg.game} · {cfg.platform}</p>
          {data && (
            <p className="text-[var(--text-muted)]">
              Last fetched: {new Date(data.fetchedAt).toLocaleString()}
            </p>
          )}
          {error && <p className="text-red-400">{error}</p>}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 self-start rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-overlay)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh now"}
          </button>
        </section>
      ) : (
        <p className="text-[var(--text-muted)]">Click the item to configure game and username.</p>
      )}

    </div>
  );
}
