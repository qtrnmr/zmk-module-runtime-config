import { useEffect, useMemo, useState } from "react";
import type { PanelProps } from "../App";
import { macroParse, macroSet } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import KeycodePicker from "../components/KeycodePicker";
import { keycodeName, reverseKeycodes, STEP_TYPES, stepPreview } from "../macroFormat";
import { pretty } from "../prettyKeycode";
import type { MacroStep } from "../types";
import { Btn, NotAvailable, NumberField, Panel, TD, TH } from "./ui";

export default function MacroPanel({ state, features, disabled, run }: PanelProps) {
  const m = features.macros;
  const slots = m.available ? m.slots : [];
  const maxSteps = m.available ? m.max_steps : 32;

  const [slot, setSlot] = useState(0);
  const [steps, setSteps] = useState<MacroStep[]>([]);
  const [editKey, setEditKey] = useState<number | null>(null);
  const [dslOpen, setDslOpen] = useState(false);
  const [dsl, setDsl] = useState("");
  const [dslError, setDslError] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  // Steps from /api/macro/parse and new rows carry no server label.
  const rev = useMemo(() => reverseKeycodes(state.keycodes), [state.keycodes]);

  // Reset the draft whenever the device state or the selected slot changes.
  useEffect(() => {
    setSteps((slots.find((s) => s.slot === slot)?.steps ?? []).map((s) => ({ ...s })));
    setEditKey(null);
  }, [m, slot]);

  if (!m.available) return <NotAvailable title="マクロ" feature={m} />;

  const patch = (i: number, p: Partial<MacroStep>) =>
    setSteps((ss) => ss.map((s, j) => (j === i ? { ...s, ...p } : s)));

  const move = (i: number, by: number) =>
    setSteps((ss) => {
      const j = i + by;
      if (j < 0 || j >= ss.length) return ss;
      const out = [...ss];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  const kcA = state.keycodes["A"] ?? 4;
  const addRow = () =>
    setSteps((ss) => [
      ...ss,
      { type: 0, keycode: kcA, wait_ms: 0, tap_ms: 0, label: keycodeName(rev, kcA) },
    ]);

  const parse = async () => {
    setDslError(null);
    try {
      const r = await macroParse(dsl);
      if (r.ok && r.steps) {
        // /api/macro/parse is pure and returns no labels; name them locally so
        // the table and the preview line read like device-loaded steps.
        setSteps(r.steps.map((st) => ({ ...st, label: keycodeName(rev, st.keycode) })));
        setDslOpen(false);
      } else {
        setDslError(r.error ?? "解析に失敗しました");
      }
    } catch (e) {
      setDslError(String(e));
    }
  };

  const apply = (next: MacroStep[]) =>
    void run(async () => {
      const r = await macroSet(slot, next.map(({ type, keycode, wait_ms, tap_ms }) => ({
        type,
        keycode,
        wait_ms,
        tap_ms,
      })));
      // The device applies an unbalanced macro; surface the warning in the toast.
      return r.warning ? { ...r, error: r.error || `適用しました (注意: ${r.warning})` } : r;
    }, `slot ${slot} に ${next.length} ステップを書き込みました`);

  return (
    <Panel
      title="マクロ"
      note={`スロット数 (${slots.length}) と 1 スロットあたりの最大ステップ数 (${maxSteps}) は firmware のビルド時設定です。`}
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[260px_1fr]">
        <ul className="min-w-0 space-y-1">
          {slots.map((s) => (
            <li key={s.slot}>
              <button
                onClick={() => setSlot(s.slot)}
                className={
                  "block w-full min-w-0 rounded px-2 py-1.5 text-left text-xs " +
                  (s.slot === slot ? "bg-sky-600/20 text-sky-200" : "hover:bg-zinc-800")
                }
              >
                <span className="font-mono text-zinc-400">slot {s.slot}</span>
                <span className="ml-2 break-all text-zinc-300">{stepPreview(s.steps)}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">
              slot {slot} · {steps.length}/{maxSteps} ステップ
            </span>
            <Btn onClick={() => setDslOpen((v) => !v)}>DSL から取込</Btn>
            <Btn disabled={disabled || steps.length >= maxSteps} onClick={addRow}>
              + 行を追加
            </Btn>
          </div>

          {dslOpen && (
            <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900/50 p-2">
              <textarea
                value={dsl}
                onChange={(e) => setDsl(e.target.value)}
                rows={3}
                placeholder="press GLOBE | wait 80 | press LEFT | release LEFT | release GLOBE"
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <Btn kind="primary" onClick={() => void parse()}>
                  解析
                </Btn>
                <span className="text-[11px] text-zinc-500">
                  デバイスには書き込みません。表を置き換えるだけです。
                </span>
              </div>
              {dslError && <p className="text-xs text-red-300">{dslError}</p>}
            </div>
          )}

          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className={TH}>#</th>
                <th className={TH}>type</th>
                <th className={TH}>key</th>
                <th className={TH}>wait_ms</th>
                <th className={TH}>tap_ms</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={i} className="border-b border-zinc-800/60 align-top">
                  <td className={`${TD} font-mono text-zinc-500`}>{i}</td>
                  <td className={TD}>
                    <select
                      value={s.type}
                      disabled={disabled}
                      onChange={(e) =>
                        patch(i, { type: Number(e.target.value) as MacroStep["type"] })
                      }
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {STEP_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={`${TD} min-w-0`}>
                    <button
                      onClick={() => setEditKey(editKey === i ? null : i)}
                      disabled={disabled}
                      className="rounded border border-zinc-700 px-2 py-1 font-mono text-xs hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {pretty(s.label ?? keycodeName(rev, s.keycode))}
                    </button>
                    {editKey === i && (
                      <div className="mt-2 w-72 rounded border border-zinc-700 bg-zinc-900 p-2">
                        <KeycodePicker
                          value={s.keycode}
                          keycodes={state.keycodes}
                          onChange={(v) => patch(i, { keycode: v, label: keycodeName(rev, v) })}
                        />
                      </div>
                    )}
                  </td>
                  <td className={TD}>
                    <NumberField
                      value={s.wait_ms}
                      disabled={disabled}
                      width="w-20"
                      onChange={(v) => patch(i, { wait_ms: v })}
                    />
                  </td>
                  <td className={TD}>
                    <NumberField
                      value={s.tap_ms}
                      disabled={disabled}
                      width="w-20"
                      onChange={(v) => patch(i, { tap_ms: v })}
                    />
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <span className="inline-flex gap-1">
                      <Btn disabled={disabled || i === 0} onClick={() => move(i, -1)} title="上へ">
                        ↑
                      </Btn>
                      <Btn
                        disabled={disabled || i === steps.length - 1}
                        onClick={() => move(i, 1)}
                        title="下へ"
                      >
                        ↓
                      </Btn>
                      <Btn
                        disabled={disabled}
                        onClick={() => setSteps((ss) => ss.filter((_, j) => j !== i))}
                        title="削除"
                      >
                        ✕
                      </Btn>
                    </span>
                  </td>
                </tr>
              ))}
              {!steps.length && (
                <tr>
                  <td className={`${TD} text-zinc-500`} colSpan={6}>
                    このスロットは空です。
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-2">
            <Btn kind="primary" disabled={disabled} onClick={() => apply(steps)}>
              適用
            </Btn>
            <Btn kind="danger" disabled={disabled} onClick={() => setClearOpen(true)}>
              空にする
            </Btn>
          </div>
          <p className="font-mono text-[11px] break-all text-zinc-600">{stepPreview(steps)}</p>
        </div>
      </div>

      <ConfirmDialog
        open={clearOpen}
        title={`slot ${slot} を空にしますか?`}
        body={`現在のステップ:\n${stepPreview(
          slots.find((s) => s.slot === slot)?.steps ?? [],
        )}\n\nこのスロットを参照している &rt_macro は何もしなくなります。`}
        confirmText="空にする"
        danger
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearOpen(false);
          apply([]);
        }}
      />
    </Panel>
  );
}
