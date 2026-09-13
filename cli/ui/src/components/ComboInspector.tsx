import { useEffect, useState } from "react";
import { comboReset, comboSet, type ComboSetBody } from "../api";
import { COMBO_HELP } from "../help";
import { Btn, LabelText, NumberField } from "../panels/ui";
import { pretty } from "../prettyKeycode";
import type { ComboEntry, FeatureKey, OpResult } from "../types";
import { layerLabel } from "../types";
import BindingForm, { type BindingValue } from "./BindingForm";
import type { InspectorProps } from "./Inspector";
import { Info } from "./Tooltip";

interface Draft {
  binding: BindingValue;
  timeout_ms: number;
  require_prior_idle_ms: number;
  layers: number[];
  slow_release: boolean;
}

/** The form opens on what the combo really does — the runtime override if there
 *  is one, else the devicetree binding — not on the id-0 "untouched" marker. */
const draftOf = (e: ComboEntry): Draft => ({
  binding: {
    behavior_id: e.effective.behavior_id,
    param1: e.effective.param1,
    param2: e.effective.param2,
  },
  timeout_ms: e.timeout_ms,
  require_prior_idle_ms: e.require_prior_idle_ms,
  layers: [...e.layers],
  slow_release: e.slow_release,
});

const sameList = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const PARTS: FeatureKey[] = ["combos"];

export default function ComboInspector({
  state,
  features,
  index,
  disabled,
  run,
}: InspectorProps & { index: number }) {
  const c = features?.combos;
  const entry = c?.available ? c.entries.find((e) => e.index === index) : undefined;
  const [draft, setDraft] = useState<Draft | null>(entry ? draftOf(entry) : null);

  // Re-seed after every refetch so an applied form stops showing as dirty.
  useEffect(() => {
    setDraft(entry ? draftOf(entry) : null);
  }, [c, index]);

  if (!c) return <p className="text-xs text-zinc-500">機能を読み込み中…</p>;
  if (!c.available)
    return <p className="font-mono text-xs break-all text-amber-300/80">{c.error}</p>;
  if (!entry || !draft) return <p className="text-xs text-zinc-500">コンボ {index} がありません。</p>;

  const seed = draftOf(entry);
  const base = state.keymap.layers[0];
  /** `S+A`: what the combo's keys do on the DEFAULT layer. */
  const keysText = entry.key_positions
    .map((p) => {
      const l = base?.bindings[p]?.label;
      if (!l) return "?";
      return "text" in l ? pretty(l.text) : pretty(l.tap);
    })
    .join("+");

  const edit = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  const bodies = (): ComboSetBody[] => {
    const out: ComboSetBody[] = [];
    const b = draft.binding;
    // Diff against the seed, not against entry.binding: an untouched combo's
    // seed is its devicetree binding, and merely opening the form must not
    // write that back as a runtime override.
    if (
      b.behavior_id !== seed.binding.behavior_id ||
      b.param1 !== seed.binding.param1 ||
      b.param2 !== seed.binding.param2
    )
      out.push({ index, field: "binding", binding: b });
    if (draft.timeout_ms !== seed.timeout_ms)
      out.push({ index, field: "timeout-ms", value: draft.timeout_ms });
    if (draft.require_prior_idle_ms !== seed.require_prior_idle_ms)
      out.push({ index, field: "require-prior-idle-ms", value: draft.require_prior_idle_ms });
    if (!sameList(draft.layers, seed.layers))
      out.push({ index, field: "layers", value: draft.layers });
    if (draft.slow_release !== seed.slow_release)
      out.push({ index, field: "slow-release", value: draft.slow_release });
    return out;
  };

  const pending = bodies();

  const apply = () => {
    if (!pending.length) return;
    void run(
      async () => {
        let last: OpResult = { ok: true, error: "" };
        for (const body of pending) {
          last = await comboSet(body);
          if (!last.ok) return last;
        }
        return last;
      },
      `コンボ ${index} を適用しました (${pending.length} 項目)`,
      PARTS,
    );
  };

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="font-mono text-[11px] text-zinc-600">
          {entry.key_positions.join(",")} → {keysText}
        </div>
        <div className="mt-1">
          <LabelText label={entry.effective.label} />
        </div>
        <div className="mt-1 text-[11px] text-zinc-500">
          runtime 上書き: {entry.binding.behavior_id !== 0 ? "あり" : "なし"}
        </div>
      </div>

      <BindingForm
        state={state}
        value={draft.binding}
        disabled={disabled}
        onChange={(v) => edit({ binding: v })}
      />

      <div className="flex flex-wrap gap-3">
        <NumberField
          label="timeout"
          help={COMBO_HELP.timeout}
          value={draft.timeout_ms}
          min={-1}
          disabled={disabled}
          onChange={(v) => edit({ timeout_ms: v })}
        />
        <NumberField
          label="prior-idle"
          help={COMBO_HELP["prior-idle"]}
          value={draft.require_prior_idle_ms}
          min={-1}
          disabled={disabled}
          onChange={(v) => edit({ require_prior_idle_ms: v })}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          disabled={disabled}
          checked={draft.slow_release}
          onChange={(ev) => edit({ slow_release: ev.target.checked })}
          className="accent-sky-500"
        />
        slow-release
        <Info text={COMBO_HELP["slow-release"]} label="slow-release" />
      </label>

      <div className="space-y-1">
        <span className="flex items-center gap-1 text-xs font-medium text-zinc-400">
          有効レイヤー (空 = 全レイヤー)
          <Info text={COMBO_HELP.layers} label="有効レイヤー" />
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {state.keymap.layers.map((l) => (
            <label key={l.id} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                disabled={disabled}
                checked={draft.layers.includes(l.index)}
                onChange={() =>
                  edit({
                    layers: draft.layers.includes(l.index)
                      ? draft.layers.filter((x) => x !== l.index)
                      : [...draft.layers, l.index].sort((a, b) => a - b),
                  })
                }
                className="accent-sky-500"
              />
              <span className="text-zinc-300">{layerLabel(l)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Btn kind="primary" disabled={disabled || !pending.length} onClick={apply}>
          適用
        </Btn>
        <Btn
          disabled={disabled}
          onClick={() =>
            void run(() => comboReset(index), `コンボ ${index} を既定に戻しました`, PARTS)
          }
        >
          既定に戻す
        </Btn>
      </div>
    </>
  );
}
