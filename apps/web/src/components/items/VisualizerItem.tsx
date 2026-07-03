"use client";

/**
 * Visualizer — a canvas effects item with a Wallpaper-Engine flavour:
 * glow/bloom, gradients, and motion trails. Effects: audio bars, radial
 * spectrum, waveform, rain, particles, starfield, aurora. Audio effects react
 * to the mic or the PC's system audio (desktop loopback); otherwise animate
 * procedurally. Background can be a color, transparent (shows the board
 * behind), or an image. Self-contained; wired in ItemRenderer via WithItemMenu.
 */

import { useEffect, useRef } from "react";
import {
  AudioLines, Waves, CloudRain, Sparkles, Wind, Mic, Disc3, Star,
  Image as ImageIcon, Sun, Wand2,
} from "lucide-react";
import type { BlockItem } from "@/store/boardStore";
import { applyImageUpload } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Upd = (p: Partial<BlockItem>) => void;

export const VISUALIZER_EFFECTS = [
  { id: "bars",      label: "Audio bars",    icon: AudioLines, audio: true },
  { id: "radial",    label: "Radial",        icon: Disc3,      audio: true },
  { id: "wave",      label: "Waveform",      icon: Waves,      audio: true },
  { id: "rain",      label: "Rain",          icon: CloudRain,  audio: false },
  { id: "particles", label: "Particles",     icon: Sparkles,   audio: false },
  { id: "starfield", label: "Starfield",     icon: Star,       audio: false },
  { id: "aurora",    label: "Aurora",        icon: Wind,       audio: false },
] as const;

type Params = {
  effect: string; color: string; color2: string; speed: number; intensity: number;
  bg: string; bgType: string; bgOpacity: number; glow: boolean; trails: boolean; barRounded: boolean;
  freqLo: number; freqHi: number; // spectrum window (bin indices) for bars/radial
};

/**
 * Log-spaced frequency band for bar `idx` of `nBars`, averaged over its bins,
 * mapped across the [loBin, hiBin] window. Focusing the window on the vocal/mid
 * range fills the whole visualization with the "dramatic" content instead of
 * wasting bars on near-silent highs and boomy sub-bass. Log spacing gives the
 * lows more bars; the caller adds a tilt to lift the naturally-quiet highs.
 */
function bandValue(spec: number[], idx: number, nBars: number, loBin: number, hiBin: number): number {
  const ratio = hiBin / loBin;
  const lo = Math.max(1, Math.floor(loBin * Math.pow(ratio, idx / nBars)));
  const hi = Math.max(lo + 1, Math.floor(loBin * Math.pow(ratio, (idx + 1) / nBars)));
  let sum = 0, cnt = 0;
  for (let k = lo; k < hi && k < spec.length; k++) { sum += spec[k]; cnt++; }
  return cnt ? sum / cnt : 0;
}
const tilt = (i: number, n: number) => 0.9 + 1.15 * (i / n); // boost highs

const FFT_SIZE = 1024;
// Focus presets as [lowHz, highHz]. "vocal" spans voice fundamentals + formants
// and most melodic/"dramatic" content; "bass" is the low end; "full" is musical-wide.
const FOCUS_HZ: Record<string, [number, number]> = {
  full: [30, 16000],
  vocal: [120, 6000],
  bass: [30, 300],
};
/** Focus preset → [loBin, hiBin] over the frequency-bin array. */
function focusBins(focus: string, sampleRate: number, bins: number): [number, number] {
  const [loHz, hiHz] = FOCUS_HZ[focus] ?? FOCUS_HZ.full;
  const lo = Math.max(1, Math.round((loHz * FFT_SIZE) / sampleRate));
  const hi = Math.min(bins - 1, Math.max(lo + 2, Math.round((hiHz * FFT_SIZE) / sampleRate)));
  return [lo, hi];
}
type Drop = { x: number; y: number; len: number; speed: number; a: number };
type Particle = { x: number; y: number; vx: number; vy: number; r: number; tw: number };
type Star3 = { x: number; y: number; z: number };

