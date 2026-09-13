import { pretty } from "./prettyKeycode";
import type { MacroStep } from "./types";

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
