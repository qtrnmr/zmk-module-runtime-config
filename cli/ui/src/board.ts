import type { KeyBox } from "./geometry";
import { pretty } from "./prettyKeycode";
import type { ComboEntry, Encoder, EncoderLayer, HoldtapSlot, Label, Layer } from "./types";

/** One-line text for a label, for pills and knob captions. */
export function labelText(label: Label | undefined, fallback = "—"): string {
  if (!label) return fallback;
  return "text" in label ? pretty(label.text) : `${pretty(label.hold)}/${pretty(label.tap)}`;
}

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

/** `S+A`: what a combo's keys do on the base layer, for the pill's caption and
 *  for the combo list beside the board. */
export function comboKeysText(entry: ComboEntry, base: Layer | undefined): string {
  return entry.key_positions
    .map((pos) => {
      const l = base?.bindings[pos]?.label;
      if (!l) return "?";
      return "text" in l ? pretty(l.text) : pretty(l.tap);
    })
    .join("+");
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

/** One colour per combo so overlapping chords stay apart; cycles past six. */
export const COMBO_COLORS = ["#fbbf24", "#38bdf8", "#34d399", "#a78bfa", "#fb7185", "#f97316"];

export function comboColor(index: number): string {
  return COMBO_COLORS[((index % COMBO_COLORS.length) + COMBO_COLORS.length) % COMBO_COLORS.length];
}

/** SVG path for a combo ribbon: two keys get one gentle arc (bowed `bow` px
 *  off the straight line so it does not run through the caps' centres);
 *  three or more get a Catmull-Rom spline through every key centre. */
export function ribbonPath(points: [number, number][], bow = 14): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    const [[x1, y1], [x2, y2]] = points;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (x1 + x2) / 2 + (-dy / len) * bow;
    const my = (y1 + y2) / 2 + (dx / len) * bow;
    return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
  }
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
