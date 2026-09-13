export type Label = { behavior: string } & ({ text: string } | { hold: string; tap: string });

export interface Binding {
  pos: number;
  behavior_id: number;
  param1: number;
  param2: number;
  label: Label;
}

export interface Layer {
  index: number;
  id: number;
  name: string;
  bindings: Binding[];
}

export interface LayoutKey {
  pos: number;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  rx: number;
  ry: number;
}

export type ParamDesc = { name: string } & (
  | { type: "nil" }
  | { type: "constant"; value: number }
  | { type: "range"; min: number; max: number }
  | { type: "hid_usage"; keyboard_max: number; consumer_max: number }
  | { type: "layer_id" }
);

export interface Behavior {
  id: number;
  display_name: string;
  metadata: { param1: ParamDesc[]; param2: ParamDesc[] }[];
}

export interface State {
  device: { name: string; lock_state: "LOCKED" | "UNLOCKED"; serial_port: string };
  layout: { name: string; keys: LayoutKey[] };
  keymap: { available_layers: number; max_layer_name_length: number; layers: Layer[] };
  behaviors: Behavior[];
  keycodes: Record<string, number>;
  backup_log_path: string;
}

export interface OpResult {
  ok: boolean;
  error?: string;
  index?: number;
}

// ---- feature panels (/api/features) ---------------------------------------

/** A macro step. `type` mirrors RT_MACRO_STEP_*: 0 tap, 1 press, 2 release. */
export interface MacroStep {
  type: 0 | 1 | 2;
  keycode: number;
  wait_ms: number;
  tap_ms: number;
  /** Canonical ZMK name for `keycode`, added by the server. */
  label?: string;
}

/** A feature whose custom RPC subsystem this keyboard does not ship. */
export interface Unavailable {
  available: false;
  error: string;
}

export type Macros =
  | Unavailable
  | { available: true; max_steps: number; slots: { slot: number; steps: MacroStep[] }[] };

export interface HoldtapSlot {
  slot: number;
  tapping_term_ms: number;
  quick_tap_ms: number;
  require_prior_idle_ms: number;
  flavor: string;
  flavor_index: number;
  found: boolean;
  /** Local id of the behavior owning this slot; 0 on firmware without it. */
  behavior_id: number;
}

export type Holdtaps = Unavailable | { available: true; flavors: string[]; slots: HoldtapSlot[] };

export interface CondlayerEntry {
  index: number;
  if_layers: number[];
  then_layer: number;
  found: boolean;
}

export type Condlayers = Unavailable | { available: true; entries: CondlayerEntry[] };

/** A binding without a key position: combos and encoder directions. */
export interface RawBinding {
  behavior_id: number;
  param1: number;
  param2: number;
  label?: Label;
}

export interface ComboEntry {
  index: number;
  key_positions: number[];
  binding: RawBinding;
  timeout_ms: number;
  require_prior_idle_ms: number;
  layers: number[];
  slow_release: boolean;
  found: boolean;
  /** The devicetree binding; null on firmware that does not report it. */
  dt_binding: RawBinding | null;
  /** What the combo does right now: the runtime override, else dt_binding. */
  effective: RawBinding;
}

export type Combos = Unavailable | { available: true; entries: ComboEntry[] };

export type EncoderBinding = RawBinding & { tap_ms: number };

export interface EncoderLayer {
  layer: number;
  cw: EncoderBinding;
  ccw: EncoderBinding;
}

export type Encoder =
  | Unavailable
  | {
      available: true;
      sensors: { index: number; name: string }[];
      bindings: { sensor: number; layers: EncoderLayer[] }[];
    };

export interface TrackballField {
  name: string;
  kind: "int" | "bool" | "enum" | "layer";
  options?: string[];
  info_key: string;
}

export type Processor = Record<string, number | string | boolean>;

export type Trackball =
  | Unavailable
  | { available: true; processors: Processor[]; fields: TrackballField[] };

export interface Features {
  macros: Macros;
  holdtaps: Holdtaps;
  condlayers: Condlayers;
  combos: Combos;
  encoder: Encoder;
  trackball: Trackball;
}

/** One key of the /api/features document, for partial refetches. */
export type FeatureKey = keyof Features;

/** Hold-tap, combos and the encoder are edited on the board, not on a page. */
export type Tab = "keymap" | "macro" | "condlayer" | "trackball";

export const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "keymap", label: "キーマップ", icon: "⌨" },
  { id: "macro", label: "マクロ", icon: "M" },
  { id: "condlayer", label: "条件レイヤー", icon: "CL" },
  { id: "trackball", label: "トラックボール", icon: "TB" },
];

/** What the right-hand inspector is showing, if anything. */
export type Selection =
  | { kind: "key"; pos: number }
  | { kind: "combo"; index: number }
  | { kind: "encoder"; sensor: number };

/** The behaviour of a binding the firmware has never overridden at runtime. */
export const DT_DEFAULT_ID = 0;

/** A layer's display name: the device reports "" unless the devicetree sets
 *  `display-name`, so fall back to the same L<n> the server uses in labels. */
export function layerLabel(layer: Layer): string {
  return layer.name || `L${layer.index}`;
}
