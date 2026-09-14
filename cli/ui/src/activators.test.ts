import { describe, expect, it } from "vitest";
import { layerActivators } from "./activators";
import { decorFor } from "./decor";
import type { Behavior, Binding, Features, Layer, State } from "./types";

/** The roBa in miniature: the six layers and the handful of keys that decide
 *  how SETTING, ARROW and the three OS layers are reached. Positions follow
 *  the real keymap (27 = the SETTING key, 37 = 英数, 18/19 = J/K on SETTING),
 *  so a failure here points at a key you can actually press. */

const hid = [{ name: "key", type: "hid_usage" as const, keyboard_max: 0xff, consumer_max: 0xff }];
const layerId = [{ name: "layer", type: "layer_id" as const }];

const BEHAVIORS: Behavior[] = [
  { id: 8, display_name: "Key Press", metadata: [{ param1: hid, param2: [] }] },
  { id: 9, display_name: "Transparent", metadata: [] },
  { id: 20, display_name: "Momentary Layer", metadata: [{ param1: layerId, param2: [] }] },
  { id: 21, display_name: "Sticky Layer", metadata: [{ param1: layerId, param2: [] }] },
  { id: 23, display_name: "Toggle Layer", metadata: [{ param1: layerId, param2: [] }] },
  { id: 26, display_name: "Layer-Tap", metadata: [{ param1: layerId, param2: hid }] },
  { id: 27, display_name: "To Layer", metadata: [{ param1: layerId, param2: [] }] },
  { id: 30, display_name: "Mod-Tap", metadata: [{ param1: hid, param2: hid }] },
  { id: 32, display_name: "LAYER_TAP_TO_APPLE", metadata: [{ param1: layerId, param2: hid }] },
  { id: 29, display_name: "LAYER_TAP_TO_ANDROID", metadata: [{ param1: layerId, param2: hid }] },
  { id: 35, display_name: "LAYER_TAP_TO_0", metadata: [{ param1: layerId, param2: hid }] },
  { id: 5, display_name: "BT_J_MAC", metadata: [{ param1: [], param2: [] }] },
  { id: 6, display_name: "BT_K_WIN", metadata: [{ param1: [], param2: [] }] },
];

const NAME = new Map(BEHAVIORS.map((b) => [b.id, b.display_name]));

/** A binding at `pos`; the label carries the behaviour name the way the server
 *  writes it, which is what the scan reads first. */
function bind(pos: number, id: number, param1 = 0, param2 = 0): Binding {
  return {
    pos,
    behavior_id: id,
    param1,
    param2,
    label: { behavior: NAME.get(id) ?? "?", text: "x" },
  };
}

const TRANSPARENT = (pos: number): Binding => ({
  pos,
  behavior_id: 9,
  param1: 0,
  param2: 0,
  label: { behavior: "Transparent", text: "▽" },
});

/** Bindings are indexed by position on the real document, so the gaps have to
 *  be there too. */
function layer(index: number, name: string, bindings: Binding[]): Layer {
  const all: Binding[] = [];
  for (const b of bindings) all[b.pos] = b;
  for (let i = 0; i < 43; i++) if (!all[i]) all[i] = TRANSPARENT(i);
  return { index, id: index + 100, name, bindings: all };
}

const LAYERS: Layer[] = [
  layer(0, "DEFAULT", [
    bind(27, 20, 8), // &mo SETTING
    bind(37, 35, 8, 0x91), // &lt_to_0 SETTING LANG2 — hold SETTING, tap back to 0
    bind(39, 35, 5, 0x90), // &lt_to_0 ARROW LANG1
    bind(41, 26, 3, 0x28), // &lt FUNCTION ENTER
    bind(1, 30, 0xe0, 0x14), // &mt LCTRL Q — a hold-tap that names no layer
  ]),
  layer(1, "APPLE", [bind(37, 32, 8, 0x91)]),
  layer(2, "ANDROID", [bind(37, 29, 8, 0x91)]),
  layer(3, "FUNCTION", []),
  layer(5, "ARROW", []),
  layer(6, "MOUSE", []),
  layer(8, "SETTING", [
    bind(18, 5), // &bt_j_mac
    bind(19, 6), // &bt_k_win
    bind(20, 23, 7), // &tog SCROLL
    bind(21, 21, 4), // &sl NUM
    bind(22, 27, 2), // &to ANDROID
  ]),
  layer(9, "APPLE_MOUSE", []),
];

const STATE: State = {
  device: { name: "roBa", lock_state: "UNLOCKED", serial_port: "/dev/null" },
  layout: { name: "Default", keys: new Array(43).fill(null).map((_, pos) => ({ pos, x: 0, y: 0, w: 100, h: 100, r: 0, rx: 0, ry: 0 })) },
  keymap: { available_layers: 0, max_layer_name_length: 16, layers: LAYERS },
  behaviors: BEHAVIORS,
  keycodes: {},
  backup_log_path: "",
};

const NONE = { available: false as const, error: "" };

function features(over: Partial<Features> = {}): Features {
  return {
    macros: NONE,
    holdtaps: NONE,
    combos: NONE,
    encoder: NONE,
    condlayers: {
      available: true,
      entries: [
        { index: 0, if_layers: [1, 6], then_layer: 9, found: true },
        { index: 1, if_layers: [2, 6], then_layer: 10, found: true },
      ],
    },
    trackball: {
      available: true,
      processors: [
        {
          name: "mouse",
          temp_layer_enabled: false,
          temp_layer_layer: 0,
        },
      ],
      fields: [],
    },
    ...over,
  };
}

