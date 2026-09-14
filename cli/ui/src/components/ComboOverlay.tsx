import type { ReactNode } from "react";
import { comboPath, labelText } from "../board";
import type { KeyBox } from "../geometry";
import type { ComboEntry, Selection } from "../types";
import type { TipHandlers } from "./Tooltip";

const REST = "#a1a1aa"; // zinc-400
const ACTIVE = "#38bdf8"; // sky-400

/** Distance (px) from a cap's centre to its edge along direction (ux, uy). */
function edgeDistance(b: KeyBox, ux: number, uy: number): number {
  const half = Math.min(b.w, b.h) / 2;
  return half / Math.max(Math.abs(ux), Math.abs(uy), 1e-6);
}

/**
 * Combos drawn as short "bridges" that only span the gutter between two
 * neighbouring caps, so a chord reads as caps joined together and nothing is
 * drawn over a key's legend. Keys that are not neighbours are linked with a
 * hairline that only appears while the combo is hovered or selected.
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
  const byPos = new Map(boxes.map((b) => [b.pos, b]));
  const isActive = (i: number) => selectedIndex === i || hoverIndex === i;
  const drawn = combos
    .map((c) => ({ c, ...comboPath(c, boxes) }))
    .filter((d) => d.points.length >= 2);
  const ordered = [...drawn.filter((d) => !isActive(d.c.index)), ...drawn.filter((d) => isActive(d.c.index))];

  return (
    <g>
      {ordered.map(({ c, points, centroid }) => {
        const active = isActive(c.index);
        const color = active ? ACTIVE : REST;
        const label = labelText(c.effective.label, "?");
        const w = Math.max(30, label.length * 6.5 + 16);
        const [cx, cy] = centroid;
        const keys = c.key_positions.map((p) => byPos.get(p)).filter((b): b is KeyBox => !!b);
        const pitch = keys[0] ? Math.min(keys[0].w, keys[0].h) : 60;

        const segments = [] as ReactNode[];
        for (let i = 0; i < points.length - 1; i++) {
          const [x1, y1] = points[i];
          const [x2, y2] = points[i + 1];
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const near = len < pitch * 1.75;
          if (near) {
            // A bridge across the gutter, overlapping 4px into each cap.
            const a = edgeDistance(keys[i], ux, uy) - 4;
            const b = edgeDistance(keys[i + 1], ux, uy) - 4;
            segments.push(
              <line
                key={i}
                x1={x1 + ux * a}
                y1={y1 + uy * a}
                x2={x2 - ux * b}
                y2={y2 - uy * b}
                stroke={color}
                strokeWidth={active ? 8 : 6}
                strokeLinecap="round"
              />,
            );
          } else {
            // Far apart: a hairline, dashed, only while active; dots at rest.
            segments.push(
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={1.25}
                strokeDasharray="3 5"
                strokeLinecap="round"
                opacity={active ? 0.9 : 0}
              />,
            );
          }
        }
        const farKeys = points.length >= 2 && keys.some((_, i) => {
          if (i === 0) return false;
          const [x1, y1] = points[i - 1];
          const [x2, y2] = points[i];
          return Math.hypot(x2 - x1, y2 - y1) >= pitch * 1.75;
        });

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
            {/* hit area along the whole chord */}
            <polyline
              points={points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {segments}
            {farKeys &&
              keys.map((b) => (
                // A small marker in the top-right inner corner of every key of
                // a chord whose keys do not touch, so the link is visible at rest.
                <circle
                  key={b.pos}
                  cx={b.x + b.w - 9}
                  cy={b.y + 9}
                  r={active ? 3.5 : 2.5}
                  fill={color}
                  transform={`rotate(${b.deg} ${b.cx} ${b.cy})`}
                />
              ))}
            {active && (
              <g>
                <rect
                  x={cx - w / 2}
                  y={cy - 32}
                  width={w}
                  height={20}
                  rx={6}
                  fill="#09090b"
                  fillOpacity={0.94}
                  stroke={ACTIVE}
                  strokeWidth={1}
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
