/**
 * How you get *into* a layer.
 *
 * The board answers "what does this key do"; it never answered the question
 * you actually ask when you pick SETTING out of a list of thirteen names —
 * *which key do I hold to be there?* That answer is scattered: mostly it is a
 * `&mo 8` sitting on some other layer, but it can also be a conditional layer
 * that needs two others held at once, a trackball that switches layer on its
 * own, or something the firmware hard-codes and no RPC reports.
 *
 * This module gathers all four into one list, purely from the documents the UI
 * already has (`/api/state`, `/api/features` and the local `decor`), so every
 * view — the board, the banner above it, the layer card — says the same thing.
 */
import { BEHAVIOR_TARGET_LAYER } from "./help";
import { paramKind } from "./params";
import type { Decor } from "./decor";
import type { Features, ParamDesc, State } from "./types";

/** The gesture that puts you on the layer. */
export type ActivatorHow = "hold" | "tap" | "toggle" | "sticky";

export type Activator =
  | { kind: "key"; layer: number; pos: number; how: ActivatorHow; behavior: string }
  | { kind: "condlayer"; ifLayers: number[] }
  | { kind: "trackball"; text: string }
  | { kind: "note"; text: string };

/** The key-shaped member, which the board and the banner work with directly. */
export type KeyActivator = Extract<Activator, { kind: "key" }>;

/** One Japanese word per gesture, for the board tag and the banner chip. */
export const HOW_JA: Record<ActivatorHow, string> = {
  hold: "長押し",
  tap: "タップ",
  toggle: "トグル",
  sticky: "スティッキー",
};

/** What the base layer is told when nothing has to be pressed to be there. */
export const BASE_LAYER_NOTE = "起動時のレイヤー";

/** Behaviours whose gesture is not the default hold. `Mod-Tap` is listed as
 *  `null` on purpose: both of its parameters are keycodes, so it can never
 *  name a layer, and saying so here keeps the exclusion visible. */
const HOW_BY_BEHAVIOR: Record<string, ActivatorHow | null> = {
  "Momentary Layer": "hold",
  "Layer-Tap": "hold",
  "Mod-Tap": null,
  "To Layer": "tap",
  "Toggle Layer": "toggle",
  "Sticky Layer": "sticky",
};

/** Anything else that carries a `layer_id` parameter holds it while pressed —
 *  which is what the roBa LAYER_TAP_TO_* behaviours do with their param1. */
function howFor(behavior: string): ActivatorHow | null {
  return behavior in HOW_BY_BEHAVIOR ? HOW_BY_BEHAVIOR[behavior] : "hold";
}

/** Every way to reach `target`, in reading order: keys first (by layer, then
 *  by position), then conditional layers, the trackball, and last the notes
 *  for what the firmware decides on its own.
 *
 *  `features` is null while /api/features is still loading — the key scan
 *  needs only /api/state, so the list is useful before the rest arrives. */
