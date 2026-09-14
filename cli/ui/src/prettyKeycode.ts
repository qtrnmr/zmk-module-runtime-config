/**
 * Shorten the canonical keycode names the server emits into something that fits on a
 * key cap. The server keeps the canonical, grep-able ZMK name (spec 5); prettifying is
 * a pure display concern and lives here.
 *
 * Note: `zmk_studio_api.Keycode` exposes several aliases per usage and the server's
 * reverse map picks the SHORTEST one, so the names that actually arrive are e.g.
 * `CMMA`, `SEMI`, `SPC`, `NUM_1`, `UARW`, `LANGUAGE_2` rather than the spellings used
 * in ZMK docs. Both are mapped.
 */
/** Canonical keycode name -> what the cap shows. Exported so the legend can
 *  list every symbol the board can draw without a second table. */
export const PRETTY_MAP: Record<string, string> = {
  // modifiers
  LCTRL: "Ctrl", RCTRL: "Ctrl", LEFT_CONTROL: "Ctrl", RIGHT_CONTROL: "Ctrl",
  LSHIFT: "Shift", RSHIFT: "Shift", LSHFT: "Shift", RSHFT: "Shift",
  LALT: "Alt", RALT: "Alt", LEFT_ALT: "Alt", RIGHT_ALT: "Alt",
  LGUI: "Gui", RGUI: "Gui", LEFT_META: "Gui", RIGHT_META: "Gui", LEFT_WIN: "Gui",
  // punctuation
  SEMI: ";", SEMICOLON: ";",
  SQT: "'", APOSTROPHE: "'", SINGLE_QUOTE: "'",
  CMMA: ",", COMMA: ",",
  DOT: ".", PERIOD: ".",
  FSLH: "/", SLASH: "/",
  BSLH: "\\", BACKSLASH: "\\",
  MINUS: "-", EQL: "=", EQUAL: "=",
  LBKT: "[", RBKT: "]", LBRC: "{", RBRC: "}", LPAR: "(", RPAR: ")",
  GRAV: "`", GRAVE: "`",
  // The shifted twins are keycodes in their own right (PLUS carries the LS bit
  // in its value), so a cap bound to one has to draw the character it sends
  // rather than the name nobody reads as a symbol.
  EXCL: "!", ATSN: "@", AT: "@", HASH: "#", DLLR: "$", PRCNT: "%",
  CRRT: "^", CARET: "^", AMPS: "&", ASTRK: "*", STAR: "*",
  UNDER: "_", PLUS: "+",
  PIPE: "|", PIPE2: "|",
  COLN: ":", COLON: ":",
  DQT: '"', DOUBLE_QUOTES: '"',
  LABT: "<", LT: "<", GT: ">",
  QMARK: "?", QUESTION: "?",
  TILD: "~", TILDE: "~", TILDE2: "~",
  // editing / whitespace
  BSPC: "⌫", BACKSPACE: "⌫",
  DEL: "Del", DELETE: "Del",
  RET: "⏎", ENTER: "⏎", RETURN: "⏎",
  SPC: "␣", SPACE: "␣",
  TAB: "⇥", ESC: "Esc", ESCAPE: "Esc",
  CAPS: "Caps", CLCK: "Caps",
  // arrows
  UARW: "↑", UP: "↑",
  DARW: "↓", DOWN: "↓",
  LARW: "←", LEFT: "←",
  RARW: "→", RIGHT: "→",
  // media
  C_VOL_UP: "Vol+", C_VOLUME_UP: "Vol+",
  C_VOL_DN: "Vol-", C_VOLUME_DOWN: "Vol-",
  C_MUTE: "Mute", K_MUTE: "Mute", M_MUTE: "Mute",
  // JIS
  LANG1: "かな", LANGUAGE_1: "かな",
  LANG2: "英数", LANGUAGE_2: "英数",
};

/** Modifier prefix -> its glyph, e.g. `LG(TAB)` -> `⌘⇥`. */
export const MOD_WRAP: Record<string, string> = {
  LG: "⌘", RG: "⌘",
  LC: "^", RC: "^",
  LA: "⌥", RA: "⌥",
  LS: "⇧", RS: "⇧",
};

export function pretty(text: string): string {
  const m = /^([LR][GCAS])\((.*)\)$/.exec(text);
  if (m) return MOD_WRAP[m[1]] + pretty(m[2]);
  if (/^N[0-9]$/.test(text)) return text[1];
  if (/^NUM_[0-9]$/.test(text)) return text[4];
  if (/^KP_N[0-9]$/.test(text)) return "KP" + text[4];
  if (/^KP_NUMBER_[0-9]$/.test(text)) return "KP" + text[10];
  return PRETTY_MAP[text] ?? text;
}
