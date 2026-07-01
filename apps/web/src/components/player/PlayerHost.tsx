"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from "lucide-react";
import { useBoardStore, type BlockItem, type BoardLevelItem } from "@/store/boardStore";
import { usePlayerStore } from "@/store/playerStore";
import { advancePlaylistIndex, PLATFORM_COLORS, platformControllable, playerKeyOf, resolveEmbed } from "@/lib/playlist";

/**
 * Global media host: owns the actual <iframe>/<audio> for the playlist item
 * that currently "claims" the player, so playback survives board switches.
 *
 * While the owning item's embed slot is on screen, the media is pinned over
 * it with position:fixed (tracked every frame — the element is never
 * re-parented, which would reload the iframe). When the slot is gone
 * (other board, collapsed box), it docks into a mini-player bottom-right.
 */
export function PlayerHost() {
  const claim = usePlayerStore((s) => s.claim);
  const userStarted = usePlayerStore((s) => s.userStarted);
  const playing = usePlayerStore((s) => s.playing);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const releasePlayer = usePlayerStore((s) => s.releasePlayer);

  const item = useBoardStore((s): BlockItem | BoardLevelItem | undefined => {
    if (!claim) return undefined;
    const board = s.boards.find((b) => b.id === claim.boardId) ?? s.serverBoards[claim.boardId];
    if (!board) return undefined;
    if (claim.boxId) return board.boxes.find((b) => b.id === claim.boxId)?.items.find((i) => i.id === claim.itemId);
    return board.boardItems?.find((i) => i.id === claim.itemId);
  });

  const tracks = item?.playlistTracks ?? [];
  const currentIdx = Math.min(item?.playlistCurrentIndex ?? 0, Math.max(0, tracks.length - 1));
  const currentTrack = tracks[currentIdx] ?? null;
  const vol = item?.playlistVolume ?? 80;
  const autoplay = !!item?.playlistAutoplay || userStarted;
  const embed = currentTrack ? resolveEmbed(currentTrack.url, autoplay) : null;
  const claimKey = claim ? playerKeyOf(claim.boardId, claim.boxId, claim.itemId) : null;

  // Release the claim when the owning item disappears (deleted / board unloaded)
  useEffect(() => {
    if (claim && (!item || !currentTrack || embed?.kind === "link")) releasePlayer();
  }, [claim, item, currentTrack, embed?.kind, releasePlayer]);

  const upd = useCallback((patch: Partial<BlockItem>) => {
    if (!claim) return;
    const s = useBoardStore.getState();
    if (claim.boxId) s.updateItem(claim.boardId, claim.boxId, claim.itemId, patch);
    else s.updateBoardItem(claim.boardId, claim.itemId, patch as Partial<BoardLevelItem>);
  }, [claim]);

  const advance = useCallback((dir: 1 | -1, fromEnded = false) => {
    if (!item) return;
    const next = advancePlaylistIndex(item, dir);
    if (next === null) { setPlaying(false); return; }
    // A track that just ended means playback was rolling — keep the chain going
    if (fromEnded) usePlayerStore.setState({ userStarted: true });
    upd({ playlistCurrentIndex: next });
  }, [item, upd, setPlaying]);

  // ── Refs to media + platform bridges ────────────────────────────────────────
  const boxRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ytReadyRef = useRef(false);
  const scWidgetRef = useRef<{
    setVolume: (v: number) => void;
    bind: (ev: string, cb: () => void) => void;
    toggle: () => void;
  } | null>(null);
  const volRef = useRef(vol);
  volRef.current = vol;
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  const [docked, setDocked] = useState(false);
  const dockedRef = useRef(docked);
  const [showVol, setShowVol] = useState(false);

  // ── Pin loop: track the owning slot's rect, else dock bottom-right ─────────
  useEffect(() => {
    if (!claimKey) return;
    let raf = 0;
    const tick = () => {
      const el = boxRef.current;
      if (el) {
        const slot = usePlayerStore.getState().slots[claimKey];
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let pinned = false;
        if (slot?.el.isConnected) {
          const r = slot.el.getBoundingClientRect();
          const offscreen = r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw || r.width < 8 || r.height < 8;
          if (!offscreen) {
            pinned = true;
            // Sit just above the slot's outermost stacking ancestor (the board
            // item/box root carries an unbounded bring-to-front z-index that
            // competes at root level — a static z would end up underneath and
            // the item's transparent layers would eat every click). Capped
            // below modals/menus (z 300+).
            let rootZ: number | null = null;
            let cur: HTMLElement | null = slot.el;
            while (cur && cur !== document.body) {
              const zi = getComputedStyle(cur).zIndex;
              if (zi !== "auto") {
                const n = parseInt(zi, 10);
                if (!Number.isNaN(n)) rootZ = n;
              }
              cur = cur.parentElement;
            }
            el.style.left = `${r.left}px`;
            el.style.top = `${r.top}px`;
            el.style.width = `${r.width}px`;
            el.style.height = `${r.height}px`;
            el.style.right = "auto";
            el.style.bottom = "auto";
            el.style.zIndex = String(rootZ !== null ? Math.min(rootZ + 1, 299) : 25);
            el.style.borderRadius = "8px";
            el.style.pointerEvents = slot.interactive ? "auto" : "none";
          }
        }
        if (!pinned) {
          const mobile = vw < 768;
          el.style.left = "auto";
          el.style.top = "auto";
          el.style.right = "12px";
          el.style.bottom = mobile ? "calc(env(safe-area-inset-bottom, 0px) + 84px)" : "12px";
          el.style.width = "272px";
          el.style.height = "auto";
          el.style.zIndex = "850";
          el.style.borderRadius = "12px";
          el.style.pointerEvents = "auto";
        }
        if (dockedRef.current === pinned) {
          dockedRef.current = !pinned;
          setDocked(!pinned);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [claimKey]);

  // ── YouTube bridge: handshake, volume, state → play/pause/ended ────────────
  useEffect(() => {
    if (embed?.platform !== "YouTube") return;
    ytReadyRef.current = false;
    let gotMessage = false;
    const sendVol = (v: number) => iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "setVolume", args: [v] }), "*"
    );
    // YouTube only starts streaming state events after a "listening" handshake.
    // One onLoad shot is racy (and needs channel:"widget"), so retry until the
    // first message arrives.
    const sendListening = () => iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*"
    );
    const handshake = setInterval(() => {
      if (gotMessage) { clearInterval(handshake); return; }
      sendListening();
    }, 600);
    sendListening();
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!gotMessage) { gotMessage = true; ytReadyRef.current = true; sendVol(volRef.current); }
        if (d?.event === "onReady") sendVol(volRef.current);
        const state: unknown = d?.event === "onStateChange" ? d.info : d?.info?.playerState;
        if (state === 1) usePlayerStore.getState().setPlaying(true);
        else if (state === 2) usePlayerStore.getState().setPlaying(false);
        else if (state === 0) advanceRef.current(1, true);
      } catch {}
    };
    window.addEventListener("message", onMsg);
    return () => { window.removeEventListener("message", onMsg); clearInterval(handshake); };
  }, [embed?.url, embed?.platform]);

  useEffect(() => {
    if (embed?.platform !== "YouTube" || !ytReadyRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: "setVolume", args: [vol] }), "*"
    );
  }, [vol, embed?.platform]);

  // ── SoundCloud bridge ───────────────────────────────────────────────────────
  useEffect(() => {
    if (embed?.platform !== "SoundCloud") return;
    scWidgetRef.current = null;
    const bindWidget = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SC = (window as any).SC;
      if (!SC || !iframeRef.current) return;
      const w = SC.Widget(iframeRef.current);
      scWidgetRef.current = w;
      w.bind(SC.Widget.Events.READY, () => w.setVolume(volRef.current));
      w.bind(SC.Widget.Events.PLAY, () => usePlayerStore.getState().setPlaying(true));
      w.bind(SC.Widget.Events.PAUSE, () => usePlayerStore.getState().setPlaying(false));
      w.bind(SC.Widget.Events.FINISH, () => advanceRef.current(1, true));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).SC) {
      bindWidget();
    } else if (!document.getElementById("sc-widget-api")) {
      const s = document.createElement("script");
      s.id = "sc-widget-api";
      s.src = "https://w.soundcloud.com/player/api.js";
      s.onload = bindWidget;
      document.head.appendChild(s);
    } else {
      const el = document.getElementById("sc-widget-api")!;
      const tid = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!scWidgetRef.current && (window as any).SC) bindWidget();
      }, 0);
      el.addEventListener("load", () => { clearTimeout(tid); bindWidget(); }, { once: true });
    }
  }, [embed?.url, embed?.platform]);

  useEffect(() => {
    if (embed?.platform !== "SoundCloud") return;
    try { scWidgetRef.current?.setVolume(vol); } catch {}
  }, [vol, embed?.platform]);

  // ── Direct audio volume ─────────────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = vol / 100;
  }, [vol, embed?.url]);

  if (!claim || !item || !currentTrack || !embed || embed.kind === "link") return null;

  const controllable = platformControllable(embed.platform);
  const platformColor = PLATFORM_COLORS[embed.platform] ?? "var(--text-muted)";
  const volSupported = embed.kind === "audio" || embed.platform === "YouTube" || embed.platform === "SoundCloud";

  const togglePlay = () => {
    if (embed.kind === "audio") {
      const a = audioRef.current;
      if (!a) return;
      if (a.paused) void a.play(); else a.pause();
    } else if (embed.platform === "YouTube") {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: playing === true ? "pauseVideo" : "playVideo", args: [] }), "*"
      );
    } else if (embed.platform === "SoundCloud") {
      try { scWidgetRef.current?.toggle(); } catch {}
    }
  };

  const media = embed.kind === "iframe" ? (
    <iframe
      ref={iframeRef} key={embed.url} src={embed.url}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="w-full border-none block"
      style={docked
        ? (embed.fixedHeight ? { height: Math.min(embed.fixedHeight, 166) } : { aspectRatio: embed.aspectRatio ?? "16/9" })
        : { height: "100%" }}
      onLoad={() => {
        if (embed.platform === "YouTube") {
          iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
        }
      }}
    />
  ) : (
    /* eslint-disable-next-line jsx-a11y/media-has-caption */
    <audio
      ref={audioRef} key={embed.url} src={embed.url}
      controls={claim.canPlayback} autoPlay={autoplay}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => advance(1, true)}
      className="w-full block"
      style={{ colorScheme: "dark", height: docked ? 40 : "100%" }}
    />
  );

  return (
    <div
      ref={boxRef}
      style={{
        position: "fixed",
        overflow: "hidden",
        background: "black",
        // start docked; the pin loop takes over immediately
        right: 12, bottom: 12, width: 272, zIndex: 850, borderRadius: 12,
        boxShadow: docked ? "0 8px 32px rgba(0,0,0,0.55)" : undefined,
        border: docked ? "1px solid var(--border)" : undefined,
      }}
    >
      {media}

      {docked && (
        <div className="flex flex-col gap-1 px-2.5 py-2" style={{ background: "var(--surface-raised)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: platformColor }} />
            <span className="flex-1 truncate text-[11px] font-medium text-[var(--text-primary)]" title={currentTrack.title}>
              {currentTrack.title}
            </span>
            <button onClick={releasePlayer} title="Stop and close"
              className="shrink-0 p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-[9px] text-[var(--text-muted)] mr-auto tabular-nums">{currentIdx + 1} / {tracks.length}</span>
            {claim.canPlayback && tracks.length > 1 && (
              <button onClick={() => advance(-1)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <SkipBack size={13} />
              </button>
            )}
            {claim.canPlayback && controllable && embed.kind !== "audio" && (
              <button onClick={togglePlay} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-primary)] transition-colors">
                {playing === true ? <Pause size={14} /> : <Play size={14} />}
              </button>
            )}
            {claim.canPlayback && tracks.length > 1 && (
              <button onClick={() => advance(1)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <SkipForward size={13} />
              </button>
            )}
            {claim.canVolume && volSupported && (
              <button onClick={() => setShowVol((v) => !v)} title="Volume"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: showVol ? "var(--accent)" : "var(--text-muted)" }}>
                {vol === 0 ? <VolumeX size={12} /> : vol < 50 ? <Volume1 size={12} /> : <Volume2 size={12} />}
              </button>
            )}
            {!claim.canPlayback && (
              <span className="flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                <Music size={10} /> listening
              </span>
            )}
          </div>
          {showVol && claim.canVolume && volSupported && (
            <div className="flex items-center gap-2">
              <VolumeX size={10} className="shrink-0 text-[var(--text-muted)]" />
              <input type="range" min={0} max={100} value={vol}
                onChange={(e) => upd({ playlistVolume: Number(e.target.value) })}
                className="flex-1 h-1 cursor-pointer" style={{ accentColor: "var(--accent)" }} />
              <Volume2 size={10} className="shrink-0 text-[var(--text-muted)]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
