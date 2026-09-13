import { useEffect, useState } from "react";
import type { PanelProps } from "../App";
import { comboReset, comboSet, type ComboSetBody } from "../api";
import BindingForm, { type BindingValue } from "../components/BindingForm";
import Keyboard from "../components/Keyboard";
import { pretty } from "../prettyKeycode";
import type { ComboEntry, OpResult } from "../types";
import { layerLabel } from "../types";
import { Btn, LabelText, NotAvailable, NumberField, Panel, TD, TH } from "./ui";

interface Draft {
  binding: BindingValue;
  timeout_ms: number;
  require_prior_idle_ms: number;
  layers: number[];
  slow_release: boolean;
}

const draftOf = (e: ComboEntry): Draft => ({
  binding: {
    behavior_id: e.binding.behavior_id,
    param1: e.binding.param1,
    param2: e.binding.param2,
  },
  timeout_ms: e.timeout_ms,
  require_prior_idle_ms: e.require_prior_idle_ms,
  layers: [...e.layers],
  slow_release: e.slow_release,
});

const sameList = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export default function ComboPanel({ state, features, disabled, run }: PanelProps) {
  const c = features.combos;
  const entries = c.available ? c.entries : [];
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number[] | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(entries.map((e) => [e.index, draftOf(e)])));
  }, [c]);

  if (!c.available) return <NotAvailable title="コンボ" feature={c} />;

  const base = state.keymap.layers[0];
  /** `11,10 → S+A`: the positions plus what they do on the DEFAULT layer. */
  const keysText = (positions: number[]) => {
    const caps = positions.map((p) => {
      const l = base?.bindings[p]?.label;
      if (!l) return "?";
      return "text" in l ? pretty(l.text) : pretty(l.tap);
    });
    return `${positions.join(",")} → ${caps.join("+")}`;
  };

  const layerName = (i: number) => {
    const l = state.keymap.layers.find((x) => x.index === i);
    return l ? layerLabel(l) : `L${i}`;
  };

  const edit = (index: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [index]: { ...d[index], ...patch } }));

  /** One RPC per changed field, binding first, then a single refetch. */
  const apply = (e: ComboEntry) => {
    const d = drafts[e.index];
    const bodies: ComboSetBody[] = [];
    const b = d.binding;
    if (
      b.behavior_id !== e.binding.behavior_id ||
      b.param1 !== e.binding.param1 ||
      b.param2 !== e.binding.param2
    )
      bodies.push({ index: e.index, field: "binding", binding: b });
    if (d.timeout_ms !== e.timeout_ms)
      bodies.push({ index: e.index, field: "timeout-ms", value: d.timeout_ms });
    if (d.require_prior_idle_ms !== e.require_prior_idle_ms)
      bodies.push({
        index: e.index,
        field: "require-prior-idle-ms",
        value: d.require_prior_idle_ms,
      });
    if (!sameList(d.layers, e.layers))
      bodies.push({ index: e.index, field: "layers", value: d.layers });
    if (d.slow_release !== e.slow_release)
      bodies.push({ index: e.index, field: "slow-release", value: d.slow_release });
    if (!bodies.length) return;

    void run(async () => {
      let last: OpResult = { ok: true, error: "" };
      for (const body of bodies) {
        last = await comboSet(body);
        if (!last.ok) return last;
      }
      return last;
    }, `combo ${e.index} を適用しました (${bodies.length} 項目)`);
  };

  const dirty = (e: ComboEntry) => {
    const d = drafts[e.index];
    if (!d) return false;
    return (
      d.binding.behavior_id !== e.binding.behavior_id ||
      d.binding.param1 !== e.binding.param1 ||
      d.binding.param2 !== e.binding.param2 ||
      d.timeout_ms !== e.timeout_ms ||
      d.require_prior_idle_ms !== e.require_prior_idle_ms ||
      !sameList(d.layers, e.layers) ||
      d.slow_release !== e.slow_release
    );
  };

  const detail = open === null ? null : entries.find((e) => e.index === open);

  return (
    <Panel
      title="コンボ"
      note="key-positions は devicetree 固定です。行にカーソルを合わせるとそのキーがキーボード図で光ります。layers が空のときは全レイヤーで有効です。"
    >
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-3">
          {/* Keyboard sizes its svg to the container, and its own wrapper has no
              height of its own — give it one here or it overflows the table. */}
          <div className="h-64 overflow-hidden rounded border border-zinc-800 bg-zinc-900/30 [&>div]:h-full">
            <Keyboard
              layout={state.layout}
              layer={base}
              base={base}
              selected={null}
              onSelect={() => {}}
              highlight={hovered ?? []}
            />
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className={TH}>#</th>
                <th className={TH}>keys</th>
                <th className={TH}>binding</th>
                <th className={TH}>timeout</th>
                <th className={TH}>prior-idle</th>
                <th className={TH}>layers</th>
                <th className={TH}>slow-rel</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.index}
                  onMouseEnter={() => setHovered(e.key_positions)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(e.key_positions)}
                  tabIndex={0}
                  onClick={() => setOpen(open === e.index ? null : e.index)}
                  className={
                    "cursor-pointer border-b border-zinc-800/60 hover:bg-zinc-800/50 " +
                    (open === e.index ? "bg-sky-600/10" : "")
                  }
                >
                  <td className={`${TD} font-mono text-zinc-400`}>{e.index}</td>
                  <td className={`${TD} font-mono text-xs text-zinc-300`}>
                    {keysText(e.key_positions)}
                  </td>
                  <td className={TD}>
                    <LabelText label={e.binding.label} />
                  </td>
                  <td className={`${TD} font-mono text-zinc-300`}>{e.timeout_ms}</td>
                  <td className={`${TD} font-mono text-zinc-300`}>{e.require_prior_idle_ms}</td>
                  <td className={`${TD} text-xs text-zinc-300`}>
                    {e.layers.length ? e.layers.map(layerName).join(", ") : "全レイヤー"}
                  </td>
                  <td className={`${TD} text-zinc-300`}>{e.slow_release ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detail && drafts[detail.index] && (
          <aside className="min-w-0 space-y-3 rounded border border-zinc-800 bg-zinc-900/40 p-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              combo {detail.index} · {keysText(detail.key_positions)}
            </h3>

            <BindingForm
              state={state}
              value={drafts[detail.index].binding}
              disabled={disabled}
              onChange={(v) => edit(detail.index, { binding: v })}
            />

            <div className="flex flex-wrap gap-3">
              <NumberField
                label="timeout"
                value={drafts[detail.index].timeout_ms}
                min={-1}
                disabled={disabled}
                onChange={(v) => edit(detail.index, { timeout_ms: v })}
              />
              <NumberField
                label="prior-idle"
                value={drafts[detail.index].require_prior_idle_ms}
                min={-1}
                disabled={disabled}
                onChange={(v) => edit(detail.index, { require_prior_idle_ms: v })}
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                disabled={disabled}
                checked={drafts[detail.index].slow_release}
                onChange={(ev) => edit(detail.index, { slow_release: ev.target.checked })}
                className="accent-sky-500"
              />
              slow-release
            </label>

            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-400">
                有効レイヤー (空 = 全レイヤー)
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {state.keymap.layers.map((l) => (
                  <label key={l.id} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={drafts[detail.index].layers.includes(l.index)}
                      onChange={() => {
                        const cur = drafts[detail.index].layers;
                        edit(detail.index, {
                          layers: cur.includes(l.index)
                            ? cur.filter((x) => x !== l.index)
                            : [...cur, l.index].sort((a, b) => a - b),
                        });
                      }}
                      className="accent-sky-500"
                    />
                    <span className="text-zinc-300">{layerLabel(l)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Btn kind="primary" disabled={disabled || !dirty(detail)} onClick={() => apply(detail)}>
                適用
              </Btn>
              <Btn
                disabled={disabled}
                onClick={() =>
                  void run(
                    () => comboReset(detail.index),
                    `combo ${detail.index} を既定に戻しました`,
                  )
                }
              >
                既定に戻す
              </Btn>
            </div>
          </aside>
        )}
      </div>
    </Panel>
  );
}
