import { describe, expect, it } from "vitest";
import { FULL_KEYBOARD, FULL_KEYBOARD_KEYS } from "./fullKeyboard";
import { KEYCODE_NAMES } from "./keycodeNames.fixture";

const known = new Set(KEYCODE_NAMES);

describe("the full keyboard picker", () => {
  it("only names keycodes the device can actually report", () => {
    const unknown = FULL_KEYBOARD_KEYS.map((k) => k.code).filter((c) => !known.has(c));
    expect(unknown).toEqual([]);
  });

  it("labels every key it draws", () => {
    for (const key of FULL_KEYBOARD_KEYS) expect(key.label, key.code).toBeTruthy();
  });

  it("has the sections and the keys the picker promises", () => {
    expect(FULL_KEYBOARD.map((s) => s.name)).toEqual([
      "ファンクション",
      "メイン",
      "ナビ",
      "テンキー",
      "メディア",
      "日本語・その他",
    ]);
    const codes = new Set(FULL_KEYBOARD_KEYS.map((k) => k.code));
    for (const c of [
      "ESC", "F12", "SPC", "BSPC", "ENTER", "LSHIFT", "RCTRL", "K_APPLICATION",
      "UARW", "DOWN", "LEFT", "RIGHT", "PG_UP", "PG_DN",
      "KP_NLCK", "KP_SLASH", "KP_MULTIPLY", "KP_MINUS", "KPLS", "KP_ENTER", "KP_N0", "KP_DOT",
      "K_MUTE", "C_VOL_DN", "C_VOL_UP", "C_BRI_INC", "C_BRI_DEC",
      "LANGUAGE_1", "LANGUAGE_2", "INT_HENKAN", "INT_MUHENKAN", "GLOBE",
    ])
      expect(codes, c).toContain(c);
    // Q..P and the digits are all there.
    for (const c of "QWERTYUIOPASDFGHJKLZXCVBNM") expect(codes, c).toContain(c);
    for (let n = 0; n <= 9; n++) expect(codes).toContain(`NUM_${n}`);
  });

  it("keeps every row the same width, so the caps line up", () => {
    for (const sec of FULL_KEYBOARD) {
      const widths = sec.rows.map((r) => r.reduce((s, key) => s + (key.w ?? 1), 0));
      if (sec.name === "メイン") expect(new Set(widths).size, sec.name).toBe(1);
      for (const w of widths) expect(w, sec.name).toBeGreaterThan(0);
    }
  });
});
