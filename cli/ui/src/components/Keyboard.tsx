import { useMemo, type ReactNode } from "react";
import { HOW_JA, type Activator, type ActivatorHow, type KeyActivator } from "../activators";
import { bounds, toBoxes, UNIT } from "../geometry";
import { encoderLayerBinding, labelText } from "../board";
import type { Decor } from "../decor";
import { describeBinding } from "../describe";
import { BEHAVIOR_HELP, paramLines } from "../help";
import { reverseKeycodes } from "../macroFormat";
import { pretty } from "../prettyKeycode";
import type {
  Behavior,
  Binding,
  ComboEntry,
  Encoder,
  Label,
  Layer,
  LayoutKey,
  Macros,
  Selection,
} from "../types";
import { layerLabel } from "../types";
import ComboOverlay from "./ComboOverlay";
import TrackballDecor from "./TrackballDecor";
import { useTooltip } from "./Tooltip";

const PAD = 14;
/** Gap between a cap and its 1u cell, in px: keys on a 100-unit pitch get a
 *  ~10% gutter (real caps are ~18mm on a 19mm pitch) and the fanned thumb
 *  keys stop touching each other. */
const G = 3;
/** Behaviors whose name adds nothing over the label itself. */
const PLAIN = new Set(["Key Press", "Transparent", "None"]);

/** Short marker for the behaviour, sized to fit inside a 1u key cap.
 *  Exported so the legend explains every abbreviation the board can draw. */
export const TAG: Record<string, string> = {
  "Momentary Layer": "MO",
  "Layer-Tap": "LT",
  "Mod-Tap": "MT",
  "To Layer": "TO",
  "Toggle Layer": "TG",
  "Sticky Key": "SK",
  "Sticky Layer": "SL",
  "Key Toggle": "KT",
  "Key Repeat": "KR",
  "Caps Word": "CW",
  "Mouse Key Press": "MKP",
  Bluetooth: "BT",
  "Studio Unlock": "UNLK",
  Bootloader: "BOOT",
};

/** The gestures at one position, each with the layers it works from — the
 *  same thumb key is usually an activator on DEFAULT, APPLE and ANDROID at
 *  once, and that reads as one line, not three. */
function howGroups(acts: KeyActivator[]): [ActivatorHow, number[]][] {
  const by = new Map<ActivatorHow, number[]>();
  for (const a of acts) {
    const on = by.get(a.how);
    on ? on.push(a.layer) : by.set(a.how, [a.layer]);
  }
  return [...by];
}

function layerName(layers: Layer[], index: number): string {
  const l = layers.find((x) => x.index === index);
  return l ? layerLabel(l) : `L${index}`;
}

function tag(behavior: string): string {
  if (PLAIN.has(behavior)) return "";
  const known = TAG[behavior];
  if (known) return known;
  return behavior.length <= 6 ? behavior : behavior.slice(0, 5) + "…";
}

/** Font size that keeps a label inside a ~54px cap: 16px up to 4 chars,
 *  then smaller for names like SETTING / FUNCTION. */
function fit(text: string): string {
  if (text.length <= 4) return "text-[16px]";
  if (text.length <= 6) return "text-[13px]";
  if (text.length <= 8) return "text-[11px]";
  return "text-[9px]";
}

function KeyLabel({ label, dim }: { label: Label; dim?: boolean }) {
  const cls = dim ? "fill-zinc-500" : "fill-zinc-100";
  if ("text" in label) {
    const t = pretty(label.text);
    return (
      <text textAnchor="middle" dominantBaseline="central" className={`${cls} ${fit(t)}`}>
        {t}
      </text>
    );
  }
  return (
    <>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={-17}
        className="fill-zinc-400 text-[10px]"
      >
        {pretty(label.hold)}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={6}
        className={`${cls} ${fit(pretty(label.tap))}`}
      >
        {pretty(label.tap)}
      </text>
    </>
  );
}

/** The dark lines every board tooltip is built from. */
function TipHead({ children }: { children: ReactNode }) {
  return <p className="font-medium text-zinc-100">{children}</p>;
}
function TipRaw({ children }: { children: ReactNode }) {
  return <p className="pt-0.5 font-mono text-[10px] text-zinc-500">{children}</p>;
}

