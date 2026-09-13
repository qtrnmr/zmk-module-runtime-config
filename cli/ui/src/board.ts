import type { KeyBox } from "./geometry";
import type { ComboEntry, Encoder, EncoderLayer, HoldtapSlot } from "./types";

/** Centre of a cap after its rotation (matches the SVG `rotate(deg cx cy)`). */
export function keyCenter(b: KeyBox): [number, number] {
  const px = b.x + b.w / 2;
  const py = b.y + b.h / 2;
  const a = (b.deg * Math.PI) / 180;
  const dx = px - b.cx;
  const dy = py - b.cy;
  return [b.cx + dx * Math.cos(a) - dy * Math.sin(a), b.cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** The polyline through a combo's keys (in combo order) and its centroid.
 *  Positions the layout does not have are skipped. */
export function comboPath(entry: ComboEntry, boxes: KeyBox[]) {
  const byPos = new Map(boxes.map((b) => [b.pos, b]));
  const points = entry.key_positions
    .map((p) => byPos.get(p))
    .filter((b): b is KeyBox => !!b)
    .map(keyCenter);
  const n = points.length || 1;
  const centroid: [number, number] = [
    points.reduce((s, [x]) => s + x, 0) / n,
    points.reduce((s, [, y]) => s + y, 0) / n,
  ];
  return { points, centroid };
}

/** Combos that fire on `layerIndex`: no layer filter, or the filter names it. */
export function activeCombos(entries: ComboEntry[], layerIndex: number): ComboEntry[] {
  return entries.filter((e) => e.layers.length === 0 || e.layers.includes(layerIndex));
}

/** The runtime hold-tap slot owned by `behaviorId` (0 = unknown, never matches). */
export function holdtapSlotFor(slots: HoldtapSlot[], behaviorId: number): HoldtapSlot | undefined {
  if (behaviorId === 0) return undefined;
  return slots.find((s) => s.behavior_id === behaviorId);
}

/** The encoder's cw/ccw pair for one sensor on one layer, if it has one. */
export function encoderLayerBinding(
  encoder: Encoder,
  sensor: number,
  layerIndex: number,
): EncoderLayer | undefined {
  if (!encoder.available) return undefined;
  return encoder.bindings
    .find((b) => b.sensor === sensor)
    ?.layers.find((l) => l.layer === layerIndex);
}
