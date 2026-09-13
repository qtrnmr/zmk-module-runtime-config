import { useMemo } from "react";
import { curatedOrder, defaultParam, paramKind } from "../params";
import type { Behavior, ParamDesc, State } from "../types";
import { DT_DEFAULT_ID, layerLabel } from "../types";
import KeycodePicker from "./KeycodePicker";

export interface BindingValue {
  behavior_id: number;
  param1: number;
  param2: number;
}

export function metaOf(b: Behavior | undefined): { param1: ParamDesc[]; param2: ParamDesc[] } {
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

/**
 * Behavior picker + metadata-driven parameter editors, shared by the key editor,
 * the combo binding field and the encoder cw/ccw bindings.
 *
 * Picking a behavior resets both parameters to that behavior's default, because
 * the old values mean nothing under the new metadata (a layer index sent as a
 * keycode would be silently accepted by the device).
 */
export default function BindingForm({
  state,
  value,
  onChange,
  disabled,
}: {
  state: State;
  value: BindingValue;
  onChange(v: BindingValue): void;
  disabled?: boolean;
}) {
  const byId = useMemo(() => new Map(state.behaviors.map((b) => [b.id, b])), [state.behaviors]);
  const ordered = useMemo(() => curatedOrder(state.behaviors), [state.behaviors]);

  const behavior = byId.get(value.behavior_id);
  const meta = metaOf(behavior);

  const pickBehavior = (id: number) => {
    const m = metaOf(byId.get(id));
    onChange({
      behavior_id: id,
      param1: defaultParam(m.param1, state.keymap.layers, state.keycodes),
      param2: defaultParam(m.param2, state.keymap.layers, state.keycodes),
    });
  };

  return (
    <div className="min-w-0 space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-zinc-400">ビヘイビア</span>
        <select
          value={value.behavior_id}
          disabled={disabled}
          onChange={(e) => pickBehavior(Number(e.target.value))}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
        >
          {/* The firmware reports id 0 for a binding it has never overridden; it
              is not selectable, but it has to be showable or the select would
              silently jump to the first behaviour in the list. */}
          {value.behavior_id === DT_DEFAULT_ID && (
            <option value={DT_DEFAULT_ID}>(devicetree の既定のまま)</option>
          )}
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
          <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
            <ParamEditor
              descs={meta.param1}
              value={value.param1}
              onChange={(v) => onChange({ ...value, param1: v })}
              state={state}
            />
          </fieldset>
        </div>
      )}

      {paramKind(meta.param2) !== "none" && (
        <div className="space-y-1">
          <span className="text-xs font-medium text-zinc-400">
            {meta.param2[0]?.name || "param2"}
          </span>
          <fieldset disabled={disabled} className="min-w-0 disabled:opacity-50">
            <ParamEditor
              descs={meta.param2}
              value={value.param2}
              onChange={(v) => onChange({ ...value, param2: v })}
              state={state}
            />
          </fieldset>
        </div>
      )}
    </div>
  );
}
