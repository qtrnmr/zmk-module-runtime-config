import type { Behavior, Layer, ParamDesc } from "./types";

export const MOD_BITS = {
  LC: 0x01 << 24,
  LS: 0x02 << 24,
  LA: 0x04 << 24,
  LG: 0x08 << 24,
  RC: 0x10 << 24,
  RS: 0x20 << 24,
  RA: 0x40 << 24,
  RG: 0x80 << 24,
} as const;

export type ModName = keyof typeof MOD_BITS;
export const MOD_ORDER: ModName[] = ["LC", "LS", "LA", "LG", "RC", "RS", "RA", "RG"];

export function splitMods(value: number): { base: number; mods: ModName[] } {
  const mods = MOD_ORDER.filter((m) => (value & MOD_BITS[m]) !== 0);
  return { base: value & 0x00ffffff, mods };
}

export function joinMods(base: number, mods: ModName[]): number {
  return mods.reduce((acc, m) => acc | MOD_BITS[m], base & 0x00ffffff);
}

/** Behaviors people reach for first, in the order ZMK Studio shows them. */
const CURATED = [
  "key press",
  "transparent",
  "momentary layer",
  "layer-tap",
  "layer tap",
  "mod-tap",
  "to layer",
  "rt_macro",
];

export function curatedOrder(behaviors: Behavior[]): Behavior[] {
  const rank = (b: Behavior) => {
    const i = CURATED.indexOf(b.display_name.toLowerCase());
    return i === -1 ? CURATED.length : i;
  };
  return [...behaviors].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return a.display_name.localeCompare(b.display_name);
  });
}

export function defaultParam(
  descs: ParamDesc[],
  _layers: Layer[],
  keycodes: Record<string, number>,
): number {
  for (const d of descs) {
    if (d.type === "constant") return d.value;
    if (d.type === "range") return d.min;
    if (d.type === "hid_usage") return keycodes["A"] ?? 0;
    if (d.type === "layer_id") return 0;
  }
  return 0;
}

/** Which editor to show for a metadata slot: the first renderable kind wins. */
export function paramKind(descs: ParamDesc[]): ParamDesc["type"] | "none" {
  const constants = descs.filter((d) => d.type === "constant");
  if (constants.length) return "constant";
  for (const d of descs) {
    if (d.type === "hid_usage" || d.type === "layer_id" || d.type === "range") return d.type;
  }
  return "none";
}