export function layerActivators(
  state: State,
  features: Features | null,
  decor: Decor | undefined,
  target: number,
): Activator[] {
  const byId = new Map(state.behaviors.map((b) => [b.id, b]));
  const keys: KeyActivator[] = [];
  /** A binding can name the same layer twice (a hold-tap onto itself); the
   *  user only needs to be pointed at the key once per gesture. */
  const seen = new Set<string>();
  const push = (layer: number, pos: number, how: ActivatorHow | null, behavior: string) => {
    if (!how) return;
    const key = `${layer}:${pos}:${how}`;
    if (seen.has(key)) return;
    seen.add(key);
    keys.push({ kind: "key", layer, pos, how, behavior });
  };

  for (const layer of state.keymap.layers) {
    for (const binding of layer.bindings) {
      const behavior = byId.get(binding.behavior_id);
      const name = binding.label?.behavior ?? behavior?.display_name;
      if (!name) continue;
      const meta = behavior?.metadata?.[0];
      const slots: [ParamDesc[], number][] = meta
        ? [
            [meta.param1, binding.param1],
            [meta.param2, binding.param2],
          ]
        : [];
      for (const [descs, value] of slots) {
        if (paramKind(descs ?? []) === "layer_id" && value === target) {
          push(layer.index, binding.pos, howFor(name), name);
        }
      }
      // A destination baked into the behaviour itself, which no parameter shows.
      if (BEHAVIOR_TARGET_LAYER[name] === target) {
        push(layer.index, binding.pos, "tap", name);
      }
    }
  }
  keys.sort((a, b) => a.layer - b.layer || a.pos - b.pos);

  const rest: Activator[] = [];
  const condlayers = features?.condlayers;
  if (condlayers?.available) {
    for (const e of condlayers.entries) {
      if (e.then_layer === target) rest.push({ kind: "condlayer", ifLayers: e.if_layers });
    }
  }

  const trackball = features?.trackball;
  if (trackball?.available) {
    for (const p of trackball.processors) {
      if (p.temp_layer_enabled && p.temp_layer_layer === target) {
        rest.push({ kind: "trackball", text: "トラックボールを動かすと一時的に" });
      }
    }
  }

  const name = state.keymap.layers.find((l) => l.index === target)?.name;
  const note = name ? decor?.layerNotes?.[name] : undefined;
  if (note) rest.push({ kind: "note", text: note });

  const all = [...keys, ...rest];
  // The base layer is where the keyboard wakes up: nothing has to be pressed,
  // and an empty list would read as "unreachable" rather than "always on".
  if (!all.length && target === 0) return [{ kind: "note", text: BASE_LAYER_NOTE }];
  return all;
}

/** One entry per (position, gesture), with the layers it works from — the same
 *  thumb key is an activator on DEFAULT, APPLE and ANDROID at once, and that is
 *  one key to press, not three. Order follows layerActivators(). */
export function groupKeyActivators(
  activators: Activator[],
): { pos: number; how: ActivatorHow; on: number[] }[] {
  const by = new Map<string, { pos: number; how: ActivatorHow; on: number[] }>();
  for (const a of activators) {
    if (a.kind !== "key") continue;
    const k = `${a.pos}:${a.how}`;
    const hit = by.get(k);
    if (hit) hit.on.push(a.layer);
    else by.set(k, { pos: a.pos, how: a.how, on: [a.layer] });
  }
  return [...by.values()];
}

/** One row of the layer-switch list: a key, the gesture, and where it takes
 *  you — gathered across *every* layer, not just the one on screen. The board
 *  only marks the keys that reach the layer you are looking at, so a chord like
 *  SETTING+J (which reaches APPLE) is invisible until you select APPLE; this is
 *  the view that shows all of them at once. */
export interface LayerKeyRow {
  pos: number;
  how: ActivatorHow;
  /** Layer index this key takes you to. */
  target: number;
  /** Layers the key has this effect on. */
  on: number[];
  behavior: string;
}

export function layerKeyRows(byTarget: Map<number, Activator[]>): LayerKeyRow[] {
  const rows: LayerKeyRow[] = [];
  for (const [target, acts] of byTarget) {
    for (const g of groupKeyActivators(acts)) {
      const behavior = acts.find(
        (a): a is KeyActivator => a.kind === "key" && a.pos === g.pos && a.how === g.how,
      )?.behavior;
      rows.push({ pos: g.pos, how: g.how, target, on: g.on, behavior: behavior ?? "" });
    }
  }
  // Reading order: where your hands are (position), then what you do with it.
  const HOW_ORDER: ActivatorHow[] = ["hold", "tap", "toggle", "sticky"];
  return rows.sort(
    (a, b) =>
      a.pos - b.pos || HOW_ORDER.indexOf(a.how) - HOW_ORDER.indexOf(b.how) || a.target - b.target,
  );
}
