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

/** A layer's display name: the device reports "" unless the devicetree sets
 *  `display-name`, so fall back to the same L<n> the server uses in labels. */
export function layerLabel(layer: Layer): string {
  return layer.name || `L${layer.index}`;
}
