import { useMemo } from "react";
import { bounds, toBoxes } from "../geometry";
import { pretty } from "../prettyKeycode";
import type { Binding, Label, Layer, LayoutKey } from "../types";

const PAD = 12;
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
      <text textAnchor="middle" dominantBaseline="central" className={`${cls} text-[13px]`}>
        {pretty(label.text)}
      </text>
    );
  }
  return (
    <>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={-14}
        className="fill-zinc-400 text-[9px]"
      >
        {pretty(label.hold)}
      </text>
      <text textAnchor="middle" dominantBaseline="central" y={5} className={`${cls} text-[13px]`}>
        {pretty(label.tap)}
      </text>
    </>
  );
}

export default function Keyboard({
  layout,
  layer,
  base,
  selected,
  onSelect,
  highlight,
}: {
  layout: { name: string; keys: LayoutKey[] };
  layer: Layer;
  base: Layer;
  selected: number | null;
  onSelect(pos: number): void;
  /** Key positions to ring in amber, independent of `selected` — the combo tab
   *  uses it to show which keys the hovered combo listens on. */
  highlight?: number[];
}) {
  const lit = useMemo(() => new Set(highlight ?? []), [highlight]);
  const boxes = useMemo(() => toBoxes(layout.keys), [layout.keys]);
  const bb = useMemo(() => bounds(boxes), [boxes]);
  if (!boxes.length) return <div className="p-8 text-zinc-500">レイアウト情報がありません。</div>;
  const viewBox = [
    bb.minX - PAD,
    bb.minY - PAD,
    bb.maxX - bb.minX + PAD * 2,
    bb.maxY - bb.minY + PAD * 2,
  ].join(" ");

  return (
    <div className="min-h-0 min-w-0 overflow-auto p-4">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        {boxes.map((b) => {
          const binding: Binding | undefined = layer.bindings[b.pos];
          if (!binding) return null;
          const label = binding.label;
          const transparent = "text" in label && label.text === "▽";
          const ghost = transparent ? base.bindings[b.pos]?.label : undefined;
          const isSel = selected === b.pos;
          const isLit = lit.has(b.pos);
          return (
            <g
              key={b.pos}
              transform={`rotate(${b.deg} ${b.cx} ${b.cy})`}
              onClick={() => onSelect(b.pos)}
              className="cursor-pointer"
            >
              <title>{`pos ${b.pos} · ${label.behavior} · #${binding.behavior_id} ${binding.param1} ${binding.param2}`}</title>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={6}
                className={
                  (isLit ? "fill-amber-500/25" : transparent ? "fill-zinc-900/60" : "fill-zinc-800") +
                  " " +
                  (isSel ? "stroke-sky-400" : isLit ? "stroke-amber-400" : "stroke-zinc-700")
                }
                strokeWidth={isSel || isLit ? 3 : 1}
              />
              <g transform={`translate(${b.x + b.w / 2} ${b.y + b.h / 2})`}>
                {ghost ? <KeyLabel label={ghost} dim /> : <KeyLabel label={label} />}
              </g>
              {transparent && (
                <text
                  x={b.x + 5}
                  y={b.y + 12}
                  className="fill-zinc-600 text-[8px]"
                >
                  {"▽"}
                </text>
              )}
              {tag(label.behavior) && (
                <text
                  x={b.x + b.w - 4}
                  y={b.y + b.h - 4}
                  textAnchor="end"
                  className="fill-sky-500/70 text-[7px]"
                >
                  {tag(label.behavior)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
