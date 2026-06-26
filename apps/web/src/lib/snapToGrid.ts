import type { Modifier } from "@dnd-kit/core";
import { GRID_MINOR } from "./boardConstants";

/**
 * Zoom-aware snap modifier for dnd-kit.
 * Always snaps to GRID_MINOR px in canvas space, regardless of zoom.
 * Without zoom-awareness, a zoom=0.5 board snaps to 40 canvas px instead of 20.
 */
export function createSnapToGrid(zoom: number): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / zoom / GRID_MINOR) * GRID_MINOR * zoom,
    y: Math.round(transform.y / zoom / GRID_MINOR) * GRID_MINOR * zoom,
  });
}