function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height, cr = w / h;
  let dw: number, dh: number;
  if (ir > cr) { dh = h; dw = h * ir; } else { dw = w; dh = w / ir; }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// ─── Effects ──────────────────────────────────────────────────────────────────

function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: Params, audio: number[] | null) {
  const n = 56;
  const bw = w / n;
  const grad = ctx.createLinearGradient(0, h, 0, h * 0.1);
  grad.addColorStop(0, p.color);
  grad.addColorStop(1, p.color2);
  ctx.fillStyle = grad;
  const rad = p.barRounded ? 5 : 0;
  for (let i = 0; i < n; i++) {
    let amp = audio
      ? Math.min(1, bandValue(audio, i, n, p.freqLo, p.freqHi) * tilt(i, n))
      : (Math.sin(t * 3 + i * 0.4) * 0.5 + 0.5) * (Math.sin(t + i) * 0.3 + 0.7);
    amp = Math.pow(amp, 1.1) * p.intensity;
    const bh = Math.max(3, amp * h * 0.82);
    const x = i * bw + bw * 0.2, bwidth = bw * 0.6;
    if (rad > 0) { roundRect(ctx, x, h - bh, bwidth, bh, Math.min(bwidth / 2, rad)); ctx.fill(); }
    else ctx.fillRect(x, h - bh, bwidth, bh);
  }
}

function drawRadial(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: Params, audio: number[] | null) {
  const cx = w / 2, cy = h / 2;
  const n = 72;
  const baseR = Math.min(w, h) * 0.16;
  const maxLen = Math.min(w, h) * 0.3 * p.intensity;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.12);
  ctx.lineWidth = Math.max(2, Math.min(w, h) / 120);
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    let amp = audio ? Math.min(1, bandValue(audio, i, n, p.freqLo, p.freqHi) * tilt(i, n)) : (Math.sin(t * 3 + i * 0.3) * 0.5 + 0.5);
    amp = Math.pow(amp, 1.1);
    const len = baseR + amp * maxLen;
    const x1 = Math.cos(ang) * baseR, y1 = Math.sin(ang) * baseR;
    const x2 = Math.cos(ang) * len, y2 = Math.sin(ang) * len;
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, p.color); g.addColorStop(1, p.color2);
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
}

function drawWave(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: Params, wave: number[] | null) {
  const mid = h / 2;
  const amp = h * 0.42 * p.intensity;

  // Sampler: i in 0..1 → value in ~-1..1. For real audio, trigger on the first
  // rising zero-crossing so the trace holds phase instead of jittering, and
  // apply light 3-tap smoothing.
  let sample: (i: number) => number;
  if (wave && wave.length > 8) {
    const n = wave.length;
    let s = 0;
    for (let i = 1; i < (n >> 1); i++) {
      if (wave[i - 1] <= 0 && wave[i] > 0) { s = i; break; }
    }
    const win = Math.max(2, n - s - 1);
    sample = (i) => {
      const idx = s + Math.floor(i * win);
      const a = (wave[Math.max(0, idx - 1)] ?? 0) + (wave[idx] ?? 0) + (wave[Math.min(n - 1, idx + 1)] ?? 0);
      return a / 3;
    };
  } else {
    sample = (i) => Math.sin(i * 10 + t * 2) * Math.sin(i * 3 - t) * 0.6;
  }
  const yAt = (i: number) => mid + sample(i) * amp;

  // Filled area under the curve
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, yAt(x / w));
  ctx.lineTo(w, h);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, mid, 0, h);
  fill.addColorStop(0, hexA(p.color, 0.35));
  fill.addColorStop(1, hexA(p.color, 0));
  ctx.fillStyle = fill;
  ctx.fill();
  // Line
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) { const y = yAt(x / w); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
}

