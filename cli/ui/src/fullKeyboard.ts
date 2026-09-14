/**
 * A full-size keyboard drawn as a table, so a keycode can be picked by
 * pointing at the key instead of knowing that "'" is spelled `APOSTROPHE`.
 *
 * `code` is the canonical name the device reports — and `zmk_studio_api`'s
 * Keycode enum uses the SHORTEST alias, so the spellings here are `GRAV`,
 * `EQL`, `CLCK`, `LEFT_META`, `NUM_1`, `KPLS`, `LANGUAGE_1`, not the ZMK doc
 * ones. fullKeyboard.test.ts checks every one of them against a dump of that
 * enum, so a wrong guess fails the suite rather than showing a dead key.
 *
 * `w` is the key's width in 1u units (default 1); an empty `code` is a spacer.
 */
export interface FullKey {
  label: string;
  /** Canonical keycode name; "" for a gap in the row. */
  code: string;
  w?: number;
  /** What the ⇧ toggle turns this cap into, when Shift changes the character. */
  shifted?: ShiftedKey;
}

export interface ShiftedKey {
  label: string;
  code: string;
}

/**
 * Base keycode -> the dedicated keycode for the character Shift prints.
 *
 * These are not "the key plus a Shift toggle": ZMK ships one keycode per
 * shifted symbol and bakes the LS bit into its value (`PLUS` is literally
 * `0x0207002E`, i.e. `EQL` with `0x02 << 24` set), which is what makes `+`
 * pickable at all. Letters are left out on purpose — upper case is the LS
 * toggle's job, not a separate keycode.
 *
 * Spellings are the SHORTEST alias again, so `ATSN` not `AT`, `CRRT` not
 * `CARET`, `ASTRK` not `STAR`, `COLN` not `COLON`, `LABT` not `LT`, `TILD`
 * not `TILDE`; fullKeyboard.test.ts checks each one against the enum dump.
 */
export const SHIFTED: Record<string, ShiftedKey> = {
  GRAV: { label: "~", code: "TILD" },
  NUM_1: { label: "!", code: "EXCL" },
  NUM_2: { label: "@", code: "ATSN" },
  NUM_3: { label: "#", code: "HASH" },
  NUM_4: { label: "$", code: "DLLR" },
  NUM_5: { label: "%", code: "PRCNT" },
  NUM_6: { label: "^", code: "CRRT" },
  NUM_7: { label: "&", code: "AMPS" },
  NUM_8: { label: "*", code: "ASTRK" },
  NUM_9: { label: "(", code: "LPAR" },
  NUM_0: { label: ")", code: "RPAR" },
  MINUS: { label: "_", code: "UNDER" },
  EQL: { label: "+", code: "PLUS" },
  LBKT: { label: "{", code: "LBRC" },
  RBKT: { label: "}", code: "RBRC" },
  BSLH: { label: "|", code: "PIPE" },
  SEMI: { label: ":", code: "COLN" },
  APOSTROPHE: { label: '"', code: "DQT" },
  CMMA: { label: "<", code: "LABT" },
  DOT: { label: ">", code: "GT" },
  FSLH: { label: "?", code: "QMARK" },
};

export interface FullSection {
  name: string;
  rows: FullKey[][];
}

const k = (label: string, code: string, w?: number): FullKey => ({
  label,
  code,
  w,
  shifted: SHIFTED[code],
});
/** A gap inside a row, e.g. between Esc and F1. */
const gap = (w: number): FullKey => ({ label: "", code: "", w });

const FN_ROW: FullKey[] = [
  k("Esc", "ESC"),
  gap(1),
  k("F1", "F1"),
  k("F2", "F2"),
  k("F3", "F3"),
  k("F4", "F4"),
  gap(0.5),
  k("F5", "F5"),
  k("F6", "F6"),
  k("F7", "F7"),
  k("F8", "F8"),
  gap(0.5),
  k("F9", "F9"),
  k("F10", "F10"),
  k("F11", "F11"),
  k("F12", "F12"),
];

