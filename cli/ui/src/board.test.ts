import { describe, expect, it } from "vitest";
import { toBoxes, UNIT } from "./geometry";
import { activeCombos, capText, COMBO_COLORS, comboColor, comboPath, holdtapSlotFor, keyCenter, ribbonPath } from "./board";
import type { ComboEntry, HoldtapSlot } from "./types";

const boxes = toBoxes([
  { pos: 0, x: 0, y: 0, w: 100, h: 100, r: 0, rx: 0, ry: 0 },
  { pos: 1, x: 100, y: 0, w: 100, h: 100, r: 0, rx: 0, ry: 0 },
  { pos: 2, x: 0, y: 100, w: 100, h: 100, r: 9000, rx: 0, ry: 100 }, // 90° about its top-left
]);

const combo = (index: number, key_positions: number[], layers: number[]): ComboEntry => ({
  index, key_positions, layers, timeout_ms: 50, require_prior_idle_ms: -1, slow_release: false,
  found: true, binding: { behavior_id: 0, param1: 0, param2: 0 }, dt_binding: null,
  effective: { behavior_id: 8, param1: 41, param2: 0, label: { text: "ESC", behavior: "Key Press" } },
});

describe("capText", () => {
  it("is the tap side of a hold-tap, which is what the cap is printed with", () => {
    expect(capText({ behavior: "Layer-Tap", hold: "SETTING", tap: "LANGUAGE_2" })).toBe("英数");
    expect(capText({ behavior: "Key Press", text: "SPACE" })).toBe("␣");
    expect(capText(undefined)).toBe("?");
    expect(capText(undefined, "—")).toBe("—");
  });
});

describe("keyCenter", () => {
  it("is the rotated centre of the cap", () => {
    expect(keyCenter(boxes[0])).toEqual([50 * UNIT, 50 * UNIT]);
    const [x, y] = keyCenter(boxes[2]);
    expect(x).toBeCloseTo(-50 * UNIT, 3); // 90° about (0,100): centre (50,150) -> (-50,150)
    expect(y).toBeCloseTo(150 * UNIT, 3);
  });
});

describe("comboPath", () => {
  it("returns the key centres in combo order and their centroid", () => {
    const p = comboPath(combo(0, [1, 0], []), boxes);
    expect(p.points).toEqual([[150 * UNIT, 50 * UNIT], [50 * UNIT, 50 * UNIT]]);
    expect(p.centroid).toEqual([100 * UNIT, 50 * UNIT]);
  });
  it("skips positions the layout does not have", () => {
    expect(comboPath(combo(0, [0, 99], []), boxes).points).toHaveLength(1);
  });
});

describe("activeCombos", () => {
  it("keeps combos with no layer filter or the current layer", () => {
    const all = [combo(0, [0, 1], []), combo(1, [0, 1], [2]), combo(2, [0, 1], [3, 4])];
    expect(activeCombos(all, 2).map((c) => c.index)).toEqual([0, 1]);
  });
});

describe("holdtapSlotFor", () => {
  const slots: HoldtapSlot[] = [
    { slot: 0, tapping_term_ms: 200, quick_tap_ms: -1, require_prior_idle_ms: -1, flavor: "balanced", flavor_index: 1, found: true, behavior_id: 35 },
    { slot: 1, tapping_term_ms: 200, quick_tap_ms: -1, require_prior_idle_ms: -1, flavor: "balanced", flavor_index: 1, found: true, behavior_id: 0 },
  ];
  it("finds the slot owned by a behavior id", () => {
    expect(holdtapSlotFor(slots, 35)?.slot).toBe(0);
  });
  it("never matches the unknown id 0", () => {
    expect(holdtapSlotFor(slots, 0)).toBeUndefined();
  });
});

describe("ribbonPath", () => {
  it("arcs two keys with the control point off the straight line", () => {
    // left -> right: the perpendicular (-dy, dx) points +y, so the bow is below
    expect(ribbonPath([[0, 0], [100, 0]], 10)).toBe("M0,0 Q50,10 100,0");
  });
  it("splines three or more keys with one cubic per segment", () => {
    const d = ribbonPath([[0, 0], [50, 20], [100, 0]]);
    expect(d.startsWith("M0,0 C")).toBe(true);
    expect(d.split(" C")).toHaveLength(3);
    expect(d.endsWith(" 100,0")).toBe(true);
  });
  it("is empty for fewer than two points", () => {
    expect(ribbonPath([[1, 1]])).toBe("");
  });
});

describe("comboColor", () => {
  it("cycles through the palette", () => {
    expect(comboColor(0)).toBe(COMBO_COLORS[0]);
    expect(comboColor(COMBO_COLORS.length)).toBe(COMBO_COLORS[0]);
    expect(comboColor(1)).not.toBe(comboColor(2));
  });
});
