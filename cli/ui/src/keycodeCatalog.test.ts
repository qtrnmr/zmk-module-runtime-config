import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  CAT_APP,
  CAT_FUNCTION,
  CAT_INTL,
  CAT_KEYPAD,
  CAT_MEDIA,
  CAT_OTHER,
  CAT_SYMBOL,
  catalog,
} from "./keycodeCatalog";
import { KEYCODE_NAMES } from "./keycodeNames.fixture";
import { KEYCODE_VALUES } from "./keycodeValues.fixture";

const sections = catalog(KEYCODE_VALUES);
const all = sections.flatMap((s) => s.entries);
const where = (name: string) => sections.find((s) => s.entries.some((e) => e.name === name))?.category;

describe("the two keycode fixtures", () => {
  it("describe the same enum", () => {
    expect(Object.keys(KEYCODE_VALUES).sort()).toEqual([...KEYCODE_NAMES].sort());
  });
});

describe("catalog", () => {
  it("loses nothing: every name is in exactly one category", () => {
    const seen = new Set<string>();
    for (const e of all) for (const n of [e.name, ...e.aliases]) {
      expect(seen.has(n), `${n} listed twice`).toBe(false);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([...KEYCODE_NAMES].sort());
  });

  it("keeps one entry per value and names it with the shortest spelling", () => {
    expect(new Set(all.map((e) => e.value)).size).toBe(all.length);
    for (const e of all)
      for (const a of e.aliases)
        expect(e.name.length, `${e.name} vs ${a}`).toBeLessThanOrEqual(a.length);
  });

  it("folds aliases of one value together, shortest first", () => {
    // The installed enum happens to expose no aliases (Python's dir() hides
    // them), so this is the rule stated on a table that does have some.
    const got = catalog({ LANG1: 458896, LANGUAGE_1: 458896, ZZ_LANG: 458896, A: 458756 });
    const lang = got.flatMap((s) => s.entries).find((e) => e.value === 458896)!;
    expect(lang.name).toBe("LANG1");
    expect(lang.aliases).toEqual(["ZZ_LANG", "LANGUAGE_1"]);
  });

  it("only uses the categories it promises, in order, and drops empty ones", () => {
    expect(sections.map((s) => s.category)).toEqual(
      CATEGORY_ORDER.filter((c) => sections.some((s) => s.category === c)),
    );
    expect(catalog({ A: 458756 }).map((s) => s.category)).toEqual([CAT_OTHER]);
  });

  it("shelves the keys the picker promises", () => {
    // The shifted symbols the ⇧ toggle commits, all 21 of them.
    for (const n of [
      "EXCL", "ATSN", "HASH", "DLLR", "PRCNT", "CRRT", "AMPS", "ASTRK", "LPAR", "RPAR",
      "UNDER", "PLUS", "LBRC", "RBRC", "PIPE", "COLN", "DQT", "LABT", "GT", "QMARK", "TILD",
    ])
      expect(where(n), n).toBe(CAT_SYMBOL);
    // and the ones no board has a cap for.
    for (const n of ["NON_US_BSLH", "NUHS"]) expect(where(n), n).toBe(CAT_SYMBOL);

    for (let f = 13; f <= 24; f++) expect(where(`F${f}`), `F${f}`).toBe(CAT_FUNCTION);
    for (const n of ["KP_EQUAL", "KP_COMMA", "KP_CLEAR", "KP_N7", "KPLS"])
      expect(where(n), n).toBe(CAT_KEYPAD);
    for (const n of ["C_VOL_UP", "C_VOL_DN", "C_PLAY", "C_PAUSE", "C_FF", "C_RW", "C_BRI_INC", "M_MUTE"])
      expect(where(n), n).toBe(CAT_MEDIA);
    for (const n of ["C_AL_CALC", "C_AC_COPY", "C_PWR", "C_SLEEP", "K_PWR", "K_SLEEP", "K_APPLICATION", "SYS_WAKE"])
      expect(where(n), n).toBe(CAT_APP);
    for (const n of ["LANGUAGE_1", "LANGUAGE_5", "LANG9", "INT7", "INT_HENKAN", "INT_RO", "C_KBIA_NEXT", "GLOBE"])
      expect(where(n), n).toBe(CAT_INTL);
  });

  it("sorts numbered keys the way a person counts", () => {
    const fn = sections.find((s) => s.category === CAT_FUNCTION)!;
    expect(fn.entries.map((e) => e.name)).toEqual(
      Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
    );
  });
});
