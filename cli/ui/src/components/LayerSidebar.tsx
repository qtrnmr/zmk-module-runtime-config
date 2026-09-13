import type { Layer } from "../types";
import { layerLabel } from "../types";

export default function LayerSidebar({
  layers,
  current,
  onSelect,
}: {
  layers: Layer[];
  current: number;
  onSelect(index: number): void;
}) {
  return (
    <nav className="min-w-0 overflow-y-auto border-r border-zinc-800 p-2">
      <h2 className="px-2 pb-2 text-xs font-semibold tracking-wide text-zinc-500">レイヤー</h2>
      <ul className="space-y-0.5">
        {layers.map((l) => (
          <li key={l.id}>
            <button
              onClick={() => onSelect(l.index)}
              className={
                "flex w-full items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm " +
                (l.index === current ? "bg-zinc-800 text-sky-300" : "hover:bg-zinc-900")
              }
            >
              <span className="w-5 shrink-0 font-mono text-xs text-zinc-500">{l.index}</span>
              <span className="truncate">{layerLabel(l)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
