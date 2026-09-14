import { useMemo, type ReactNode } from "react";
import { bounds, toBoxes, UNIT } from "../geometry";
import { encoderLayerBinding, labelText } from "../board";
import type { Decor } from "../decor";
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
  Selection,
} from "../types";
import { layerLabel } from "../types";
import ComboOverlay from "./ComboOverlay";
import EncoderKnob from "./EncoderKnob";
import TrackballDecor from "./TrackballDecor";
import { useTooltip } from "./Tooltip";

const PAD = 14;
/** Gap between a cap and its 1u cell, in px: keys on a 100-unit pitch get a
 *  ~10% gutter (real caps are ~18mm on a 19mm pitch) and the fanned thumb
 *  keys stop touching each other. */
const G = 3;
/** Behaviors whose name adds nothing over the label itself. */
const PLAIN = new Set(["Key Press", "Transparent", "None"]);

/** Short marker for the behaviour, sized to fit inside a 1u key cap. */
const TAG: Record<string, string> = {
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
  behaviors,
  keycodes,
  layers,
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
  /** Only for the hover tooltip: what a behaviour id and its params mean. */
  behaviors: Behavior[];
  keycodes: Record<string, number>;
  layers: Layer[];
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
  ) => {
    const b = byId.get(binding.behavior_id);
    return (
      <>
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
    return (
      <>
        <TipHead>
          コンボ {c.index}: {keys} → {labelText(c.effective.label, "?")}
        </TipHead>
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

  const selPos = selection?.kind === "key" ? selection.pos : null;
  const selCombo = selection?.kind === "combo" ? selection.index : null;
  const selSensor = selection?.kind === "encoder" ? selection.sensor : null;

  /** Keys of the combo the pointer is over, or of the selected one. */
  const lit = useMemo(() => {
    const idx = hoverCombo ?? selCombo;
    if (idx === null) return new Set<number>();
    return new Set(combos.find((c) => c.index === idx)?.key_positions ?? []);
  }, [combos, hoverCombo, selCombo]);
  /** Caps of the hovered/selected combo take the same accent as its bridges. */
  const litColor = "#38bdf8";

  if (!boxes.length) return <div className="p-8 text-zinc-500">レイアウト情報がありません。</div>;

  // The knobs and the trackball sit outside the key bounds, so fold them in
  // before padding or they get clipped by the viewBox.
  let { minX, minY, maxX, maxY } = bb;
  const circles = [
    ...(decor?.encoders ?? []).map((e) => ({ cx: e.cx, cy: e.cy, r: e.r })),
    ...(decor?.trackball ? [decor.trackball] : []),
  ];
  for (const c of circles) {
    minX = Math.min(minX, (c.cx - c.r) * UNIT);
    minY = Math.min(minY, (c.cy - c.r) * UNIT);
    maxX = Math.max(maxX, (c.cx + c.r) * UNIT);
    maxY = Math.max(maxY, (c.cy + c.r) * UNIT + 24); // room for the two captions
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
          const content = bindingTip(binding, label, head);
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
              <g transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2})`}>
                {ghost ? <KeyLabel label={ghost} dim /> : <KeyLabel label={label} />}
              </g>
              {transparent && (
                <text x={b.x + G + 5} y={b.y + G + 13} className="fill-zinc-600 text-[9px]">
                  {"▽"}
                </text>
              )}
              {tag(label.behavior) && (
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

        {(decor?.encoders ?? []).map((e) => {
          const lb = encoder ? encoderLayerBinding(encoder, e.sensor, layer.index) : undefined;
          return (
            <EncoderKnob
              key={e.sensor}
              cx={e.cx * UNIT}
              cy={e.cy * UNIT}
              r={e.r * UNIT}
              sensor={e.sensor}
              layerBinding={lb}
              selected={selSensor === e.sensor}
              onSelect={onSelect}
              tip={tip}
              tipContent={
                <>
                  <TipHead>
                    エンコーダ {e.sensor} · レイヤー {layer.index} {layerLabel(layer)}
                  </TipHead>
                  {lb ? (
                    <>
                      <p className="text-zinc-300">↻ cw: {labelText(lb.cw.label)}</p>
                      <p className="text-zinc-300">↺ ccw: {labelText(lb.ccw.label)}</p>
                      <TipBehavior name={lb.cw.label?.behavior} />
                      <TipRaw>tap_ms {lb.cw.tap_ms}</TipRaw>
                    </>
                  ) : (
                    <p className="text-zinc-400">このレイヤーには sensor-bindings がありません</p>
                  )}
                </>
              }
            />
          );
        })}

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
