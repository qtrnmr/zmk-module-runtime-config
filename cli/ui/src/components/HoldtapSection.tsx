import { useEffect, useState } from "react";
import { holdtapReset, holdtapSet } from "../api";
import { HOLDTAP_HELP } from "../help";
import { Btn, NumberField } from "../panels/ui";
import { Info } from "./Tooltip";
import type { FeatureKey, HoldtapSlot, OpResult } from "../types";

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

const PARTS: FeatureKey[] = ["holdtaps"];

/** Timing of the runtime hold-tap behind the selected key. */
export default function HoldtapSection({
  slot,
  flavors,
  disabled,
  run,
}: {
  slot: HoldtapSlot;
  flavors: string[];
  disabled: boolean;
  run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
    parts?: FeatureKey[],
  ): Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(slot));

  // Re-seed from the device after every refetch, so an applied section stops
  // showing as dirty and a failed one shows what the device actually holds.
  useEffect(() => {
    setDraft(draftOf(slot));
  }, [slot]);

  const changed = (Object.keys(FIELD) as (keyof Draft)[]).filter((k) => draft[k] !== slot[k]);

  const apply = () => {
    if (!changed.length) return;
    // One RPC per changed field, but a single refetch at the end.
    void run(
      async () => {
        let last: OpResult = { ok: true, error: "" };
        for (const k of changed) {
          last = await holdtapSet(slot.slot, FIELD[k], draft[k]);
          if (!last.ok) return last;
        }
        return last;
      },
      `hold-tap を適用しました (${changed.length} 項目)`,
      PARTS,
    );
  };

  return (
    <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <h3 className="text-xs font-medium text-zinc-400">
        Hold-tap タイミング · slot {slot.slot}
      </h3>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        <NumberField
          label="tapping-term"
          help={HOLDTAP_HELP["tapping-term"]}
          value={draft.tapping_term_ms}
          min={-1}
          disabled={disabled}
          onChange={(v) => setDraft({ ...draft, tapping_term_ms: v })}
        />
        <NumberField
          label="quick-tap"
          help={HOLDTAP_HELP["quick-tap"]}
          value={draft.quick_tap_ms}
          min={-1}
          disabled={disabled}
          onChange={(v) => setDraft({ ...draft, quick_tap_ms: v })}
        />
        <NumberField
          label="prior-idle"
          help={HOLDTAP_HELP["prior-idle"]}
          value={draft.require_prior_idle_ms}
          min={-1}
          disabled={disabled}
          onChange={(v) => setDraft({ ...draft, require_prior_idle_ms: v })}
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
          flavor
          <Info
            label="flavor"
            text={
              <>
                <p>{HOLDTAP_HELP.flavor}</p>
                {["hold-preferred", "balanced", "tap-preferred", "tap-unless-interrupted"].map(
                  (f) => (
                    <p key={f}>
                      <span className="font-mono text-zinc-400">{f}</span>: {HOLDTAP_HELP[f]}
                    </p>
                  ),
                )}
              </>
            }
          />
          <select
            value={draft.flavor}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, flavor: e.target.value })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
          >
            {flavors.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-zinc-600">-1 は「未設定」で、behavior 自身の既定値が使われます。</p>
      <div className="flex gap-2">
        <Btn kind="primary" disabled={disabled || !changed.length} onClick={apply}>
          適用
        </Btn>
        <Btn
          disabled={disabled}
          onClick={() =>
            void run(
              () => holdtapReset(slot.slot),
              `slot ${slot.slot} を既定に戻しました`,
              PARTS,
            )
          }
        >
          既定に戻す
        </Btn>
      </div>
    </section>
  );
}