const DECOR = decorFor(STATE.layout);

describe("layerActivators", () => {
  it("finds every key that holds SETTING, on all three OS layers", () => {
    expect(layerActivators(STATE, features(), DECOR, 8)).toEqual([
      { kind: "key", layer: 0, pos: 27, how: "hold", behavior: "Momentary Layer" },
      { kind: "key", layer: 0, pos: 37, how: "hold", behavior: "LAYER_TAP_TO_0" },
      { kind: "key", layer: 1, pos: 37, how: "hold", behavior: "LAYER_TAP_TO_APPLE" },
      { kind: "key", layer: 2, pos: 37, how: "hold", behavior: "LAYER_TAP_TO_ANDROID" },
    ]);
  });

  it("reads a conditional layer off the features document", () => {
    expect(layerActivators(STATE, features(), DECOR, 9)).toEqual([
      { kind: "condlayer", ifLayers: [1, 6] },
    ]);
  });

  it("reaches the base layer through the tap side of LAYER_TAP_TO_0", () => {
    expect(layerActivators(STATE, features(), DECOR, 0)).toEqual([
      { kind: "key", layer: 0, pos: 37, how: "tap", behavior: "LAYER_TAP_TO_0" },
      { kind: "key", layer: 0, pos: 39, how: "tap", behavior: "LAYER_TAP_TO_0" },
      { kind: "key", layer: 8, pos: 19, how: "tap", behavior: "BT_K_WIN" },
    ]);
  });

  it("reaches APPLE through the behaviours that hard-code it", () => {
    expect(layerActivators(STATE, features(), DECOR, 1)).toEqual([
      { kind: "key", layer: 1, pos: 37, how: "tap", behavior: "LAYER_TAP_TO_APPLE" },
      { kind: "key", layer: 8, pos: 18, how: "tap", behavior: "BT_J_MAC" },
    ]);
  });

  it("gives a layer nothing reaches an empty list", () => {
    expect(layerActivators(STATE, features(), DECOR, 12)).toEqual([]);
  });

  it("names the gesture after the behaviour", () => {
    expect(layerActivators(STATE, features(), DECOR, 7)).toEqual([
      { kind: "key", layer: 8, pos: 20, how: "toggle", behavior: "Toggle Layer" },
    ]);
    expect(layerActivators(STATE, features(), DECOR, 4)).toEqual([
      { kind: "key", layer: 8, pos: 21, how: "sticky", behavior: "Sticky Layer" },
    ]);
    expect(layerActivators(STATE, features(), DECOR, 2)).toEqual([
      { kind: "key", layer: 2, pos: 37, how: "tap", behavior: "LAYER_TAP_TO_ANDROID" },
      { kind: "key", layer: 8, pos: 22, how: "tap", behavior: "To Layer" },
    ]);
  });

  it("holds a plain Layer-Tap and ignores a Mod-Tap", () => {
    expect(layerActivators(STATE, features(), DECOR, 3)).toEqual([
      { kind: "key", layer: 0, pos: 41, how: "hold", behavior: "Layer-Tap" },
    ]);
    // &mt LCTRL Q names keycode 0xe0 / 0x14, never a layer.
    for (const t of [0xe0, 0x14]) {
      expect(layerActivators(STATE, features(), DECOR, t)).toEqual([]);
    }
  });

  it("explains a firmware-fixed layer from decor, matched by name", () => {
    expect(layerActivators(STATE, features(), DECOR, 6)).toEqual([
      { kind: "note", text: "トラックボールを動かすと自動で入る (automouse-layer、ファーム固定)" },
    ]);
    // Rename MOUSE and the note simply stops applying — it never moves to
    // whatever layer inherited index 6.
    const renamed: State = {
      ...STATE,
      keymap: {
        ...STATE.keymap,
        layers: LAYERS.map((l) => (l.index === 6 ? { ...l, name: "POINTER" } : l)),
      },
    };
    expect(layerActivators(renamed, features(), DECOR, 6)).toEqual([]);
  });

  it("reports the trackball's own temporary layer when it is enabled", () => {
    const f = features({
      trackball: {
        available: true,
        processors: [{ name: "mouse", temp_layer_enabled: true, temp_layer_layer: 6 }],
        fields: [],
      },
    });
    expect(layerActivators(STATE, f, DECOR, 6)).toEqual([
      { kind: "trackball", text: "トラックボールを動かすと一時的に" },
      { kind: "note", text: "トラックボールを動かすと自動で入る (automouse-layer、ファーム固定)" },
    ]);
  });

  it("works on /api/state alone, before the features arrive", () => {
    expect(layerActivators(STATE, null, DECOR, 9)).toEqual([]);
    expect(layerActivators(STATE, null, DECOR, 8)).toHaveLength(4);
  });

  it("says the base layer is simply where the keyboard starts", () => {
    const bare: State = {
      ...STATE,
      keymap: { ...STATE.keymap, layers: [layer(0, "DEFAULT", []), layer(1, "APPLE", [])] },
    };
    expect(layerActivators(bare, features(), DECOR, 0)).toEqual([
      { kind: "note", text: "起動時のレイヤー" },
    ]);
    expect(layerActivators(bare, features(), DECOR, 1)).toEqual([]);
  });
});