/** behaviour name + what it does, shared by keys, combos and the encoder. */
function TipBehavior({ name }: { name?: string }) {
  if (!name) return null;
  return (
    <>
      <p className="text-sky-300">{name}</p>
      {BEHAVIOR_HELP[name] && <p className="text-zinc-400">{BEHAVIOR_HELP[name]}</p>}
    </>
  );
}

export default function Keyboard({
  layout,
  layer,
  base,
  selection,
  onSelect,
  combos,
  showCombos,
  encoder,
  decor,
  hoverCombo,
  onHoverCombo,
  onTrackball,
  activators,
  behaviors,
  keycodes,
  layers,
  macros,
}: {
  layout: { name: string; keys: LayoutKey[] };
  layer: Layer;
  base: Layer;
  selection: Selection | null;
  onSelect(sel: Selection): void;
  /** Already filtered with activeCombos() for the current layer. */
  combos: ComboEntry[];
  showCombos: boolean;
  encoder: Encoder | null;
  decor?: Decor;
  hoverCombo: number | null;
  onHoverCombo(index: number | null): void;
  onTrackball(): void;
  /** Every way into the layer being shown; only the key-shaped ones are drawn. */
  activators: Activator[];
  /** Only for the hover tooltip: what a behaviour id and its params mean. */
  behaviors: Behavior[];
  keycodes: Record<string, number>;
  layers: Layer[];
  /** Only so a rt_macro's tooltip can quote its own steps. */
  macros: Macros | null;
}) {
  const boxes = useMemo(() => toBoxes(layout.keys), [layout.keys]);
  const bb = useMemo(() => bounds(boxes), [boxes]);
  const tip = useTooltip();
  const byId = useMemo(() => new Map(behaviors.map((b) => [b.id, b])), [behaviors]);
  const rev = useMemo(() => reverseKeycodes(keycodes), [keycodes]);

  /** What a binding does, in the four lines the tooltip promises. */
  const bindingTip = (
    binding: { behavior_id: number; param1: number; param2: number },
    label: Label | undefined,
    head: ReactNode,
    pos?: number,
  ) => {
    const b = byId.get(binding.behavior_id);
    // The same sentence the inspector's card shows, so the board and the card
    // never explain the same key two different ways.
    const said = describeBinding(
      { ...binding, label },
      { byId, layers, rev, base, pos, macros },
    );
    return (
      <>
        {said && <TipHead>{said}</TipHead>}
        {head}
        <TipBehavior name={label?.behavior ?? b?.display_name} />
        {paramLines(b, binding, layers, rev).map((l) => (
          <p key={l} className="text-zinc-300">
            {l}
          </p>
        ))}
        <TipRaw>
          #{binding.behavior_id} {binding.param1} {binding.param2}
        </TipRaw>
      </>
    );
  };

  /** `S + A → Esc`, plus what decides whether it fires at all. */
  const comboTip = (c: ComboEntry) => {
    const keys = c.key_positions
      .map((pos) => {
        const l = base?.bindings[pos]?.label;
        return !l ? "?" : "text" in l ? pretty(l.text) : pretty(l.tap);
      })
      .join(" + ");
    const on = c.layers.length
      ? c.layers
          .map((i) => {
            const l = layers.find((x) => x.index === i);
            return l ? `${i} ${layerLabel(l)}` : String(i);
          })
          .join(", ")
      : "全レイヤー";
    const said = describeBinding(c.effective, { byId, layers, rev, base, macros });
    return (
      <>
        <TipHead>
          コンボ {c.index}: {keys} → {labelText(c.effective.label, "?")}
        </TipHead>
        {said && <p className="text-zinc-100">{said}</p>}
        <TipBehavior name={c.effective.label?.behavior} />
        {paramLines(byId.get(c.effective.behavior_id), c.effective, layers, rev).map((l) => (
          <p key={l} className="text-zinc-300">
            {l}
          </p>
        ))}
        <p className="text-zinc-400">
          timeout {c.timeout_ms}ms · 有効レイヤー: {on}
        </p>
        <TipRaw>
          #{c.effective.behavior_id} {c.effective.param1} {c.effective.param2}
        </TipRaw>
      </>
    );
  };

  /** The keys that lead here, by position. A position can be an activator on
   *  several layers at once (the same thumb key on DEFAULT / APPLE / ANDROID),
   *  and the mark belongs to the position, not to the layer being shown. */
  const actByPos = useMemo(() => {
    const m = new Map<number, KeyActivator[]>();
    for (const a of activators) {
      if (a.kind !== "key") continue;
      const at = m.get(a.pos);
      at ? at.push(a) : m.set(a.pos, [a]);
    }
    return m;
  }, [activators]);

  const selPos = selection?.kind === "key" ? selection.pos : null;
  const selCombo = selection?.kind === "combo" ? selection.index : null;
  const encoderAt = useMemo(
    () => new Map((decor?.encoders ?? []).map((e) => [e.pos, e.sensor])),
    [decor],
  );

  /** Keys of the combo the pointer is over, or of the selected one. */
  const lit = useMemo(() => {
    const idx = hoverCombo ?? selCombo;
    if (idx === null) return new Set<number>();
    return new Set(combos.find((c) => c.index === idx)?.key_positions ?? []);
  }, [combos, hoverCombo, selCombo]);
  /** Caps of the hovered/selected combo take the same accent as its bridges. */
  const litColor = "#38bdf8";

  if (!boxes.length) return <div className="p-8 text-zinc-500">レイアウト情報がありません。</div>;

  // The trackball sits outside the key bounds, so fold it in before padding
  // or it gets clipped by the viewBox.
  let { minX, minY, maxX, maxY } = bb;
  for (const c of decor?.trackball ? [decor.trackball] : []) {
    minX = Math.min(minX, (c.cx - c.r) * UNIT);
    minY = Math.min(minY, (c.cy - c.r) * UNIT);
    maxX = Math.max(maxX, (c.cx + c.r) * UNIT);
    maxY = Math.max(maxY, (c.cy + c.r) * UNIT);
  }
  const viewBox = [minX - PAD, minY - PAD, maxX - minX + PAD * 2, maxY - minY + PAD * 2].join(" ");

  return (
    <div className="h-full w-full px-4 pt-2 pb-4">
      {tip.node}
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMin meet" className="h-full w-full">
        <defs>
          <filter id="capShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.2" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        {boxes.map((b) => {
          const binding: Binding | undefined = layer.bindings[b.pos];
          if (!binding) return null;
          const label = binding.label;
          const transparent = "text" in label && label.text === "▽";
          const ghost = transparent ? base.bindings[b.pos]?.label : undefined;
          const isSel = selPos === b.pos;
          const isLit = lit.has(b.pos);
          // A ▽ key says what it inherits; everything else states its own label.
          const head = transparent ? (
            <TipHead>▽ → ベース層: {labelText(ghost)}</TipHead>
          ) : "text" in label ? (
            <TipHead>{pretty(label.text)}</TipHead>
          ) : (
            <>
              <TipHead>hold: {pretty(label.hold)}</TipHead>
              <TipHead>tap: {pretty(label.tap)}</TipHead>
            </>
          );
          const sensor = encoderAt.get(b.pos);
          const lb =
            sensor !== undefined && encoder
              ? encoderLayerBinding(encoder, sensor, layer.index)
              : undefined;
          const acts = actByPos.get(b.pos) ?? [];
          const main =
            sensor === undefined ? (
              bindingTip(binding, label, head, b.pos)
            ) : (
              <>
                {bindingTip(binding, label, head, b.pos)}
                <div className="mt-1 border-t border-zinc-800 pt-1">
                  <TipHead>エンコーダ {sensor} (押し込み = このキー)</TipHead>
                  {lb ? (
                    <>
                      <p className="text-zinc-300">↻ cw: {labelText(lb.cw.label)}</p>
                      <p className="text-zinc-300">↺ ccw: {labelText(lb.ccw.label)}</p>
                      <TipRaw>tap_ms {lb.cw.tap_ms}</TipRaw>
                    </>
                  ) : (
                    <p className="text-zinc-400">このレイヤーには sensor-bindings がありません</p>
                  )}
                </div>
              </>
            );
          const content = acts.length ? (
            <>
              {main}
              <div className="mt-1 border-t border-zinc-800 pt-1">
                {howGroups(acts).map(([how, on]) => (
                  <p key={how} className="text-violet-300">
                    このレイヤーへ: {on.map((i) => layerName(layers, i)).join(" · ")} の この位置を
                    {HOW_JA[how]}
                  </p>
                ))}
              </div>
            </>
          ) : (
            main
          );
          return (
            <g
              key={b.pos}
              transform={`rotate(${b.deg} ${b.cx} ${b.cy})`}
              onClick={() => onSelect({ kind: "key", pos: b.pos })}
              onMouseEnter={(e) => tip.show(e, content)}
              onMouseMove={(e) => tip.show(e, content)}
              onMouseLeave={tip.hide}
              className="group cursor-pointer"
            >
              <rect
                x={b.x + G}
                y={b.y + G}
                width={b.w - 2 * G}
                height={b.h - 2 * G}
                rx={7}
                filter="url(#capShadow)"
                className={
                  (isLit
                    ? ""
                    : transparent
                      ? "fill-zinc-900/60 group-hover:fill-zinc-800"
                      : "fill-zinc-800 group-hover:fill-zinc-700") +
                  " " +
                  (isSel ? "stroke-sky-400" : isLit ? "" : "stroke-zinc-700")
                }
                style={
                  isLit
                    ? { fill: litColor, fillOpacity: 0.18, stroke: isSel ? undefined : litColor }
                    : undefined
                }
                strokeWidth={isSel ? 3 : isLit ? 2 : 1}
              />
              {sensor !== undefined && (
                // A horizontal wheel seen from above: ridges across the cap and
                // the two rotation bindings along its top and bottom edges.
                <g pointerEvents="none">
                  {[0.3, 0.42, 0.54, 0.66].map((f) => (
                    <line
                      key={f}
                      x1={b.x + G + 8}
                      x2={b.x + b.w - G - 8}
                      y1={b.y + b.h * f}
                      y2={b.y + b.h * f}
                      className="stroke-zinc-600/70"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  ))}
                  <text
                    x={b.x + b.w / 2}
                    y={b.y + G + 9}
                    textAnchor="middle"
                    className="fill-zinc-400 text-[8px]"
                  >
                    ↻ {labelText(lb?.cw.label, "—")}
                  </text>
                  <text
                    x={b.x + b.w / 2}
                    y={b.y + b.h - G - 4}
                    textAnchor="middle"
                    className="fill-zinc-400 text-[8px]"
                  >
                    ↺ {labelText(lb?.ccw.label, "—")}
                  </text>
                </g>
              )}
              {acts.length > 0 && (
                // Deliberately not the selection's frame: this key is not the
                // one you are looking at, it is the one you would hold to be
                // here — so it gets its own colour along the top edge.
                <g pointerEvents="none">
                  <rect
                    x={b.x + G + 4}
                    y={b.y + G + 1.5}
                    width={b.w - 2 * G - 8}
                    height={3}
                    rx={1.5}
                    className="fill-violet-400"
                  />
                  <text
                    x={b.x + G + (transparent ? 13 : 4)}
                    y={b.y + G + 14}
                    className="fill-violet-300 text-[8px]"
                  >
                    {howGroups(acts)
                      .map(([how]) => HOW_JA[how])
                      .join("/")}
                  </text>
                </g>
              )}
              <g transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2})`}>
                {ghost ? <KeyLabel label={ghost} dim /> : <KeyLabel label={label} />}
              </g>
              {transparent && (
                <text x={b.x + G + 5} y={b.y + G + 13} className="fill-zinc-600 text-[9px]">
                  {"▽"}
                </text>
              )}
              {sensor === undefined && tag(label.behavior) && (
                <text
                  x={b.x + b.w - G - 4}
                  y={b.y + b.h - G - 4}
                  textAnchor="end"
                  className="fill-sky-500/70 text-[8px]"
                >
                  {tag(label.behavior)}
                </text>
              )}
            </g>
          );
        })}

        {showCombos && (
          <ComboOverlay
            combos={combos}
            boxes={boxes}
            selectedIndex={selCombo}
            hoverIndex={hoverCombo}
            onHover={onHoverCombo}
            onSelect={onSelect}
            tip={tip}
            tipFor={comboTip}
          />
        )}

        {decor?.trackball && (
          <TrackballDecor
            cx={decor.trackball.cx * UNIT}
            cy={decor.trackball.cy * UNIT}
            r={decor.trackball.r * UNIT}
            onClick={onTrackball}
            tip={tip}
            tipContent={
              <>
                <TipHead>トラックボール</TipHead>
                <p className="text-zinc-400">クリックで設定 (速度・反転・軸スナップ・一時レイヤー)。</p>
              </>
            }
          />
        )}
      </svg>
    </div>
  );
}
