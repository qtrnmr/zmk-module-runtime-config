import { describe, expect, it } from "vitest";
import { FULL_KEYBOARD, FULL_KEYBOARD_KEYS, SHIFTED, SHIFT_CODES } from "./fullKeyboard";
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

  it("only names keycodes the device can report for the ⇧ layer too", () => {
    const unknown = Object.values(SHIFTED)
      .map((s) => s.code)
      .filter((c) => !known.has(c));
    expect(unknown).toEqual([]);
    for (const base of Object.keys(SHIFTED)) expect(known, base).toContain(base);
  });

  it("gives the ⇧ layer the 21 symbols a US board prints above the number row", () => {
    expect(Object.entries(SHIFTED).map(([base, s]) => `${base}->${s.code}`)).toEqual([
      "GRAV->TILD", "NUM_1->EXCL", "NUM_2->ATSN", "NUM_3->HASH", "NUM_4->DLLR",
      "NUM_5->PRCNT", "NUM_6->CRRT", "NUM_7->AMPS", "NUM_8->ASTRK", "NUM_9->LPAR",
      "NUM_0->RPAR", "MINUS->UNDER", "EQL->PLUS", "LBKT->LBRC", "RBKT->RBRC",
      "BSLH->PIPE", "SEMI->COLN", "APOSTROPHE->DQT", "CMMA->LABT", "DOT->GT",
      "FSLH->QMARK",
    ]);
    // Letters stay alone: upper case is the LS toggle's job.
    for (const c of "QWERTYUIOPASDFGHJKLZXCVBNM") expect(SHIFTED[c], c).toBeUndefined();
  });

  it("hangs the ⇧ toggle off caps that are on the board", () => {
    const codes = new Set(FULL_KEYBOARD_KEYS.map((k) => k.code));
    for (const c of SHIFT_CODES) expect(codes, c).toContain(c);
    // Every base in SHIFTED is drawn, and its cap carries the shifted twin.
    for (const base of Object.keys(SHIFTED)) {
      const cap = FULL_KEYBOARD_KEYS.find((k) => k.code === base);
      expect(cap, base).toBeDefined();
      expect(cap!.shifted, base).toEqual(SHIFTED[base]);
    }
  });

  it("keeps every row the same width, so the caps line up", () => {
    for (const sec of FULL_KEYBOARD) {
      const widths = sec.rows.map((r) => r.reduce((s, key) => s + (key.w ?? 1), 0));
      if (sec.name === "メイン") expect(new Set(widths).size, sec.name).toBe(1);
      for (const w of widths) expect(w, sec.name).toBeGreaterThan(0);
    }
  });
});
