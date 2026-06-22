import type { Modifier } from "@dnd-kit/core";

const GRID = 20;

export const snapToGrid: Modifier = ({ transform }) => ({
  ...transform,
  x: Math.round(transform.x / GRID) * GRID,
  y: Math.round(transform.y / GRID) * GRID,
});
