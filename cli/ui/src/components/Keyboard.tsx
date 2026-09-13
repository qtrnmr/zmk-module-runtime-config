import { useMemo } from "react";
import { bounds, toBoxes, UNIT } from "../geometry";
import { encoderLayerBinding } from "../board";
import type { Decor } from "../decor";
import { pretty } from "../prettyKeycode";
import type { Binding, ComboEntry, Encoder, Label, Layer, LayoutKey, Selection } from "../types";
import ComboOverlay from "./ComboOverlay";
import EncoderKnob from "./EncoderKnob";
import TrackballDecor from "./TrackballDecor";

const PAD = 14;
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

function KeyLabel({ label, dim }: { label: Label; dim?: boolean }) {
  const cls = dim ? "fill-zinc-500" : "fill-zinc-100";
  if ("text" in label) {
    return (
      <text textAnchor="middle" dominantBaseline="central" className={`${cls} text-[16px]`}>
        {pretty(label.text)}
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
      <text textAnchor="middle" dominantBaseline="central" y={6} className={`${cls} text-[16px]`}>
        {pretty(label.tap)}
      </text>
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
}) {
  const boxes = useMemo(() => toBoxes(layout.keys), [layout.keys]);
  const bb = useMemo(() => bounds(boxes), [boxes]);

  const selPos = selection?.kind === "key" ? selection.pos : null;
  const selCombo = selection?.kind === "combo" ? selection.index : null;
  const selSensor = selection?.kind === "encoder" ? selection.sensor : null;

  /** Keys of the combo the pointer is over, or of the selected one. */
  const lit = useMemo(() => {
    const idx = hoverCombo ?? selCombo;
    if (idx === null) return new Set<number>();
    return new Set(combos.find((c) => c.index === idx)?.key_positions ?? []);
  }, [combos, hoverCombo, selCombo]);

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
          return (
            <g
              key={b.pos}
              transform={`rotate(${b.deg} ${b.cx} ${b.cy})`}
              onClick={() => onSelect({ kind: "key", pos: b.pos })}
              className="group cursor-pointer"
            >
              <title>{`pos ${b.pos} · ${label.behavior} · #${binding.behavior_id} ${binding.param1} ${binding.param2}`}</title>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={8}
                filter="url(#capShadow)"
                className={
                  (isLit
                    ? "fill-amber-500/15"
                    : transparent
                      ? "fill-zinc-900/60 group-hover:fill-zinc-800"
                      : "fill-zinc-800 group-hover:fill-zinc-700") +
                  " " +
                  (isSel ? "stroke-sky-400" : isLit ? "stroke-amber-400" : "stroke-zinc-700")
                }
                strokeWidth={isSel ? 3 : isLit ? 2 : 1}
              />
              {/* 1px inner top highlight, so the cap reads as a physical key */}
              <rect
                x={b.x + 3}
                y={b.y + 2}
                width={b.w - 6}
                height={2}
                rx={1}
                className="fill-zinc-700/70"
              />
              <g transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2})`}>
                {ghost ? <KeyLabel label={ghost} dim /> : <KeyLabel label={label} />}
              </g>
              {transparent && (
                <text x={b.x + 5} y={b.y + 13} className="fill-zinc-600 text-[9px]">
                  {"▽"}
                </text>
              )}
              {tag(label.behavior) && (
                <text
                  x={b.x + b.w - 4}
                  y={b.y + b.h - 4}
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
          />
        )}

        {(decor?.encoders ?? []).map((e) => (
          <EncoderKnob
            key={e.sensor}
            cx={e.cx * UNIT}
            cy={e.cy * UNIT}
            r={e.r * UNIT}
            sensor={e.sensor}
            layerBinding={encoder ? encoderLayerBinding(encoder, e.sensor, layer.index) : undefined}
            selected={selSensor === e.sensor}
            onSelect={onSelect}
          />
        ))}

        {decor?.trackball && (
          <TrackballDecor
            cx={decor.trackball.cx * UNIT}
            cy={decor.trackball.cy * UNIT}
            r={decor.trackball.r * UNIT}
            onClick={onTrackball}
          />
        )}
      </svg>
    </div>
  );
}
