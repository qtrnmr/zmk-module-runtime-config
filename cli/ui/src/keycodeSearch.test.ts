import { describe, expect, it } from "vitest";
import { searchKeycodes } from "./components/KeycodePicker";
import { KEYCODE_NAMES } from "./keycodeNames.fixture";

describe("searchKeycodes", () => {
  it("puts what you started typing first", () => {
    // The whole point: PLU offers PLUS, not KP_PLUS or C_MEDIA_VCR_PLUS.
    expect(searchKeycodes(KEYCODE_NAMES, "PLU")[0]).toBe("PLUS");
    expect(searchKeycodes(KEYCODE_NAMES, "plu")[0]).toBe("PLUS");
    expect(searchKeycodes(KEYCODE_NAMES, "ent")[0]).toBe("ENTER");
    expect(searchKeycodes(KEYCODE_NAMES, "num_1")[0]).toBe("NUM_1");
  });

  it("prefers the shorter name when several start the same way", () => {
    const hits = searchKeycodes(KEYCODE_NAMES, "kp_n");
    expect(hits[0].length).toBeLessThanOrEqual(hits[hits.length - 1].length);
  });

  it("still finds a name that merely contains the query", () => {
    const hits = searchKeycodes(KEYCODE_NAMES, "meta");
    expect(hits).toContain("LEFT_META");
    expect(hits).toContain("RIGHT_META");
  });

  it("searches the Japanese description too, after the name matches", () => {
    const hits = searchKeycodes(KEYCODE_NAMES, "ミュート");
    expect(hits).toContain("K_MUTE");
    // 「かな」 is only in LANGUAGE_1's description, not in any keycode name.
    expect(searchKeycodes(KEYCODE_NAMES, "かな")).toContain("LANGUAGE_1");
  });

  it("finds a symbol by the character it prints, not by its name", () => {
    // Nobody guesses that `+` is spelled PLUS — that is the whole complaint.
    expect(searchKeycodes(KEYCODE_NAMES, "+")[0]).toBe("PLUS");
    expect(searchKeycodes(KEYCODE_NAMES, "?")[0]).toBe("QMARK");
    expect(searchKeycodes(KEYCODE_NAMES, "(")[0]).toBe("LPAR");
    expect(searchKeycodes(KEYCODE_NAMES, "!")[0]).toBe("EXCL");
    expect(searchKeycodes(KEYCODE_NAMES, "~")[0]).toBe("TILD");
    expect(searchKeycodes(KEYCODE_NAMES, "@")[0]).toBe("ATSN");
    expect(searchKeycodes(KEYCODE_NAMES, "^")[0]).toBe("CRRT");
    expect(searchKeycodes(KEYCODE_NAMES, "<")[0]).toBe("LABT");
    expect(searchKeycodes(KEYCODE_NAMES, "_")[0]).toBe("UNDER");
    expect(searchKeycodes(KEYCODE_NAMES, "'")[0]).toBe("APOSTROPHE");
  });

  it("offers the keypad twin after the plain key, never before it", () => {
    expect(searchKeycodes(KEYCODE_NAMES, "+").slice(0, 2)).toEqual(["PLUS", "KPLS"]);
    // KPLS is four characters and PLUS is four too, so only the explicit order
    // keeps them this way round.
    expect(searchKeycodes(KEYCODE_NAMES, "(").slice(0, 2)).toEqual(["LPAR", "KP_LPAR"]);
  });

  it("does not treat a letter as a symbol", () => {
    // `a` is an ordinary prefix search; the symbol table must not shadow it.
    expect(searchKeycodes(KEYCODE_NAMES, "a")[0]).toBe("A");
  });

  it("lists everything for an empty query and nothing for a miss", () => {
    expect(searchKeycodes(KEYCODE_NAMES, "", 5)).toEqual(KEYCODE_NAMES.slice(0, 5));
    expect(searchKeycodes(KEYCODE_NAMES, "zzzz")).toEqual([]);
  });
});
