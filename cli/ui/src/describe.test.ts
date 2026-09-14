import { describe, expect, it } from "vitest";
import { describeBinding, type DescribeCtx } from "./describe";
import { reverseKeycodes } from "./macroFormat";
import type { Behavior, Binding, Layer, Macros, ParamDesc } from "./types";

const KEY: ParamDesc = { name: "Key", type: "hid_usage", keyboard_max: 0, consumer_max: 0 };
const LAYER: ParamDesc = { name: "Layer", type: "layer_id" };
const SLOT: ParamDesc = { name: "Slot", type: "range", min: 0, max: 7 };

const B = (id: number, display_name: string, param1: ParamDesc[], param2: ParamDesc[] = []) =>
  ({ id, display_name, metadata: [{ param1, param2 }] }) as Behavior;

const BEHAVIORS: Behavior[] = [
  B(1, "Key Press", [KEY]),
  B(2, "Mod-Tap", [KEY], [KEY]),
  B(3, "Layer-Tap", [LAYER], [KEY]),
  B(4, "LAYER_TAP_TO_0", [LAYER], [KEY]),
  B(5, "Momentary Layer", [LAYER]),
  B(6, "Transparent", []),
  B(7, "rt_macro", [SLOT]),
  B(8, "Bootloader", []),
  B(9, "zzz_custom", []),
];

const KEYCODES: Record<string, number> = { A: 4, LANG2: 0x91, LCTRL: 0xe0, SPC: 0x2c, K_MUTE: 0x7f };

const LAYERS: Layer[] = [
  { index: 0, id: 10, name: "DEFAULT", bindings: [] },
  { index: 4, id: 14, name: "NUM", bindings: [] },
  { index: 8, id: 18, name: "SETTING", bindings: [] },
];

const MACROS: Macros = {
  available: true,
  max_steps: 16,
  slots: [
    {
      slot: 0,
      steps: [
        { type: 1, keycode: 0x68, wait_ms: 80, tap_ms: 0, label: "GLOBE" },
        { type: 0, keycode: 0x50, wait_ms: 0, tap_ms: 5, label: "LARW" },
        { type: 2, keycode: 0x68, wait_ms: 0, tap_ms: 0, label: "GLOBE" },
      ],
    },
  ],
};

/** A base layer whose key 3 is Q, so a ▽ has something to inherit. */
const BASE: Layer = {
  index: 0,
  id: 10,
  name: "DEFAULT",
  bindings: [
    ...Array.from({ length: 3 }, (_, pos) => ({ pos }) as Binding),
    { pos: 3, behavior_id: 1, param1: 20, param2: 0, label: { behavior: "Key Press", text: "Q" } },
  ],
};

const ctx: DescribeCtx = {
  byId: new Map(BEHAVIORS.map((b) => [b.id, b])),
  layers: LAYERS,
  rev: reverseKeycodes(KEYCODES),
  base: BASE,
  pos: 3,
  macros: MACROS,
};

const say = (behavior_id: number, param1 = 0, param2 = 0, label?: { behavior: string }) =>
  describeBinding({ behavior_id, param1, param2, label: label as never }, ctx);

describe("describeBinding", () => {
  it("says what a key press sends, and what an obscure keycode means", () => {
    expect(say(1, KEYCODES.A)).toBe("キー入力: A");
    expect(say(1, KEYCODES.K_MUTE)).toBe("キー入力: Mute · ミュート (音を消す / 戻す)。キーボード扱いの Mute で、ほぼ全 OS で効く");
    // A bare symbol keeps its canonical name beside it, so ␣ is still legible.
    expect(say(1, KEYCODES.SPC)).toBe("キー入力: ␣ (SPC) · Space。空白を 1 つ入れる");
  });

  it("splits a hold-tap into its two halves", () => {
    expect(say(2, KEYCODES.LCTRL, KEYCODES.A)).toBe("長押しで Ctrl、タップで A");
    expect(say(3, 4, KEYCODES.SPC)).toBe("長押しで NUM レイヤー、タップで ␣ (SPC)");
  });

  it("says where roBa's own hold-tap goes back to", () => {
    expect(say(4, 8, KEYCODES.LANG2)).toBe(
      "長押しで SETTING レイヤー、タップで Windows に戻って 英数 (LANG2)",
    );
  });

  it("says how long a momentary layer lasts", () => {
    expect(say(5, 8)).toBe("押している間 SETTING レイヤー");
  });

  it("says what a ▽ inherits, naming the layer it comes from", () => {
    expect(say(6)).toBe("透過: このレイヤーでは何もせず、下の DEFAULT の Q が効く");
    // Without a base binding there is nothing to name, and it says so.
    expect(describeBinding({ behavior_id: 6, param1: 0, param2: 0 }, { ...ctx, pos: 1 })).toBe(
      "透過: このレイヤーでは何もせず、下のレイヤーの割当が効く",
    );
  });

  it("quotes a runtime macro's own steps, and copes when they are not loaded", () => {
    expect(say(7, 0)).toBe("ランタイムマクロ slot 0 (中身: GLOBE↓ 80ms · ← · GLOBE↑)");
    expect(describeBinding({ behavior_id: 7, param1: 3, param2: 0 }, ctx)).toBe(
      "ランタイムマクロ slot 3",
    );
    expect(
      describeBinding({ behavior_id: 7, param1: 0, param2: 0 }, { ...ctx, macros: null }),
    ).toBe("ランタイムマクロ slot 0");
  });

  it("falls back to the Japanese name for a behaviour with nothing to fill in", () => {
    expect(say(8)).toBe("ブートローダーへ (焼き込みモード)");
  });

  it("says the raw name for a behaviour from another keyboard", () => {
    expect(say(9)).toBe("zzz_custom");
    expect(describeBinding({ behavior_id: 99, param1: 0, param2: 0 }, ctx)).toBe("");
  });

  it("trusts the label's behaviour name over the id, as the tooltip does", () => {
    expect(say(0, 8, 0, { behavior: "Momentary Layer" })).toBe("押している間 SETTING レイヤー");
  });
});
