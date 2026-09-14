import { describe, expect, it } from "vitest";
import {
  BOARD_ROWS,
  KEY_SYMBOL_ROWS,
  MARK_ROWS,
  MOD_SYMBOL_ROWS,
  TAG_ROWS,
} from "./components/Legend";
import { TAG } from "./components/Keyboard";
import { MOD_WRAP, PRETTY_MAP, pretty } from "./prettyKeycode";

describe("the legend explains everything the board can draw", () => {
  it("lists every symbol pretty() can put on a cap", () => {
    const shown = new Set([...KEY_SYMBOL_ROWS, ...MOD_SYMBOL_ROWS].map((r) => r.symbol));
    const drawn = new Set([...Object.values(PRETTY_MAP), ...Object.values(MOD_WRAP)]);
    expect([...drawn].filter((s) => !shown.has(s))).toEqual([]);
  });

  it("names, for each symbol, keycodes that really pretty() to it", () => {
    for (const r of KEY_SYMBOL_ROWS) {
      expect(r.names.length, r.symbol).toBeGreaterThan(0);
      for (const n of r.names) expect(pretty(n), n).toBe(r.symbol);
      expect(r.meaning, r.symbol).toBeTruthy();
    }
  });

  it("lists every behaviour tag the caps can show, with a Japanese name", () => {
    const shown = new Set(TAG_ROWS.map((r) => r.tag));
    expect([...new Set(Object.values(TAG))].filter((t) => !shown.has(t))).toEqual([]);
    for (const r of TAG_ROWS) {
      expect(r.ja, r.tag).toBeTruthy();
      // A row that only repeated the ZMK name would explain nothing.
      expect(r.ja, r.tag).not.toBe(r.behavior);
    }
  });

  it("explains ▽ and ∅ and the board's own marks", () => {
    const marks = MARK_ROWS.map((r) => r.mark);
    expect(marks).toContain("▽");
    expect(marks).toContain("∅");
    expect(BOARD_ROWS.length).toBeGreaterThan(0);
    for (const r of [...MARK_ROWS, ...BOARD_ROWS]) expect(r.text.length).toBeGreaterThan(0);
  });
});
