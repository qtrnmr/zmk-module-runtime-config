import { describe, expect, it } from "vitest";
import { decorFor } from "./decor";

describe("decorFor", () => {
  it("knows the roBa layout by name and key count", () => {
    const d = decorFor({ name: "Default", keys: new Array(43) });
    expect(d?.encoders).toEqual([{ sensor: 0, cx: 550, cy: 85, r: 45 }]);
    expect(d?.trackball).toEqual({ cx: 925, cy: 387, r: 52 });
  });
  it("returns undefined for an unknown layout", () => {
    expect(decorFor({ name: "Default", keys: new Array(42) })).toBeUndefined();
  });
});
