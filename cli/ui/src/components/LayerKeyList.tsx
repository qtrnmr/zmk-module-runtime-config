import { capText } from "../board";
import { HOW_JA, layerKeyRows, type Activator } from "../activators";
import type { Layer } from "../types";
import { layerLabel } from "../types";

/**
 * Every key that changes layer, on every layer at once. The board can only
 * mark the keys that reach the layer currently on screen, so this is where you
 * find out that SETTING+J is what puts you on APPLE without having to select
 * APPLE first.
 */
export default function LayerKeyList({
  byTarget,
  layers,
  base,
  currentLayer,
  hover,
  onHover,
  onGo,
}: {
  /** layer index -> its activators, as App already computes them. */
  byTarget: Map<number, Activator[]>;
  layers: Layer[];
  base: Layer | undefined;
  currentLayer: number;
  /** Position the pointer is over, shared with the board. */
  hover: number | null;
  onHover(pos: number | null): void;
  onGo(layerIndex: number, pos: number): void;
}) {
  const rows = layerKeyRows(byTarget);
  if (!rows.length) return null;

  const name = (i: number) => {
    const l = layers.find((x) => x.index === i);
    return l ? layerLabel(l) : `L${i}`;
  };

  return (
    <aside className="mx-3 mb-3 flex min-h-0 w-56 flex-col rounded-xl border border-zinc-700/80 bg-zinc-900/80 shadow-xl shadow-black/40 backdrop-blur">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-400">レイヤー切替キー</h2>
        <span className="ml-auto font-mono text-[11px] text-zinc-600">{rows.length}</span>
      </header>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {rows.map((r) => {
          // The gesture works on `on`; going there means showing one of those.
          const from = r.on.includes(currentLayer) ? currentLayer : r.on[0];
          const lit = hover === r.pos;
          return (
            <li key={`${r.pos}:${r.how}:${r.target}`}>
              <button
                onMouseEnter={() => onHover(r.pos)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onGo(from, r.pos)}
                title={`${r.behavior} · ${r.on.map(name).join(" / ")} で有効`}
                className={
                  "flex w-full items-baseline gap-1.5 rounded-lg px-2 py-1 text-left text-xs transition-colors " +
                  (lit ? "bg-violet-600/25 text-zinc-100" : "text-zinc-300 hover:bg-zinc-800")
                }
              >
                <span className="shrink-0 font-medium">
                  {capText(base?.bindings[r.pos]?.label)}
                </span>
                <span className="shrink-0 text-[10px] text-violet-300">{HOW_JA[r.how]}</span>
                <span className="text-zinc-600">→</span>
                <span className="truncate text-zinc-200">{name(r.target)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
