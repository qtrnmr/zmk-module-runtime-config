/**
 * One Japanese sentence for a binding: what this key actually does, without
 * hovering anything.
 *
 * The board's labels are already there (`▽`, `MO 8`, `LCTRL/A`) and so is the
 * behaviour's help text, but neither says what THIS key does — one is too
 * short and the other too general. This fills the gap between them, and is
 * used both in the inspector's "現在" card and as the first line of the board
 * tooltip.
 *
 * Everything specific to roBa (LAYER_TAP_TO_*, TO_*) follows
 * qtrnmr/zmk-config-roBa config/roBa.keymap; behaviours this file has no
 * sentence for fall back to BEHAVIOR_JA plus the parameter lines the tooltip
 * already showed, so a behaviour from another keyboard still reads sensibly.
 */
import { labelText } from "./board";
import { behaviorJa, keycodeHelp, paramLines } from "./help";
import { keycodeName, stepPreview } from "./macroFormat";
import { pretty } from "./prettyKeycode";
import type { Behavior, Label, Layer, Macros } from "./types";
import { layerLabel } from "./types";

export interface DescribeCtx {
  /** Behaviours by local id, for the metadata the fallback needs. */
  byId: Map<number, Behavior>;
  layers: Layer[];
  /** Keycode value -> canonical name, from reverseKeycodes(). */
  rev: Map<number, string>;
  /** The base layer and this binding's position: what a ▽ inherits. */
  base?: Layer;
  pos?: number;
  /** Runtime macro slots, so a rt_macro can quote its own steps. */
  macros?: Macros | null;
}

export interface DescribableBinding {
  behavior_id: number;
  param1: number;
  param2: number;
  label?: Label;
}

/** How much of a macro's step list fits in one sentence. */
const PREVIEW_CHARS = 40;

/** A keycode as something you can read out loud: the cap's own text, plus the
 *  canonical name when the cap is a bare symbol (`␣ (SPC)`). */
function keyWord(rev: Map<number, string>, value: number): string {
  const canonical = keycodeName(rev, value);
  const shown = pretty(canonical);
  if (shown === canonical) return canonical;
  // ASCII words (Ctrl, Mute, 1) stand on their own; ␣ ⌫ ⌘⇥ かな do not.
  return /^[\x20-\x7e]+$/.test(shown) ? shown : `${shown} (${canonical})`;
}

function layerPhrase(ctx: DescribeCtx, index: number): string {
  const l = ctx.layers.find((x) => x.index === index);
  return `${l ? layerLabel(l) : `L${index}`} レイヤー`;
}

/** The trailing 。 of a dictionary sentence, dropped so it can be embedded. */
function clip(text: string): string {
  return text.replace(/。$/, "");
}

export function describeBinding(b: DescribableBinding, ctx: DescribeCtx): string {
  const behavior = ctx.byId.get(b.behavior_id);
  const name = b.label?.behavior ?? behavior?.display_name;
  if (!name || name === "?") return "";

  const key1 = () => keyWord(ctx.rev, b.param1);
  const key2 = () => keyWord(ctx.rev, b.param2);
  const layer1 = () => layerPhrase(ctx, b.param1);

  switch (name) {
    case "Key Press": {
      const help = keycodeHelp(keycodeName(ctx.rev, b.param1));
      return `キー入力: ${key1()}${help ? ` · ${clip(help)}` : ""}`;
    }
    case "Mod-Tap":
      return `長押しで ${key1()}、タップで ${key2()}`;
    case "Layer-Tap":
      return `長押しで ${layer1()}、タップで ${key2()}`;
    case "LAYER_TAP_TO_0":
      return `長押しで ${layer1()}、タップで Windows に戻って ${key2()}`;
    case "LAYER_TAP_TO_APPLE":
      return `長押しで ${layer1()}、タップで Mac に戻って ${key2()}`;
    case "LAYER_TAP_TO_ANDROID":
      return `長押しで ${layer1()}、タップで Android に戻って ${key2()}`;
    case "Momentary Layer":
      return `押している間 ${layer1()}`;
    case "To Layer":
      return `${layer1()} に切り替え (既定レイヤー以外は解除)`;
    case "Toggle Layer":
      return `${layer1()} を押すたびに ON / OFF`;
    case "Sticky Layer":
      return `次の 1 打だけ ${layer1()}`;
    case "Sticky Key":
      return `次の 1 打だけ ${key1()} を効かせる`;
    case "Transparent": {
      const ghost = ctx.pos === undefined ? undefined : ctx.base?.bindings[ctx.pos]?.label;
      if (!ghost) return "透過: このレイヤーでは何もせず、下のレイヤーの割当が効く";
      const base = ctx.base ? layerLabel(ctx.base) : "下のレイヤー";
      return `透過: このレイヤーでは何もせず、下の ${base} の ${labelText(ghost)} が効く`;
    }
    case "None":
      return "無効: 何も起こらない (下のレイヤーにも渡さない)";
    case "rt_macro": {
      const slots = ctx.macros?.available ? ctx.macros.slots : undefined;
      const steps = slots?.find((s) => s.slot === b.param1)?.steps;
      if (!steps) return `ランタイムマクロ slot ${b.param1}`;
      const p = stepPreview(steps);
      const cut = p.length > PREVIEW_CHARS ? `${p.slice(0, PREVIEW_CHARS)}…` : p;
      return `ランタイムマクロ slot ${b.param1} (中身: ${cut})`;
    }
    case "TO_LAYER_0":
      return `Windows (レイヤー 0) に戻ってから ${key1()} を送る`;
    case "TO_APPLE_DEFAULT":
      return `Mac (レイヤー 1) に戻ってから ${key1()} を送る`;
    case "TO_ANDROID":
      return `Android (レイヤー 2) に戻ってから ${key1()} を送る`;
  }

  const ja = behaviorJa(name);
  const lines = paramLines(behavior, b, ctx.layers, ctx.rev);
  return lines.length ? `${ja}: ${lines.join(" · ")}` : ja;
}
