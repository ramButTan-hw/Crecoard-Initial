import type { Modifier } from "@dnd-kit/core";
import { SNAP_UNIT } from "./boardConstants";

export function createSnapToGrid(zoom: number): Modifier {
  return ({ transform }) => ({
    ...transform,
    x: Math.round(transform.x / zoom / SNAP_UNIT) * SNAP_UNIT * zoom,
    y: Math.round(transform.y / zoom / SNAP_UNIT) * SNAP_UNIT * zoom,
  });
}
