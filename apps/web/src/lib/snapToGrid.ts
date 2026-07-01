import type { Modifier } from "@dnd-kit/core";
import { GRID_MINOR } from "./boardConstants";

// Magnetic snapping: instead of quantizing every frame (which feels clunky), the
// item moves freely and only "clicks" to a gridline when it comes within
// SNAP_THRESHOLD of one. Hold ⌘/Ctrl to move completely freely.

export const SNAP_STEP = GRID_MINOR;   // snap to the visible minor grid (20px)
export const SNAP_THRESHOLD = 5;       // canvas px within which the pull kicks in

// Global bypass — true while ⌘ or Ctrl is held. Tracked here so both the dnd-kit
// modifier and the manual pointer handlers (box/item resize) share one source.
let bypass = false;
if (typeof window !== "undefined") {
  const sync = (e: KeyboardEvent) => { bypass = e.metaKey || e.ctrlKey; };
  window.addEventListener("keydown", sync, true);
  window.addEventListener("keyup", sync, true);
  window.addEventListener("blur", () => { bypass = false; });
}
export function snapBypassed(): boolean {
  return bypass;
}

/** Snap `v` to the nearest gridline only when within threshold (and enabled); else free. */
export function magnetize(v: number, enabled = true): number {
  if (!enabled || bypass) return v;
  const nearest = Math.round(v / SNAP_STEP) * SNAP_STEP;
  return Math.abs(v - nearest) <= SNAP_THRESHOLD ? nearest : v;
}

/** dnd-kit modifier for box dragging — magnetic grid snap in canvas space. */
export function createSnapToGrid(zoom: number, enabled: boolean): Modifier {
  return ({ transform }) => {
    if (!enabled || bypass) return transform;
    return {
      ...transform,
      x: magnetize(transform.x / zoom) * zoom,
      y: magnetize(transform.y / zoom) * zoom,
    };
  };
}
