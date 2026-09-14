import { describe, expect, it } from "vitest";
import {
  activeLayerNames,
  clearLog,
  followIndex,
  initial,
  keycodeText,
  layerIds,
  LOG_LIMIT,
  reduce,
  reverseKeycodes,
  type KeycodeEvent,
  type PracticeCtx,
} from "./practice";
import type { Layer } from "./types";

const KEYCODES: Record<string, number> = {
  A: 0x070004,
  Z: 0x07001d,
  EQL: 0x07002e,
  PLUS: 0x0200002e | 0x070000,
  LSHIFT: 0x0700e1,
  LSHFT: 0x0700e1,
  C_VOL_UP: 0x0c00e9,
  C_VOL_DN: 0x0c00ea,
};
const REV = reverseKeycodes(KEYCODES);
const CTX: PracticeCtx = {
  rev: REV,
  layerNames: { 0: "DEFAULT", 1: "APPLE", 3: "SETTING" },
  capLabels: { 12: "Q", 30: "LANG2" },
};

const kc = (over: Partial<KeycodeEvent>): KeycodeEvent => ({
  type: "keycode",
  usage_page: 0x07,
  keycode: 0x04,
  pressed: true,
  modifiers: 0,
  ...over,
});

const LAYERS: Layer[] = [
  { index: 0, id: 0, name: "DEFAULT", bindings: [] },
  { index: 1, id: 1, name: "APPLE", bindings: [] },
  { index: 2, id: 3, name: "SETTING", bindings: [] },
];

describe("layerIds", () => {
  it("reads a mask as the ids it sets", () => {
    expect(layerIds(0b1011)).toEqual([0, 1, 3]);
    expect(layerIds(0)).toEqual([]);
  });
});

describe("keycodeText", () => {
  it("names a plain keyboard usage", () => {
    expect(keycodeText(kc({ keycode: 0x1d }), REV)).toBe("Z");
  });

  it("gives a shifted symbol its own name rather than LS(EQL)", () => {
    expect(keycodeText(kc({ keycode: 0x2e, modifiers: 0x02 }), REV)).toBe("PLUS");
  });

  it("wraps modifiers it has no single name for", () => {
    // LCTRL + Z has no name of its own
    expect(keycodeText(kc({ keycode: 0x1d, modifiers: 0x01 }), REV)).toBe("LC(Z)");
    expect(keycodeText(kc({ keycode: 0x1d, modifiers: 0x05 }), REV)).toBe("LC(LA(Z))");
  });

  it("does not wrap a modifier key in itself", () => {
    expect(keycodeText(kc({ keycode: 0xe1, modifiers: 0x02 }), REV)).toBe("LSHFT");
  });

  it("names a consumer usage", () => {
    expect(keycodeText(kc({ usage_page: 0x0c, keycode: 0xe9 }), REV)).toBe("C_VOL_UP");
  });

  it("falls back to hex for a usage the device did not name", () => {
    expect(keycodeText(kc({ keycode: 0xfe }), REV)).toBe("0x700FE");
  });
});

