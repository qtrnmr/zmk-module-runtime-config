import { useEffect, useState } from "react";
import { setKey } from "../api";
import { pretty } from "../prettyKeycode";
import type { Layer, State } from "../types";
import { layerLabel } from "../types";
import BindingForm, { type BindingValue } from "./BindingForm";

export default function KeyEditor({
  state,
  layer,
  pos,
  disabled,
  onApplied,
  onError,
}: {
  state: State;
  layer: Layer;
  pos: number;
  disabled: boolean;
  onApplied(): void;
  onError(msg: string): void;
}) {
  const current = layer.bindings[pos];

  const [value, setValue] = useState<BindingValue>({
    behavior_id: current?.behavior_id ?? 0,
    param1: current?.param1 ?? 0,
    param2: current?.param2 ?? 0,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setValue({
      behavior_id: current?.behavior_id ?? 0,
      param1: current?.param1 ?? 0,
      param2: current?.param2 ?? 0,
    });
  }, [layer.id, pos, current?.behavior_id, current?.param1, current?.param2]);

  const transparent = state.behaviors.find((b) => b.display_name === "Transparent");

  const apply = async (over?: BindingValue) => {
    setBusy(true);
    try {
      const body = over ?? value;
      const r = await setKey({ layer_id: layer.id, position: pos, ...body });
      if (!r.ok) onError(r.error ?? "適用に失敗しました");
      else onApplied();
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="min-h-0 min-w-0 space-y-3 overflow-y-auto border-l border-zinc-800 p-4">
      <div className="text-xs text-zinc-500">
        レイヤー {layer.index} · {layerLabel(layer)} / 位置 {pos}
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-900/60 p-2 font-mono text-xs text-zinc-400">
        現在: #{current?.behavior_id} {current?.param1} {current?.param2}
        <div className="mt-1 text-zinc-300">
          {current &&
            ("text" in current.label
              ? pretty(current.label.text)
              : `${pretty(current.label.hold)} / ${pretty(current.label.tap)}`)}
          <span className="ml-2 text-zinc-500">{current?.label.behavior}</span>
        </div>
      </div>

      <BindingForm state={state} value={value} onChange={setValue} disabled={disabled} />

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => void apply()}
          disabled={disabled || busy}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {busy ? "適用中…" : "適用"}
        </button>
        {transparent && (
          <button
            onClick={() => void apply({ behavior_id: transparent.id, param1: 0, param2: 0 })}
            disabled={disabled || busy}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            ▽ にする
          </button>
        )}
      </div>
      <p className="font-mono text-[11px] text-zinc-600">
        送信: #{value.behavior_id} {value.param1} {value.param2}
      </p>
    </aside>
  );
}
