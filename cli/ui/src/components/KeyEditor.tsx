import { useEffect, useMemo, useState } from "react";
import { setKey } from "../api";
import { curatedOrder, defaultParam, paramKind } from "../params";
import { pretty } from "../prettyKeycode";
import type { Behavior, Layer, ParamDesc, State } from "../types";
import { layerLabel } from "../types";
import KeycodePicker from "./KeycodePicker";

function metaOf(b: Behavior | undefined): { param1: ParamDesc[]; param2: ParamDesc[] } {
  return b?.metadata?.[0] ?? { param1: [], param2: [] };
}

function ParamEditor({
  descs,
  value,
  onChange,
  state,
}: {
  descs: ParamDesc[];
  value: number;
  onChange(v: number): void;
  state: State;
}) {
  const kind = paramKind(descs);
  if (kind === "none") return null;

  if (kind === "hid_usage") {
    return <KeycodePicker value={value} keycodes={state.keycodes} onChange={onChange} />;
  }

  if (kind === "layer_id") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
      >
        {state.keymap.layers.map((l) => (
          <option key={l.id} value={l.index}>
            {l.index} · {layerLabel(l)}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "constant") {
    const consts = descs.filter((d) => d.type === "constant") as Extract<
      ParamDesc,
      { type: "constant" }
    >[];
    return (
      <div className="space-y-1">
        {consts.map((c) => (
          <label key={c.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={value === c.value}
              onChange={() => onChange(c.value)}
              className="accent-sky-500"
            />
            <span>{c.name}</span>
            <span className="ml-auto font-mono text-xs text-zinc-500">{c.value}</span>
          </label>
        ))}
      </div>
    );
  }

  const range = descs.find((d) => d.type === "range") as Extract<ParamDesc, { type: "range" }>;
  return (
    <input
      type="number"
      value={value}
      min={range.min}
      max={range.max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
    />
  );
}

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
  const byId = useMemo(
    () => new Map(state.behaviors.map((b) => [b.id, b])),
    [state.behaviors],
  );
  const ordered = useMemo(() => curatedOrder(state.behaviors), [state.behaviors]);

  const [behaviorId, setBehaviorId] = useState(current?.behavior_id ?? 0);
  const [param1, setParam1] = useState(current?.param1 ?? 0);
  const [param2, setParam2] = useState(current?.param2 ?? 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBehaviorId(current?.behavior_id ?? 0);
    setParam1(current?.param1 ?? 0);
    setParam2(current?.param2 ?? 0);
  }, [layer.id, pos, current?.behavior_id, current?.param1, current?.param2]);

  const behavior = byId.get(behaviorId);
  const meta = metaOf(behavior);
  const transparent = state.behaviors.find((b) => b.display_name === "Transparent");

  const pickBehavior = (id: number) => {
    setBehaviorId(id);
    const m = metaOf(byId.get(id));
    setParam1(defaultParam(m.param1, state.keymap.layers, state.keycodes));
    setParam2(defaultParam(m.param2, state.keymap.layers, state.keycodes));
  };

  const apply = async (over?: { behavior_id: number; param1: number; param2: number }) => {
    setBusy(true);
    try {
      const body = over ?? { behavior_id: behaviorId, param1, param2 };
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
          {current && ("text" in current.label
            ? pretty(current.label.text)
            : `${pretty(current.label.hold)} / ${pretty(current.label.tap)}`)}
          <span className="ml-2 text-zinc-500">{current?.label.behavior}</span>
        </div>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">ビヘイビア</span>
        <select
          value={behaviorId}
          disabled={disabled}
          onChange={(e) => pickBehavior(Number(e.target.value))}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
        >
          {ordered.map((b) => (
            <option key={b.id} value={b.id}>
              {b.display_name}
            </option>
          ))}
        </select>
      </label>

      {paramKind(meta.param1) !== "none" && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-400">
            {meta.param1[0]?.name || "param1"}
          </span>
          <fieldset disabled={disabled} className="disabled:opacity-50">
            <ParamEditor descs={meta.param1} value={param1} onChange={setParam1} state={state} />
          </fieldset>
        </div>
      )}

      {paramKind(meta.param2) !== "none" && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-400">
            {meta.param2[0]?.name || "param2"}
          </span>
          <fieldset disabled={disabled} className="disabled:opacity-50">
            <ParamEditor descs={meta.param2} value={param2} onChange={setParam2} state={state} />
          </fieldset>
        </div>
      )}

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
            onClick={() =>
              void apply({ behavior_id: transparent.id, param1: 0, param2: 0 })
            }
            disabled={disabled || busy}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            ▽ にする
          </button>
        )}
      </div>
      <p className="font-mono text-[11px] text-zinc-600">
        送信: #{behaviorId} {param1} {param2}
      </p>
    </aside>
  );
}