const MAIN: FullKey[][] = [
  [
    k("`", "GRAV"),
    k("1", "NUM_1"),
    k("2", "NUM_2"),
    k("3", "NUM_3"),
    k("4", "NUM_4"),
    k("5", "NUM_5"),
    k("6", "NUM_6"),
    k("7", "NUM_7"),
    k("8", "NUM_8"),
    k("9", "NUM_9"),
    k("0", "NUM_0"),
    k("-", "MINUS"),
    k("=", "EQL"),
    k("⌫", "BSPC", 2),
  ],
  [
    k("Tab", "TAB", 1.5),
    k("Q", "Q"),
    k("W", "W"),
    k("E", "E"),
    k("R", "R"),
    k("T", "T"),
    k("Y", "Y"),
    k("U", "U"),
    k("I", "I"),
    k("O", "O"),
    k("P", "P"),
    k("[", "LBKT"),
    k("]", "RBKT"),
    k("\\", "BSLH", 1.5),
  ],
  [
    k("Caps", "CLCK", 1.75),
    k("A", "A"),
    k("S", "S"),
    k("D", "D"),
    k("F", "F"),
    k("G", "G"),
    k("H", "H"),
    k("J", "J"),
    k("K", "K"),
    k("L", "L"),
    k(";", "SEMI"),
    k("'", "APOSTROPHE"),
    k("↵", "ENTER", 2.25),
  ],
  [
    k("Shift", "LSHIFT", 2.25),
    k("Z", "Z"),
    k("X", "X"),
    k("C", "C"),
    k("V", "V"),
    k("B", "B"),
    k("N", "N"),
    k("M", "M"),
    k(",", "CMMA"),
    k(".", "DOT"),
    k("/", "FSLH"),
    k("Shift", "RSHIFT", 2.75),
  ],
  [
    k("Ctrl", "LCTRL", 1.25),
    k("Win", "LEFT_META", 1.25),
    k("Alt", "LALT", 1.25),
    k("Space", "SPC", 6.25),
    k("Alt", "RALT", 1.25),
    k("Win", "RIGHT_META", 1.25),
    k("Menu", "K_APPLICATION", 1.25),
    k("Ctrl", "RCTRL", 1.25),
  ],
];

const NAV: FullKey[][] = [
  // PrtSc / ScrLk / Pause sit above the nav cluster on a real board, which is
  // what keeps the function row exactly as wide as the main block.
  [k("PrtSc", "PSCRN"), k("ScrLk", "SLCK"), k("Pause", "PAUS")],
  [k("Ins", "INS"), k("Home", "HOME"), k("PgUp", "PG_UP")],
  [k("Del", "DEL"), k("End", "END"), k("PgDn", "PG_DN")],
  [gap(1), k("↑", "UARW"), gap(1)],
  [k("←", "LEFT"), k("↓", "DOWN"), k("→", "RIGHT")],
];

const NUMPAD: FullKey[][] = [
  [k("NumLk", "KP_NLCK"), k("÷", "KP_SLASH"), k("×", "KP_MULTIPLY"), k("−", "KP_MINUS")],
  [k("7", "KP_N7"), k("8", "KP_N8"), k("9", "KP_N9"), k("+", "KPLS")],
  [k("4", "KP_N4"), k("5", "KP_N5"), k("6", "KP_N6"), k("=", "KP_EQUAL")],
  [k("1", "KP_N1"), k("2", "KP_N2"), k("3", "KP_N3"), k("↵", "KP_ENTER")],
  [k("0", "KP_N0", 2), k(".", "KP_DOT"), k(",", "KP_COMMA")],
];

const MEDIA: FullKey[][] = [
  [
    k("Mute", "K_MUTE", 1.5),
    k("Vol-", "C_VOL_DN", 1.5),
    k("Vol+", "C_VOL_UP", 1.5),
    k("Play", "K_PP", 1.5),
    k("Next", "K_NEXT", 1.5),
    k("Prev", "K_PREV", 1.5),
    k("明るさ+", "C_BRI_INC", 2),
    k("明るさ-", "C_BRI_DEC", 2),
  ],
];

const JIS: FullKey[][] = [
  [
    k("かな", "LANGUAGE_1", 1.5),
    k("英数", "LANGUAGE_2", 1.5),
    k("変換", "INT_HENKAN", 1.5),
    k("無変換", "INT_MUHENKAN", 1.75),
    k("半角/全角", "LANGUAGE_5", 2),
    k("Caps", "CLCK", 1.5),
    k("GLOBE", "GLOBE", 1.75),
  ],
];

/** The picker draws these in order; nav and numpad sit beside the main block. */
export const FULL_KEYBOARD: FullSection[] = [
  { name: "ファンクション", rows: [FN_ROW] },
  { name: "メイン", rows: MAIN },
  { name: "ナビ", rows: NAV },
  { name: "テンキー", rows: NUMPAD },
  { name: "メディア", rows: MEDIA },
  { name: "日本語・その他", rows: JIS },
];

/** The two caps the ⇧ toggle hangs off: clicking either flips the whole board
 *  instead of committing a keycode. */
export const SHIFT_CODES = ["LSHIFT", "RSHIFT"];

/** Every key on the table, spacers dropped. */
export const FULL_KEYBOARD_KEYS: FullKey[] = FULL_KEYBOARD.flatMap((s) =>
  s.rows.flat().filter((key) => key.code !== ""),
);
