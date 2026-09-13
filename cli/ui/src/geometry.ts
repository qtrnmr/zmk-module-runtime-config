import type { LayoutKey } from "./types";

/** px per 1/100 of a key unit. */
export const UNIT = 0.6;

export interface KeyBox {
  pos: number;
  x: number;
  y: number;
  w: number;
  h: number;
  deg: number;
  cx: number;
  cy: number;
}

export function toBoxes(keys: LayoutKey[]): KeyBox[] {
  return keys.map((k) => {
    const hasOrigin = k.rx !== 0 || k.ry !== 0;
    return {
      pos: k.pos,
      x: k.x * UNIT,
      y: k.y * UNIT,
      w: k.w * UNIT,
      h: k.h * UNIT,
      deg: k.r / 100,
      cx: (hasOrigin ? k.rx : k.x) * UNIT,
      cy: (hasOrigin ? k.ry : k.y) * UNIT,
    };
  });
}

function rot(px: number, py: number, cx: number, cy: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

export function bounds(boxes: KeyBox[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const b of boxes) {
    const corners: [number, number][] = [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [b.x, b.y + b.h],
      [b.x + b.w, b.y + b.h],
    ];
    for (const [px, py] of corners) {
      const [x, y] = rot(px, py, b.cx, b.cy, b.deg);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}