function drawRain(ctx: CanvasRenderingContext2D, w: number, h: number, p: Params, drops: Drop[]): Drop[] {
  const target = Math.min(400, Math.floor((w / 6) * p.intensity));
  while (drops.length < target) drops.push({ x: Math.random() * w, y: Math.random() * h, len: 10 + Math.random() * 18, speed: 3 + Math.random() * 6, a: 0.3 + Math.random() * 0.5 });
  if (drops.length > target) drops.length = target;
  ctx.lineWidth = 1.3;
  for (const d of drops) {
    const g = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.len);
    g.addColorStop(0, hexA(p.color, 0));
    g.addColorStop(1, hexA(p.color, d.a));
    ctx.strokeStyle = g;
    ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y + d.len); ctx.stroke();
    d.y += d.speed * p.speed * 2;
    if (d.y > h) { d.y = -d.len; d.x = Math.random() * w; }
  }
  return drops;
}

function drawParticles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: Params, ps: Particle[]): Particle[] {
  const target = Math.min(90, Math.floor(((w * h) / 8000) * p.intensity));
  while (ps.length < target) ps.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, r: 0.8 + Math.random() * 2, tw: Math.random() * 6 });
  if (ps.length > target) ps.length = target;
  // connections
  ctx.strokeStyle = p.color;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d2 = dx * dx + dy * dy;
      if (d2 < 100 * 100) {
        ctx.globalAlpha = (1 - Math.sqrt(d2) / 100) * 0.35;
        ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke();
      }
    }
  }
  // dots with twinkle
  ctx.fillStyle = p.color;
  for (const a of ps) {
    a.x += a.vx * p.speed; a.y += a.vy * p.speed;
    if (a.x < 0) a.x += w; if (a.x > w) a.x -= w;
    if (a.y < 0) a.y += h; if (a.y > h) a.y -= h;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + a.tw);
    ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return ps;
}

