import type { State } from "../types";

export default function TopBar({
  state,
  onRefresh,
  onSnapshot,
  onReset,
  onToggleLog,
  logOpen,
  busy,
}: {
  state: State;
  onRefresh(): void;
  onSnapshot(): void;
  onReset(): void;
  onToggleLog(): void;
  logOpen: boolean;
  busy: boolean;
}) {
  const locked = state.device.lock_state === "LOCKED";
  return (
    <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" title="connected" />
      <h1 className="text-base font-semibold">{state.device.name}</h1>
      <span className="font-mono text-xs text-zinc-500">{state.device.serial_port}</span>
      <span
        className={
          "rounded px-2 py-0.5 text-xs font-medium " +
          (locked ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/15 text-emerald-300")
        }
      >
        {state.device.lock_state}
      </span>
      <span className="text-xs text-zinc-500">
        {state.layout.name} / {state.layout.keys.length} keys / {state.keymap.layers.length} layers
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onToggleLog}
          className={
            "rounded border px-2.5 py-1 text-xs hover:bg-zinc-800 " +
            (logOpen ? "border-sky-600 text-sky-300" : "border-zinc-700")
          }
        >
          変更履歴
        </button>
        <button
          onClick={onRefresh}
          disabled={busy}
          className="rounded border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
        >
          再読込
        </button>
        <button
          onClick={onSnapshot}
          disabled={busy}
          className="rounded border border-zinc-700 px-2.5 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
          title="現在のキーマップを .bin に保存"
        >
          Snapshot
        </button>
        <button
          onClick={onReset}
          disabled={busy || locked}
          className="rounded border border-red-800 bg-red-900/30 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/60 disabled:opacity-40"
          title="NVS を devicetree の既定値に戻す"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
