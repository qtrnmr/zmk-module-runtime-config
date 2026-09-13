import { comboPath, labelText } from "../board";
import type { KeyBox } from "../geometry";
import type { ComboEntry, Selection } from "../types";

/** Combos drawn on the board: a polyline through the keys they listen on and
 *  a pill at the centroid showing what the combo actually does. */
export default function ComboOverlay({
  combos,
  boxes,
  selectedIndex,
  hoverIndex,
  onHover,
  onSelect,
}: {
  combos: ComboEntry[];
  boxes: KeyBox[];
  selectedIndex: number | null;
  hoverIndex: number | null;
  onHover(index: number | null): void;
  onSelect(sel: Selection): void;
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
            onMouseEnter={() => onHover(c.index)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect({ kind: "combo", index: c.index })}
          >
            <title>{`コンボ ${c.index} · ${label}`}</title>
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
