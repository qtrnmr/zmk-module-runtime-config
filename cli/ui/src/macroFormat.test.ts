import { describe, expect, it } from "vitest";
import { stepPreview } from "./macroFormat";
import type { MacroStep } from "./types";

const step = (o: Partial<MacroStep>): MacroStep => ({
  type: 0,
  keycode: 0,
  wait_ms: 0,
  tap_ms: 0,
  ...o,
});

describe("stepPreview", () => {
  it("marks an empty slot", () => {
    expect(stepPreview([])).toBe("(空)");
  });

  it("renders a tap with its wait", () => {
    expect(stepPreview([step({ type: 0, keycode: 4, label: "A", wait_ms: 80 })])).toBe("A 80ms");
  });

  it("renders a press/release chord", () => {
    expect(
      stepPreview([
        step({ type: 1, label: "GLOBE", wait_ms: 80 }),
        step({ type: 1, label: "LC(A)", wait_ms: 120 }),
        step({ type: 2, label: "LC(A)", wait_ms: 40 }),
        step({ type: 2, label: "GLOBE" }),
      ]),
    ).toBe("GLOBE↓ 80ms · ^A↓ 120ms · ^A↑ 40ms · GLOBE↑");
  });

  it("shortens names the same way the key caps do", () => {
    // LEFT prints as ← on a key cap, so it does here too: one display
    // convention across the page, even next to the ↓/↑ step markers.
    expect(stepPreview([step({ type: 1, label: "LEFT" })])).toBe("←↓");
  });

  it("prettifies the canonical name and falls back to the raw keycode", () => {
    expect(stepPreview([step({ label: "SPC" })])).toBe("␣");
    expect(stepPreview([step({ keycode: 458756 })])).toBe("458756");
  });
});
