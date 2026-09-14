import { useState } from "react";
import type { State } from "../types";
import Legend from "./Legend";
import { useTooltip } from "./Tooltip";

export default function TopBar({
  state,
  busy,
  onRefresh,
  loadingFeatures,
}: {
  state: State;
  busy: boolean;
  onRefresh(): void;
  loadingFeatures: boolean;
}) {
  const locked = state.device.lock_state === "LOCKED";
  const [legend, setLegend] = useState(false);
  const tip = useTooltip();

  // The device path answers a question nobody was asking; what the dot means
  // is the question. The path is still one hover away.
  const port = (
    <>
      <p>USB でつながっています。</p>
      <p className="font-mono text-zinc-400">シリアルポート: {state.device.serial_port}</p>
    </>
  );

  return (
    <header className="relative flex items-center gap-x-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
      {tip.node}
      <span
        onMouseEnter={(e) => tip.show(e, port)}
        onMouseMove={(e) => tip.show(e, port)}
        onMouseLeave={tip.hide}
        className="flex shrink-0 cursor-help items-center gap-1.5"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="text-xs text-zinc-400">USB 接続</span>
      </span>
      <h1 className="text-base font-semibold">{state.device.name}</h1>
      <span
        className={
          "rounded px-2 py-0.5 text-xs font-medium " +
          (locked ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300")
        }
      >
        {state.device.lock_state}
      </span>
      <span className="truncate text-xs text-zinc-500">
        {state.layout.keys.length} キー · {state.keymap.layers.length} レイヤー
      </span>
      <button
        onClick={onRefresh}
        disabled={busy}
        className="ml-auto rounded border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
      >
        ⟳ 再読込
      </button>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => setLegend((o) => !o)}
        aria-label="記号の凡例"
        aria-expanded={legend}
        className={
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm " +
          (legend
            ? "border-sky-500 bg-sky-500/15 text-sky-300"
            : "border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200")
        }
      >
        ?
      </button>
      {legend && <Legend onClose={() => setLegend(false)} />}
      {loadingFeatures && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-sky-500/60" />
      )}
    </header>
  );
}
