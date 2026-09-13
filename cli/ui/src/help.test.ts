import { describe, expect, it } from "vitest";
import {
  BEHAVIOR_HELP,
  KEYCODE_HELP,
  MOD_HELP,
  TB_OTHER,
  TRACKBALL_GROUPS,
  TRACKBALL_HELP,
  groupTrackballFields,
  keycodeHelp,
} from "./help";
import { MOD_ORDER } from "./params";
import { pretty } from "./prettyKeycode";

/** rip_client.py FIELD_UI, in order. Kept literal so a field added on the
 *  Python side fails here until it gets a Japanese label. */
const FIELD_UI = [
  "scale-multiplier",
  "scale-divisor",
  "rotation",
  "x-invert",
  "y-invert",
  "xy-swap",
  "xy-to-scroll",
  "axis-snap-mode",
  "axis-snap-threshold",
  "axis-snap-timeout",
  "temp-layer-enabled",
  "temp-layer-layer",
  "temp-layer-activation-delay",
  "temp-layer-deactivation-delay",
  "active-layers",
];

/** Every display_name /api/state reports on a roBa, plus the ZMK core ones the
 *  UI promises to explain. */
const BEHAVIORS = [
  "Key Press", "Transparent", "None", "Momentary Layer", "Layer-Tap", "Mod-Tap",
  "To Layer", "Toggle Layer", "Sticky Key", "Sticky Layer", "Caps Word",
  "Key Repeat", "Key Toggle", "Grave/Escape", "Bluetooth", "Output Selection",
  "External Power", "Reset", "Bootloader", "Studio Unlock", "Mouse Key Press",
  "mouse_move", "mouse_scroll", "rt_macro", "rsr_trans",
  "ENCODER_MSC_DOWN_UP", "ENCODER_VOL_DOWN_UP",
  "LAYER_TAP_TO_0", "LAYER_TAP_TO_APPLE", "LAYER_TAP_TO_ANDROID",
  "TO_LAYER_0", "TO_APPLE_DEFAULT", "TO_ANDROID",
  "BT_H_FOLD", "BT_J_MAC", "BT_K_WIN",
];

describe("dictionaries are complete", () => {
  it.each(FIELD_UI)("trackball field %s has a Japanese label and a group", (name) => {
    const e = TRACKBALL_HELP[name];
    expect(e, name).toBeDefined();
    expect(e.label.length).toBeGreaterThan(0);
    expect(e.help.length).toBeGreaterThan(0);
    expect(TRACKBALL_GROUPS).toContain(e.group);
  });

  it.each(BEHAVIORS)("behavior %s has help", (name) => {
    expect(BEHAVIOR_HELP[name], name).toBeTruthy();
  });

  it.each(MOD_ORDER)("modifier %s has help", (m) => {
    expect(MOD_HELP[m], m).toBeTruthy();
  });
});

describe("groupTrackballFields", () => {
  it("keeps FIELD_UI order inside each card and drops empty groups", () => {
    const got = groupTrackballFields(FIELD_UI.map((name) => ({ name })));
    expect(got.map((g) => g.group)).toEqual([...TRACKBALL_GROUPS]);
    expect(got[0].fields.map((f) => f.name)).toEqual([
      "scale-multiplier",
      "scale-divisor",
      "rotation",
    ]);
    expect(got.flatMap((g) => g.fields).length).toBe(FIELD_UI.length);
  });

  it("puts an unknown field from another keyboard into その他", () => {
    const got = groupTrackballFields([{ name: "rotation" }, { name: "sniper-mode" }]);
    expect(got.map((g) => g.group)).toEqual(["速度", TB_OTHER]);
    expect(got[1].fields[0].name).toBe("sniper-mode");
  });
});

describe("keycodeHelp", () => {
  it("splits modifier prefixes into a readable chord", () => {
    expect(keycodeHelp("LC(LS(Z))")).toBe("Ctrl+Shift+Z の同時押し。");
    expect(keycodeHelp("LG(TAB)")).toBe(`Gui+${pretty("TAB")} の同時押し。`);
    expect(keycodeHelp("RC(RA(RS(RG(A))))")).toBe("Ctrl+Alt+Shift+Gui+A の同時押し。");
  });

  it("appends the base keycode's own note when there is one", () => {
    const got = keycodeHelp("LS(LANGUAGE_2)");
    expect(got).toContain("Shift+英数 の同時押し。");
    expect(got).toContain(KEYCODE_HELP.LANGUAGE_2);
  });

  it("explains bare keycodes, keypad keys by prefix, and nothing else", () => {
    expect(keycodeHelp("GLOBE")).toBe(KEYCODE_HELP.GLOBE);
    expect(keycodeHelp("KP_N7")).toContain("テンキー");
    expect(keycodeHelp("A")).toBeUndefined();
  });

  it("never contradicts the key cap: Gui, Ctrl, Shift and Alt match pretty()", () => {
    expect(keycodeHelp("LG(A)")?.startsWith(pretty("LGUI"))).toBe(true);
    expect(keycodeHelp("LC(A)")?.startsWith(pretty("LCTRL"))).toBe(true);
    expect(keycodeHelp("LS(A)")?.startsWith(pretty("LSHIFT"))).toBe(true);
    expect(keycodeHelp("LA(A)")?.startsWith(pretty("LALT"))).toBe(true);
  });
});
