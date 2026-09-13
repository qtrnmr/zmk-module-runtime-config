import type { State } from "../types";

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
  return (
    <header className="relative flex items-center gap-x-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" title="connected" />
      <h1 className="text-base font-semibold">{state.device.name}</h1>
      <span
        className={
          "rounded px-2 py-0.5 text-xs font-medium " +
          (locked ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300")
        }
      >
        {state.device.lock_state}
      </span>
      <span className="truncate font-mono text-xs text-zinc-500">{state.device.serial_port}</span>
      <span className="truncate text-xs text-zinc-600">
        {state.layout.name} / {state.layout.keys.length} keys / {state.keymap.layers.length} layers
      </span>
      <button
        onClick={onRefresh}
        disabled={busy}
        className="ml-auto rounded border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
      >
        ⟳ 再読込
      </button>
      {loadingFeatures && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-sky-500/60" />
      )}
    </header>
  );
}
