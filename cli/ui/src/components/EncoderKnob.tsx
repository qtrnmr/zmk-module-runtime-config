import { labelText } from "../board";
import type { EncoderLayer, Selection } from "../types";

/** The encoder, drawn as a knob with its two directions captioned. */
export default function EncoderKnob({
  cx,
  cy,
  r,
  sensor,
  layerBinding,
  selected,
  onSelect,
}: {
  cx: number;
  cy: number;
  r: number;
  sensor: number;
  layerBinding: EncoderLayer | undefined;
  selected: boolean;
  onSelect(sel: Selection): void;
}) {
  return (
    <g className="cursor-pointer" onClick={() => onSelect({ kind: "encoder", sensor })}>
      <title>{`エンコーダ ${sensor}`}</title>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={selected ? 3 : 1.5}
        filter="url(#capShadow)"
        className={"fill-zinc-800 " + (selected ? "stroke-sky-400" : "stroke-zinc-600")}
      />
      <circle cx={cx} cy={cy} r={r * 0.55} className="fill-zinc-900 stroke-zinc-700" />
      <line
        x1={cx}
        y1={cy - r * 0.9}
        x2={cx}
        y2={cy - r * 0.6}
        strokeWidth={2}
        strokeLinecap="round"
        className="stroke-zinc-400"
      />
      <text x={cx} y={cy + r + 11} textAnchor="middle" className="fill-zinc-400 text-[9px]">
        ↻ {labelText(layerBinding?.cw.label)}
      </text>
      <text x={cx} y={cy + r + 22} textAnchor="middle" className="fill-zinc-400 text-[9px]">
        ↺ {labelText(layerBinding?.ccw.label)}
      </text>
    </g>
  );
}
