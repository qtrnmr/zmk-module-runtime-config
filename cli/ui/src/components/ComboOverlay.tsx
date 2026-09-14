import type { ReactNode } from "react";
import { comboColor, comboPath, labelText, ribbonPath } from "../board";
import type { KeyBox } from "../geometry";
import type { ComboEntry, Selection } from "../types";
import type { TipHandlers } from "./Tooltip";

/**
 * Combos drawn on the board as translucent ribbons through the keys they
 * listen on, each in its own colour, with a dot at the centroid. Hovering or
 * selecting a combo lights the ribbon up and floats its label above it; at
 * rest nothing covers a key's own legend.
 */
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
  const drawn = combos
    .map((c) => ({ c, ...comboPath(c, boxes) }))
    .filter((d) => d.points.length >= 2);
  // Active ribbons are re-rendered last so they sit on top of the others.
  const isActive = (i: number) => selectedIndex === i || hoverIndex === i;
  const ordered = [...drawn.filter((d) => !isActive(d.c.index)), ...drawn.filter((d) => isActive(d.c.index))];

  return (
    <g>
      <defs>
        <filter id="comboGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      {ordered.map(({ c, points, centroid }) => {
        const active = isActive(c.index);
        const color = comboColor(c.index);
        const d = ribbonPath(points);
        const label = labelText(c.effective.label, "?");
        const w = Math.max(30, label.length * 6.5 + 16);
        const [cx, cy] = centroid;
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
            {/* glow */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={active ? 18 : 12}
              strokeOpacity={active ? 0.45 : 0.14}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#comboGlow)"
            />
            {/* ribbon body */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={active ? 11 : 8}
              strokeOpacity={active ? 0.5 : 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* core line */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={active ? 2 : 1.25}
              strokeOpacity={active ? 1 : 0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* generous hit area */}
            <path d={d} fill="none" stroke="transparent" strokeWidth={22} strokeLinecap="round" />
            {/* centroid dot */}
            <circle cx={cx} cy={cy} r={active ? 5.5 : 4} fill={color} stroke="#09090b" strokeWidth={1.5} />
            {active && (
              <g>
                <rect
                  x={cx - w / 2}
                  y={cy - 32}
                  width={w}
                  height={20}
                  rx={10}
                  fill="#09090b"
                  fillOpacity={0.92}
                  stroke={color}
                  strokeWidth={1.25}
                />
                <text
                  x={cx}
                  y={cy - 22}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-zinc-50 text-[11px] font-medium"
                >
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
