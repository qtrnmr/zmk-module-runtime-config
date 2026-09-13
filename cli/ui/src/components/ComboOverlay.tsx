import type { ReactNode } from "react";
import { comboPath, labelText } from "../board";
import type { KeyBox } from "../geometry";
import type { ComboEntry, Selection } from "../types";
import type { TipHandlers } from "./Tooltip";

/** Combos drawn on the board: a polyline through the keys they listen on and
 *  a pill at the centroid showing what the combo actually does. */
export default function ComboOverlay({
  combos,
  boxes,
  selectedIndex,
  hoverIndex,
  onHover,
  onSelect,
  tip,
  tipFor,
}: {
  combos: ComboEntry[];
  boxes: KeyBox[];
  selectedIndex: number | null;
  hoverIndex: number | null;
  onHover(index: number | null): void;
  onSelect(sel: Selection): void;
  tip: TipHandlers;
  tipFor(c: ComboEntry): ReactNode;
}) {
  return (
    <g>
      {combos.map((c) => {
        const { points, centroid } = comboPath(c, boxes);
        if (points.length < 2) return null;
        const active = selectedIndex === c.index || hoverIndex === c.index;
        const label = labelText(c.effective.label, "?");
        const w = Math.max(28, label.length * 7 + 12);
        return (
          <g
            key={c.index}
            className="cursor-pointer"
            onMouseEnter={(e) => {
              onHover(c.index);
              tip.show(e, tipFor(c));
            }}
            onMouseMove={(e) => tip.show(e, tipFor(c))}
            onMouseLeave={() => {
              onHover(null);
              tip.hide();
            }}
            onClick={() => onSelect({ kind: "combo", index: c.index })}
          >
            <polyline
              points={points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              strokeWidth={active ? 3.5 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={active ? "stroke-amber-300" : "stroke-amber-400/70"}
            />
            <rect
              x={centroid[0] - w / 2}
              y={centroid[1] - 9}
              width={w}
              height={18}
              rx={9}
              strokeWidth={1.5}
              className={"fill-zinc-900 " + (active ? "stroke-amber-300" : "stroke-amber-400")}
            />
            <text
              x={centroid[0]}
              y={centroid[1]}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-amber-100 text-[11px]"
            >
              {label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
