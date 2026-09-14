/**
 * 練習モード: what the firmware says the keyboard is doing, folded into the
 * little bit of state the board and the strip need.
 *
 * Pure on purpose — every event arrives from an EventSource, and a reducer you
 * can call in a test is the only way to be sure that a hold, a layer change and
 * a release leave the board in a state a person recognises.
 */
import { keycodeName, reverseKeycodes } from "./macroFormat";
import { pretty } from "./prettyKeycode";
import type { Layer } from "./types";

export type KeyEvent = { type: "key"; position: number; pressed: boolean; source: number };
export type LayersEvent = { type: "layers"; mask: number; highest: number; ids: number[] };
export type KeycodeEvent = {
  type: "keycode";
  usage_page: number;
  keycode: number;
  pressed: boolean;
  modifiers: number;
};
export type PracticeEvent = KeyEvent | LayersEvent | KeycodeEvent;

/** How many lines the log keeps. Older ones scroll off for good. */
export const LOG_LIMIT = 30;

/** One thing the keyboard is sending right now. */
export interface OutputChip {
  text: string;
  /** Raised by nothing the fingers are holding — an encoder turn, a macro.
   *  A guess, but the honest one: a key press always announces its position
   *  before its keycode. */
  encoder: boolean;
}

export interface LogEntry {
  id: number;
  kind: PracticeEvent["type"];
  text: string;
}

export interface PracticeState {
  /** Key positions held down right now. */
  pressed: Set<number>;
  /** zmk_keymap_layer_state(): a bit per layer *id*. */
  mask: number;
  /** zmk_keymap_highest_layer_active(): a layer *index*. */
  highest: number;
  /** The ids in `mask`, ascending. */
  activeIds: number[];
  /** The chord being held, in the order it was pressed. */
  output: OutputChip[];
  /** The last thing sent, kept after release so a tap is still readable. */
  last: OutputChip | null;
  log: LogEntry[];
  /** Monotonic id for log keys; never reset while the mode is on. */
  seq: number;
}

/** Everything the reducer needs to name things. All optional: without it the
 *  log still reads, just in raw numbers. */
export interface PracticeCtx {
  /** value -> canonical keycode name, from reverseKeycodes(state.keycodes). */
  rev?: Map<number, string>;
  /** layer id -> display name. */
  layerNames?: Record<number, string>;
  /** key position -> what the cap says on the current layer. */
  capLabels?: Record<number, string>;
}

export function initial(): PracticeState {
  return {
    pressed: new Set(),
    mask: 0,
    highest: 0,
    activeIds: [],
    output: [],
    last: null,
    log: [],
    seq: 0,
  };
}

/** The ids set in a layer-state mask, ascending — the same reading the CLI's
 *  layer_ids() does. */
export function layerIds(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 32; i++) if (mask & (1 << i)) out.push(i);
  return out;
}

/**
 * Canonical name for one keycode event, spelled the way the board spells it.
 *
 * Mirrors the server's labels.keycode_text: a shifted symbol has a name of its
 * own (PLUS *is* LS(EQL)), so the whole value is looked up first and only then
 * are the modifier bits wrapped around the base. A modifier key pressed by
 * itself reports itself in `modifiers` too — wrapping that would read
 * `LS(LSHIFT)`, so the bits are dropped for the 0xE0–0xE7 block.
 */
export function keycodeText(ev: KeycodeEvent, rev: Map<number, string>): string {
  const page = ev.usage_page || 0x07;
  const base = ((page << 16) | ev.keycode) >>> 0;
  const isModifierKey = page === 0x07 && ev.keycode >= 0xe0 && ev.keycode <= 0xe7;
  const value = isModifierKey ? base : (base | ((ev.modifiers & 0xff) << 24)) >>> 0;
  return rev.get(value) ?? keycodeName(rev, value);
}

/** Names of the active layers, in board order; the highest one last. */
export function activeLayerNames(state: PracticeState, layers: Layer[]): string[] {
  const active = new Set(state.activeIds);
  return layers.filter((l) => active.has(l.id)).map((l) => l.name || `L${l.index}`);
}

/** The layer the board should show while practice is on: the highest active
 *  one, clamped to a layer that exists. */
export function followIndex(state: PracticeState, layers: Layer[]): number {
  if (!layers.length) return 0;
  return Math.min(state.highest, layers.length - 1);
}

function push(state: PracticeState, kind: PracticeEvent["type"], text: string): LogEntry[] {
  const log = [...state.log, { id: state.seq + 1, kind, text }];
  return log.length > LOG_LIMIT ? log.slice(log.length - LOG_LIMIT) : log;
}

export function reduce(
  state: PracticeState,
  ev: PracticeEvent,
  ctx: PracticeCtx = {},
): PracticeState {
  switch (ev.type) {
    case "key": {
      const pressed = new Set(state.pressed);
      if (ev.pressed) pressed.add(ev.position);
      else pressed.delete(ev.position);
      const cap = ctx.capLabels?.[ev.position];
      const name = cap ? pretty(cap) : `#${ev.position}`;
      return {
        ...state,
        pressed,
        log: push(state, "key", `${name}${ev.pressed ? "↓" : "↑"}`),
        seq: state.seq + 1,
      };
    }
    case "layers": {
      const ids = ev.ids ?? layerIds(ev.mask);
      const names = ids.map((id) => ctx.layerNames?.[id] ?? `L${id}`);
      return {
        ...state,
        mask: ev.mask,
        highest: ev.highest,
        activeIds: ids,
        log: push(state, "layers", `→ ${names.join(" + ") || "—"}`),
        seq: state.seq + 1,
      };
    }
    case "keycode": {
      const text = pretty(keycodeText(ev, ctx.rev ?? new Map()));
      if (ev.pressed) {
        // Nothing is being held, so no cap produced this: an encoder turn.
        const chip: OutputChip = { text, encoder: state.pressed.size === 0 };
        return {
          ...state,
          output: [...state.output, chip],
          last: chip,
          log: push(state, "keycode", `${chip.encoder ? "↻ " : ""}${text}↓`),
          seq: state.seq + 1,
        };
      }
      const at = state.output.findIndex((c) => c.text === text);
      const output = at === -1 ? state.output : state.output.filter((_, i) => i !== at);
      return {
        ...state,
        output,
        log: push(state, "keycode", `${text}↑`),
        seq: state.seq + 1,
      };
    }
  }
}

/** Empty the log and the chord, keep what the board is showing. */
export function clearLog(state: PracticeState): PracticeState {
  return { ...state, log: [], output: [], last: null };
}

export { reverseKeycodes };
