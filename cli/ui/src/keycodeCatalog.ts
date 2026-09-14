/**
 * Every keycode the firmware knows, folded into the handful of shelves a
 * person actually browses by.
 *
 * The drawn keyboard can only offer the ~110 keys a full-size board has caps
 * for; the device reports 371 names. This is the other 260 — the shifted
 * symbols, F13–F24, the rest of the keypad, media, the application-launch and
 * application-control keys, and the international block.
 *
 * Two rules make the list honest rather than merely long:
 *
 *  - Keyed by VALUE, not by name. Several names can share one usage, and the
 *    server's reverse map reports the shortest of them (state.py's
 *    reverse_keycodes sorts by (length, name) and keeps the first), so the
 *    catalog picks the same representative and hangs the other spellings off
 *    it as `aliases`. Showing `LANG1` and `LANGUAGE_1` as two different keys
 *    would be a lie about the board.
 *  - Total. Every name lands in exactly one category; anything the rules below
 *    do not claim falls into その他 rather than disappearing, and
 *    keycodeCatalog.test.ts fails if a single name goes missing.
 */

export interface CatalogEntry {
  /** The shortest name for this value — what /api/state reports back. */
  name: string;
  /** Other spellings of the same value, shortest first. Usually empty. */
  aliases: string[];
  value: number;
}

export interface CatalogSection {
  category: string;
  entries: CatalogEntry[];
}

export const CAT_SYMBOL = "記号";
export const CAT_FUNCTION = "ファンクション";
export const CAT_KEYPAD = "テンキー";
export const CAT_MEDIA = "メディア";
export const CAT_APP = "アプリ・OS 操作";
export const CAT_INTL = "言語・国際";
export const CAT_OTHER = "その他";

/** Shelf order in the UI. その他 is last and only appears when it has entries. */
export const CATEGORY_ORDER = [
  CAT_SYMBOL,
  CAT_FUNCTION,
  CAT_KEYPAD,
  CAT_MEDIA,
  CAT_APP,
  CAT_INTL,
  CAT_OTHER,
] as const;

/**
 * Punctuation, listed rather than pattern-matched: the names give no hint
 * (`ATSN`, `CRRT`, `LABT`), so a rule would either miss them or drag letters
 * in. Both the plain and the shifted spelling of each character are here.
 */
const SYMBOLS = new Set([
  "AMPS", "APOSTROPHE", "ASTRK", "ATSN", "BSLH", "CMMA", "COLN", "CRRT", "DLLR", "DOT",
  "DQT", "EQL", "EXCL", "FSLH", "GRAV", "GT", "HASH", "LABT", "LBKT", "LBRC", "LPAR",
  "MINUS", "NON_US_BSLH", "NUHS", "PIPE", "PIPE2", "PLUS", "PRCNT", "QMARK", "RBKT",
  "RBRC", "RPAR", "SEMI", "TILD", "TILDE2", "UNDER",
]);

/**
 * Consumer-page keys that are about the machine rather than about playback.
 * Everything else on that page falls through to メディア, so these are named
 * one by one instead of guessed at from the prefix.
 */
const SYSTEM_CONSUMER = new Set([
  "C_PWR", "C_SLEEP", "C_SLEEP_MODE", "C_RESET", "C_QUIT", "C_HELP", "C_VOICE_COMMAND",
]);

function category(name: string): string {
  if (SYMBOLS.has(name)) return CAT_SYMBOL;
  if (/^F\d+$/.test(name)) return CAT_FUNCTION;
  if (name.startsWith("KP_") || name === "KPLS") return CAT_KEYPAD;
  // Input assist is the IME candidate list, so it belongs with the language
  // keys and not with the rest of the consumer page.
  if (name.startsWith("C_KBIA_")) return CAT_INTL;
  if (/^(LANG|LANGUAGE_|INT|INTERNATIONAL_)\d+$/.test(name)) return CAT_INTL;
  if (name.startsWith("INT_") || name === "GLOBE") return CAT_INTL;
  if (name.startsWith("C_AL_") || name.startsWith("C_AC_")) return CAT_APP;
  if (SYSTEM_CONSUMER.has(name)) return CAT_APP;
  if (name.startsWith("K_") || name.startsWith("SYS_")) return CAT_APP;
  if (name.startsWith("C_") || name.startsWith("M_")) return CAT_MEDIA;
  return CAT_OTHER;
}

/** Shortest first, then alphabetical — state.py's reverse_keycodes exactly. */
function byShortest(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

/** `F2` before `F10`, `KP_N9` before `KP_N10`: digits compare as numbers. */
function natural(a: string, b: string): number {
  const ax = a.match(/\d+|\D+/g) ?? [];
  const bx = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(ax.length, bx.length); i++) {
    const [x, y] = [ax[i], bx[i]];
    if (x === y) continue;
    const n = /^\d/.test(x) && /^\d/.test(y);
    return n ? Number(x) - Number(y) : x < y ? -1 : 1;
  }
  return ax.length - bx.length;
}

/**
 * Group `state.keycodes` into the browsable shelves, one entry per distinct
 * value. Empty categories are dropped, so a firmware without the consumer page
 * simply shows fewer shelves.
 */
export function catalog(keycodes: Record<string, number>): CatalogSection[] {
  const byValue = new Map<number, string[]>();
  for (const name of Object.keys(keycodes)) {
    const v = keycodes[name];
    const names = byValue.get(v);
    if (names) names.push(name);
    else byValue.set(v, [name]);
  }

  const sections = new Map<string, CatalogEntry[]>(CATEGORY_ORDER.map((c) => [c, []]));
  for (const [value, names] of byValue) {
    const [name, ...aliases] = [...names].sort(byShortest);
    sections.get(category(name))!.push({ name, aliases, value });
  }

  return [...sections.entries()]
    .filter(([, entries]) => entries.length)
    .map(([cat, entries]) => ({
      category: cat,
      entries: entries.sort((a, b) => natural(a.name, b.name)),
    }));
}
