import { MOD_ORDER, splitMods } from "./params";
import { pretty } from "./prettyKeycode";
import type { MacroStep } from "./types";

/** value -> canonical name, shortest name wins — the same rule the server's
 *  reverse_keycodes() uses, so a locally named step reads like a device one. */
export function reverseKeycodes(keycodes: Record<string, number>): Map<number, string> {
  const rev = new Map<number, string>();
  for (const name of Object.keys(keycodes).sort((a, b) => a.length - b.length || a.localeCompare(b)))
    if (!rev.has(keycodes[name])) rev.set(keycodes[name], name);
  return rev;
}

/** Canonical name for a keycode, mods wrapped outermost-first: `LC(LS(Z))`.
 *  Used for steps the device has not labelled yet (DSL import, new rows). */
export function keycodeName(rev: Map<number, string>, value: number): string {
  const { base, mods } = splitMods(value);
  const text = rev.get(base) ?? `0x${base.toString(16).toUpperCase()}`;
  return MOD_ORDER.filter((m) => mods.includes(m)).reduceRight((t, m) => `${m}(${t})`, text);
}

const ARROW = ["", "↓", "↑"] as const;

/** One-line preview of a macro slot, e.g. `GLOBE↓ 80ms · LEFT↓ 120ms · LEFT↑`.
 *  A tap has no arrow; `wait_ms` is appended only when it is set. */
export function stepPreview(steps: MacroStep[]): string {
  if (!steps.length) return "(空)";
  return steps
    .map((s) => {
      const key = pretty(s.label ?? String(s.keycode)) + ARROW[s.type];
      return s.wait_ms > 0 ? `${key} ${s.wait_ms}ms` : key;
    })
    .join(" · ");
}

/** Label for the `type` column / select. */
export const STEP_TYPES: { value: 0 | 1 | 2; label: string }[] = [
  { value: 0, label: "tap" },
  { value: 1, label: "press" },
  { value: 2, label: "release" },
];
