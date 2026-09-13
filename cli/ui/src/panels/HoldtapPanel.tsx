import { useEffect, useState } from "react";
import type { PanelProps } from "../App";
import { holdtapReset, holdtapSet } from "../api";
import type { HoldtapSlot, OpResult } from "../types";
import { Btn, NotAvailable, NumberField, Panel, TD, TH } from "./ui";

type Draft = Pick<
  HoldtapSlot,
  "tapping_term_ms" | "quick_tap_ms" | "require_prior_idle_ms" | "flavor"
>;

const draftOf = (s: HoldtapSlot): Draft => ({
  tapping_term_ms: s.tapping_term_ms,
  quick_tap_ms: s.quick_tap_ms,
  require_prior_idle_ms: s.require_prior_idle_ms,
  flavor: s.flavor,
});

/** Which server field name carries each drafted value. */
const FIELD: Record<keyof Draft, string> = {
  tapping_term_ms: "tapping-term-ms",
  quick_tap_ms: "quick-tap-ms",
  require_prior_idle_ms: "require-prior-idle-ms",
  flavor: "flavor",
};

export default function HoldtapPanel({ features, disabled, run }: PanelProps) {
  const ht = features.holdtaps;
  const slots = ht.available ? ht.slots : [];
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  // Re-seed from the device after every refetch, so an applied row stops
  // showing as dirty and a failed one shows what the device actually holds.
  useEffect(() => {
    setDrafts(Object.fromEntries(slots.map((s) => [s.slot, draftOf(s)])));
  }, [ht]);

  if (!ht.available) return <NotAvailable title="Hold-tap" feature={ht} />;

  const edit = (slot: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [slot]: { ...d[slot], ...patch } }));

  const changed = (s: HoldtapSlot): (keyof Draft)[] => {
    const d = drafts[s.slot];
    if (!d) return [];
    return (Object.keys(FIELD) as (keyof Draft)[]).filter((k) => d[k] !== s[k]);
  };

  const apply = (s: HoldtapSlot) => {
    const keys = changed(s);
    if (!keys.length) return;
    // One RPC per changed field, but a single refetch at the end — /api/features
    // costs ~40 serial round trips.
    void run(async () => {
      let last: OpResult = { ok: true, error: "" };
      for (const k of keys) {
        last = await holdtapSet(s.slot, FIELD[k], drafts[s.slot][k]);
        if (!last.ok) return last;
      }
      return last;
    }, `slot ${s.slot} を適用しました`);
  };

  return (
    <Panel
      title="Hold-tap"
      note="slot 番号は devicetree の runtime-hold-tap 定義順です (RPC は behavior 名を返しません)。-1 は「未設定」で、その behavior 自身の既定値が使われます。"
    >
      <table className="w-full max-w-3xl">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className={TH}>slot</th>
            <th className={TH}>tapping-term</th>
            <th className={TH}>quick-tap</th>
            <th className={TH}>prior-idle</th>
            <th className={TH}>flavor</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const d = drafts[s.slot] ?? draftOf(s);
            const dirty = changed(s).length > 0;
            return (
              <tr key={s.slot} className="border-b border-zinc-800/60">
                <td className={`${TD} font-mono text-zinc-400`}>{s.slot}</td>
                <td className={TD}>
                  <NumberField
                    value={d.tapping_term_ms}
                    min={-1}
                    disabled={disabled}
                    onChange={(v) => edit(s.slot, { tapping_term_ms: v })}
                  />
                </td>
                <td className={TD}>
                  <NumberField
                    value={d.quick_tap_ms}
                    min={-1}
                    disabled={disabled}
                    onChange={(v) => edit(s.slot, { quick_tap_ms: v })}
                  />
                </td>
                <td className={TD}>
                  <NumberField
                    value={d.require_prior_idle_ms}
                    min={-1}
                    disabled={disabled}
                    onChange={(v) => edit(s.slot, { require_prior_idle_ms: v })}
                  />
                </td>
                <td className={TD}>
                  <select
                    value={d.flavor}
                    disabled={disabled}
                    onChange={(e) => edit(s.slot, { flavor: e.target.value })}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
                  >
                    {ht.flavors.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <span className="mr-2 inline-flex gap-2">
                    <Btn kind="primary" disabled={disabled || !dirty} onClick={() => apply(s)}>
                      適用
                    </Btn>
                    <Btn
                      disabled={disabled}
                      onClick={() =>
                        void run(() => holdtapReset(s.slot), `slot ${s.slot} を既定に戻しました`)
                      }
                    >
                      既定に戻す
                    </Btn>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}