describe("reduce", () => {
  it("tracks which positions are held", () => {
    let s = initial();
    s = reduce(s, { type: "key", position: 12, pressed: true, source: 255 }, CTX);
    s = reduce(s, { type: "key", position: 30, pressed: true, source: 1 }, CTX);
    expect([...s.pressed].sort((a, b) => a - b)).toEqual([12, 30]);
    s = reduce(s, { type: "key", position: 12, pressed: false, source: 255 }, CTX);
    expect([...s.pressed]).toEqual([30]);
  });

  it("does not mutate the state it was given", () => {
    const s = initial();
    const next = reduce(s, { type: "key", position: 1, pressed: true, source: 255 }, CTX);
    expect(s.pressed.size).toBe(0);
    expect(next.pressed.size).toBe(1);
  });

  it("logs a key by what its cap says, and by position when it cannot", () => {
    let s = reduce(initial(), { type: "key", position: 12, pressed: true, source: 255 }, CTX);
    expect(s.log.at(-1)!.text).toBe("Q↓");
    s = reduce(s, { type: "key", position: 99, pressed: false, source: 255 }, CTX);
    expect(s.log.at(-1)!.text).toBe("#99↑");
  });

  it("prettifies the cap label the way the board does", () => {
    const s = reduce(initial(), { type: "key", position: 30, pressed: true, source: 255 }, CTX);
    expect(s.log.at(-1)!.text).toBe("英数↓");
  });

  it("takes the whole layer state from a layers event", () => {
    const s = reduce(initial(), { type: "layers", mask: 0b1011, highest: 2, ids: [0, 1, 3] }, CTX);
    expect(s.mask).toBe(0b1011);
    expect(s.highest).toBe(2);
    expect(s.activeIds).toEqual([0, 1, 3]);
    expect(s.log.at(-1)!.text).toBe("→ DEFAULT + APPLE + SETTING");
  });

  it("derives the ids when the event omits them", () => {
    const s = reduce(initial(), { type: "layers", mask: 0b101, highest: 1 } as never, CTX);
    expect(s.activeIds).toEqual([0, 2]);
  });

  it("holds the chord while the keys are down and lets it go on release", () => {
    let s = initial();
    s = reduce(s, { type: "key", position: 12, pressed: true, source: 255 }, CTX);
    s = reduce(s, kc({ keycode: 0x1d }), CTX);
    expect(s.output.map((c) => c.text)).toEqual(["Z"]);
    expect(s.last!.text).toBe("Z");
    s = reduce(s, kc({ keycode: 0x1d, pressed: false }), CTX);
    expect(s.output).toEqual([]);
    expect(s.last!.text).toBe("Z"); // a tap stays readable after the release
  });

  it("calls a keycode with no key held an encoder turn", () => {
    const turn = reduce(initial(), kc({ usage_page: 0x0c, keycode: 0xea }), CTX);
    expect(turn.output[0]).toEqual({ text: "Vol-", encoder: true });
    expect(turn.log.at(-1)!.text).toBe("↻ Vol-↓");

    let typed = reduce(initial(), { type: "key", position: 5, pressed: true, source: 255 }, CTX);
    typed = reduce(typed, kc({ keycode: 0x04 }), CTX);
    expect(typed.output[0]).toEqual({ text: "A", encoder: false });
  });

  it("shows the chord as the characters the board draws", () => {
    let s = reduce(initial(), { type: "key", position: 1, pressed: true, source: 255 }, CTX);
    s = reduce(s, kc({ keycode: 0xe1, modifiers: 0x02 }), CTX);
    s = reduce(s, kc({ keycode: 0x2e, modifiers: 0x02 }), CTX);
    expect(s.output.map((c) => c.text)).toEqual(["Shift", "+"]);
  });

  it("keeps only the last 30 lines", () => {
    let s = initial();
    for (let i = 0; i < 45; i++) {
      s = reduce(s, { type: "key", position: i, pressed: true, source: 255 }, CTX);
    }
    expect(s.log).toHaveLength(LOG_LIMIT);
    expect(s.log[0].text).toBe("#15↓");
    expect(s.log.at(-1)!.text).toBe("#44↓");
    expect(new Set(s.log.map((e) => e.id)).size).toBe(LOG_LIMIT); // keys stay unique
  });

  it("reads with no context at all", () => {
    let s = reduce(initial(), { type: "key", position: 2, pressed: true, source: 255 });
    s = reduce(s, kc({ keycode: 0x04 }));
    expect(s.log.map((e) => e.text)).toEqual(["#2↓", "0x70004↓"]);
  });
});

describe("clearLog", () => {
  it("empties the log and the chord but leaves the board alone", () => {
    let s = reduce(initial(), { type: "layers", mask: 0b1, highest: 0, ids: [0] }, CTX);
    s = reduce(s, { type: "key", position: 3, pressed: true, source: 255 }, CTX);
    s = reduce(s, kc({ keycode: 0x04 }), CTX);
    const cleared = clearLog(s);
    expect(cleared.log).toEqual([]);
    expect(cleared.output).toEqual([]);
    expect(cleared.pressed).toEqual(s.pressed);
    expect(cleared.mask).toBe(0b1);
  });
});

describe("activeLayerNames / followIndex", () => {
  it("names the active layers in board order", () => {
    const s = reduce(initial(), { type: "layers", mask: 0b1001, highest: 2, ids: [0, 3] }, CTX);
    expect(activeLayerNames(s, LAYERS)).toEqual(["DEFAULT", "SETTING"]);
  });

  it("follows the highest active layer, clamped to what exists", () => {
    const s = reduce(initial(), { type: "layers", mask: 0b1001, highest: 2, ids: [0, 3] }, CTX);
    expect(followIndex(s, LAYERS)).toBe(2);
    expect(followIndex({ ...s, highest: 9 }, LAYERS)).toBe(2);
    expect(followIndex(s, [])).toBe(0);
  });
});
