import { describe, it, expect } from "vitest";
import { toBoxes, bounds, UNIT } from "./geometry";

describe("geometry", () => {
  it("scales and converts rotation", () => {
    const [b] = toBoxes([{ pos: 4, x: 437, y: 350, w: 100, h: 100, r: 1000, rx: 437, ry: 350 }]);
    expect(b).toEqual({
      pos: 4, x: 437 * UNIT, y: 350 * UNIT, w: 100 * UNIT, h: 100 * UNIT,
      deg: 10, cx: 437 * UNIT, cy: 350 * UNIT,
    });
  });

  it("uses key origin when rx/ry are 0", () => {
    const [b] = toBoxes([{ pos: 0, x: 100, y: 12, w: 100, h: 100, r: 0, rx: 0, ry: 0 }]);
    expect([b.cx, b.cy]).toEqual([100 * UNIT, 12 * UNIT]);
  });

  it("bounds include rotated corners", () => {
    const bx = toBoxes([{ pos: 0, x: 0, y: 0, w: 100, h: 100, r: 9000, rx: 0, ry: 0 }]);
    const bb = bounds(bx);
    expect(bb.minX).toBeCloseTo(-100 * UNIT, 3);
    expect(bb.maxY).toBeCloseTo(100 * UNIT, 3);
  });
});
