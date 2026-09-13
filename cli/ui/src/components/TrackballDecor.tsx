import type { ReactNode } from "react";
import type { TipHandlers } from "./Tooltip";

/** The trackball, drawn as a dotted ball; clicking opens its page. */
export default function TrackballDecor({
  cx,
  cy,
  r,
  onClick,
  tip,
  tipContent,
}: {
  cx: number;
  cy: number;
  r: number;
  onClick(): void;
  tip: TipHandlers;
  tipContent: ReactNode;
}) {
  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      onMouseEnter={(e) => tip.show(e, tipContent)}
      onMouseMove={(e) => tip.show(e, tipContent)}
      onMouseLeave={tip.hide}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={1.5}
        filter="url(#capShadow)"
        className="fill-zinc-900 stroke-zinc-600"
      />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.7}
        fill="none"
        strokeDasharray="3 3"
        className="stroke-zinc-700"
      />
    </g>
  );
}