function drawStarfield(ctx: CanvasRenderingContext2D, w: number, h: number, p: Params, stars: Star3[]): Star3[] {
  const cx = w / 2, cy = h / 2;
  const target = Math.min(320, Math.floor(((w * h) / 2600) * p.intensity));
  const reset = (s: Star3) => { s.x = (Math.random() * 2 - 1) * w; s.y = (Math.random() * 2 - 1) * h; s.z = w; };
  while (stars.length < target) { const s = { x: 0, y: 0, z: 0 }; reset(s); s.z = Math.random() * w; stars.push(s); }
  if (stars.length > target) stars.length = target;
  ctx.fillStyle = p.color;
  for (const s of stars) {
    s.z -= 4.5 * p.speed;
    if (s.z <= 1) reset(s);
    const k = 128 / s.z;
    const px = cx + s.x * k, py = cy + s.y * k;
    if (px < 0 || px > w || py < 0 || py > h) continue;
    const depth = 1 - s.z / w;
    ctx.globalAlpha = Math.min(1, depth * 1.6);
    ctx.beginPath(); ctx.arc(px, py, Math.max(0.4, depth * 2.6), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  return stars;
}

function drawAurora(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p: Params) {
  const blobs = [
    { c: p.color, ox: 0.25, oy: 0.4, s: 0.6 },
    { c: p.color2, ox: 0.7, oy: 0.55, s: 0.55 },
    { c: p.color, ox: 0.5, oy: 0.3, s: 0.5 },
    { c: p.color2, ox: 0.4, oy: 0.7, s: 0.4 },
  ];
  ctx.globalCompositeOperation = "lighter";
  blobs.forEach((b, i) => {
    const x = (b.ox + Math.sin(t * 0.5 + i) * 0.16) * w;
    const y = (b.oy + Math.cos(t * 0.4 + i * 1.3) * 0.16) * h;
    const rad = Math.max(w, h) * b.s * p.intensity;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, hexA(b.c, 0.45));
    g.addColorStop(1, hexA(b.c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  ctx.globalCompositeOperation = "source-over";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VisualizerItem({ item }: { item: BlockItem; upd: Upd; collapsed?: boolean; isFinished?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const [flo, fhi] = focusBins(item.visualizerFreqFocus ?? "full", 48000, FFT_SIZE / 2);
  const paramsRef = useRef<Params>({ effect: "bars", color: "#d59ee8", color2: "#48cfa6", speed: 1, intensity: 1, bg: "#0d0e11", bgType: "color", bgOpacity: 1, glow: true, trails: false, barRounded: true, freqLo: flo, freqHi: fhi });
  paramsRef.current = {
    effect: item.visualizerEffect ?? "bars",
    color: item.visualizerColor || "#d59ee8",
    color2: item.visualizerColor2 || "#48cfa6",
    speed: item.visualizerSpeed ?? 1,
    intensity: item.visualizerIntensity ?? 1,
    bg: item.visualizerBgColor ?? "#0d0e11",
    bgType: item.visualizerBgType ?? "color",
    bgOpacity: item.visualizerBgOpacity ?? 1,
    glow: item.visualizerGlow !== false,
    trails: !!item.visualizerTrails,
    barRounded: item.visualizerBarRounded !== false,
    freqLo: flo,
    freqHi: fhi,
  };
  const source = item.visualizerAudioSource ?? (item.visualizerMic ? "mic" : "off");

  // Background image loader
  useEffect(() => {
    if (item.visualizerBgType === "image" && item.visualizerBgImage) {
      const img = new Image();
      img.onload = () => { bgImgRef.current = img; };
      img.src = item.visualizerBgImage;
    } else {
      bgImgRef.current = null;
    }
  }, [item.visualizerBgType, item.visualizerBgImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0, cancelled = false;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let freqData: Uint8Array<ArrayBuffer> | null = null;
    let timeData: Uint8Array<ArrayBuffer> | null = null;
    let drops: Drop[] = [];
    let particles: Particle[] = [];
    let stars: Star3[] = [];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    (async () => {
      if (source === "off") return;
      try {
        if (source === "system") {
          const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          s.getVideoTracks().forEach((t) => t.stop());
          stream = new MediaStream(s.getAudioTracks());
          if (stream.getAudioTracks().length === 0) throw new Error("no system audio track");
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new AC();
        // A fresh context often starts suspended (autoplay policy) → analyser
        // returns all zeros until resumed. Resume so audio actually flows.
        await audioCtx.resume().catch(() => {});
        const srcNode = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024; // longer time-domain window → smoother, more-structured waveform
        analyser.smoothingTimeConstant = 0.75;
        srcNode.connect(analyser);
        freqData = new Uint8Array(analyser.frequencyBinCount);
        timeData = new Uint8Array(analyser.fftSize);
      } catch { /* denied / unavailable → procedural fallback */ }
    })();

    const start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const p = paramsRef.current;
      const r = canvas.getBoundingClientRect();
      const w = r.width, h = r.height;
      if (w < 2 || h < 2) return;
      const t = ((now - start) / 1000) * p.speed;

      let audioFreq: number[] | null = null; // 0..1 spectrum (bars, radial)
      let audioWave: number[] | null = null; // -1..1 time-domain (waveform)
      if (analyser && freqData && timeData) {
        // Re-resume if the context got suspended (e.g. after a tab switch).
        if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume().catch(() => {});
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);
        // Full spectrum (0..1); bars/radial map it to log-spaced bands themselves.
        audioFreq = Array.from(freqData, (v) => v / 255);
        audioWave = Array.from(timeData, (v) => (v - 128) / 128);
      }

      // ── Background (with optional motion trails) ──
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      const img = bgImgRef.current;
      if (p.bgType === "image" && img) {
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = p.bgOpacity;
        drawCover(ctx, img, w, h);
        ctx.globalAlpha = 1;
      } else if (p.bgType === "transparent") {
        if (p.trails) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.fillStyle = "rgba(0,0,0,0.12)";
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.clearRect(0, 0, w, h);
        }
      } else {
        ctx.fillStyle = p.trails ? hexA(p.bg, 0.18) : p.bg;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Glow ──
      if (p.glow && p.effect !== "aurora") { ctx.shadowBlur = 14; ctx.shadowColor = p.color; }
      else { ctx.shadowBlur = 0; }

      switch (p.effect) {
        case "radial": drawRadial(ctx, w, h, t, p, audioFreq); break;
        case "wave": drawWave(ctx, w, h, t, p, audioWave); break;
        case "rain": drops = drawRain(ctx, w, h, p, drops); break;
        case "particles": particles = drawParticles(ctx, w, h, t, p, particles); break;
        case "starfield": stars = drawStarfield(ctx, w, h, p, stars); break;
        case "aurora": drawAurora(ctx, w, h, t, p); break;
        default: drawBars(ctx, w, h, t, p, audioFreq); break;
      }
      ctx.shadowBlur = 0;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close().catch(() => {});
    };
  }, [source]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[inherit]" onPointerDown={(e) => e.stopPropagation()}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

// ─── Style panel ──────────────────────────────────────────────────────────────

export function VisualizerStylePanel({ item, upd }: { item: BlockItem; upd: Upd }) {
  const SLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{children}</div>
  );
  const effect = item.visualizerEffect ?? "bars";
  const isAudio = VISUALIZER_EFFECTS.find((e) => e.id === effect)?.audio;
  const accent = item.visualizerColor || "#d59ee8";
  const curSource = item.visualizerAudioSource ?? (item.visualizerMic ? "mic" : "off");
  const isDesktop = typeof window !== "undefined" && !!window.electron;
  const bgType = item.visualizerBgType ?? "color";

  const Slider = ({ label, value, min, max, step, onChange, fmt }: {
    label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string;
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 w-20 cursor-pointer" style={{ accentColor: accent }} />
        <span className="w-8 text-right tabular-nums text-[var(--text-muted)]">{fmt ? fmt(value) : value}</span>
      </div>
    </div>
  );
  const Color = ({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string) => void }) => (
    <div className="flex items-center justify-between">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <input type="color" value={value || fallback} onChange={(e) => onChange(e.target.value)} className="h-6 w-10 cursor-pointer rounded border-0 p-0" />
    </div>
  );
  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={cn("h-4 w-8 rounded-full transition-colors", on ? "bg-[var(--accent)]" : "bg-[var(--surface-overlay)]")}>
      <div className={cn("mx-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0")} />
    </button>
  );

  return (
    <div className="flex flex-col gap-0 divide-y divide-[var(--border)] text-xs">
      <section className="p-3">
        <SLabel>Effect</SLabel>
        <div className="grid grid-cols-2 gap-1.5">
          {VISUALIZER_EFFECTS.map((e) => {
            const Icon = e.icon;
            return (
              <button key={e.id} onClick={() => upd({ visualizerEffect: e.id })}
                className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition-colors",
                  effect === e.id ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]")}>
                <Icon size={13} /> {e.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="p-3">
        <SLabel>Colors</SLabel>
        <div className="flex flex-col gap-2">
          <Color label="Primary" value={item.visualizerColor} fallback="#d59ee8" onChange={(v) => upd({ visualizerColor: v })} />
          <Color label="Secondary" value={item.visualizerColor2} fallback="#48cfa6" onChange={(v) => upd({ visualizerColor2: v })} />
        </div>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]"><Sun size={12} /> Glow</span>
            <Toggle on={item.visualizerGlow !== false} onClick={() => upd({ visualizerGlow: !(item.visualizerGlow !== false) })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]"><Wand2 size={12} /> Motion trails</span>
            <Toggle on={!!item.visualizerTrails} onClick={() => upd({ visualizerTrails: !item.visualizerTrails })} />
          </div>
          {effect === "bars" && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-secondary)]">Rounded bars</span>
              <Toggle on={item.visualizerBarRounded !== false} onClick={() => upd({ visualizerBarRounded: !(item.visualizerBarRounded !== false) })} />
            </div>
          )}
        </div>
      </section>

      <section className="p-3">
        <SLabel>Background</SLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "color", label: "Color" },
            { id: "transparent", label: "Transparent" },
            { id: "image", label: "Image" },
          ].map((b) => (
            <button key={b.id} onClick={() => upd({ visualizerBgType: b.id })}
              className={cn("rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                bgType === b.id ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]")}>
              {b.label}
            </button>
          ))}
        </div>
        {bgType === "color" && (
          <div className="mt-2"><Color label="Background" value={item.visualizerBgColor} fallback="#0d0e11" onChange={(v) => upd({ visualizerBgColor: v })} /></div>
        )}
        {bgType === "transparent" && (
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">Shows the board (or block) behind the effect — great with Glow + trails.</p>
        )}
        {bgType === "image" && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[var(--text-secondary)]"><ImageIcon size={12} /> Image</span>
              <div className="flex items-center gap-1.5">
                {item.visualizerBgImage && (
                  <button onClick={() => upd({ visualizerBgImage: undefined })} className="text-[11px] text-[var(--text-muted)] hover:text-red-400">Remove</button>
                )}
                <label className="cursor-pointer rounded border border-[var(--border)] bg-[var(--surface-overlay)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text-primary)]">
                  {item.visualizerBgImage ? "Replace" : "Upload"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) applyImageUpload(f, (url) => upd({ visualizerBgImage: url })); e.currentTarget.value = ""; }} />
                </label>
              </div>
            </div>
            <Slider label="Image opacity" value={item.visualizerBgOpacity ?? 1} min={0.1} max={1} step={0.05} onChange={(v) => upd({ visualizerBgOpacity: v })} fmt={(v) => `${Math.round(v * 100)}%`} />
          </div>
        )}
      </section>

      <section className="p-3">
        <SLabel>Motion</SLabel>
        <div className="flex flex-col gap-2">
          <Slider label="Speed" value={item.visualizerSpeed ?? 1} min={0.25} max={3} step={0.05} onChange={(v) => upd({ visualizerSpeed: v })} fmt={(v) => `${v.toFixed(2)}x`} />
          <Slider label="Intensity" value={item.visualizerIntensity ?? 1} min={0.25} max={2} step={0.05} onChange={(v) => upd({ visualizerIntensity: v })} fmt={(v) => `${v.toFixed(2)}x`} />
        </div>
      </section>

      <section className="p-3">
        <SLabel>Audio source</SLabel>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "off", label: "Off" },
            { id: "mic", label: "Mic" },
            { id: "system", label: "System" },
          ].map((s) => (
            <button key={s.id} onClick={() => upd({ visualizerAudioSource: s.id, visualizerMic: undefined })}
              className={cn("rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                curSource === s.id ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]")}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <Mic size={10} />
          {!isAudio
            ? "This effect is decorative — audio only drives Bars, Radial & Waveform."
            : curSource === "system"
              ? (isDesktop ? "Visualizes whatever's playing on your PC (system loopback)." : "Browser will ask to share a tab/screen with audio.")
              : curSource === "mic"
                ? "Reacts to your microphone."
                : "Smooth procedural motion (no audio)."}
        </p>

        {(effect === "bars" || effect === "radial") && (
          <div className="mt-3">
            <SLabel>Frequency focus</SLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: "full", label: "Full" },
                { id: "vocal", label: "Vocals" },
                { id: "bass", label: "Bass" },
              ].map((f) => {
                const cur = item.visualizerFreqFocus ?? "full";
                return (
                  <button key={f.id} onClick={() => upd({ visualizerFreqFocus: f.id })}
                    className={cn("rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                      cur === f.id ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]")}>
                    {f.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">“Vocals” fills the bars with voices & melodic mids (120 Hz–6 kHz).</p>
          </div>
        )}
      </section>
    </div>
  );
}
