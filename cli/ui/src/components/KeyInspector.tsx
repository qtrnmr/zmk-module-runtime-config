import { useEffect, useState } from "react";
import { setKey } from "../api";
import { holdtapSlotFor } from "../board";
import { BEHAVIOR_HELP } from "../help";
import { Btn } from "../panels/ui";
import { pretty } from "../prettyKeycode";
import { layerLabel } from "../types";
import BindingForm, { type BindingValue } from "./BindingForm";
import HoldtapSection from "./HoldtapSection";
import type { InspectorProps } from "./Inspector";
import { Info } from "./Tooltip";

/** The stock &mt / &lt: hold-taps, but not runtime-editable ones. */
const STOCK_HOLD_TAPS = ["Mod-Tap", "Layer-Tap"];

export default function KeyInspector({
  state,
  features,
  layer,
  pos,
  disabled,
  run,
  onSelectLayer,
}: InspectorProps & { pos: number }) {
  const current = layer.bindings[pos];

  const [value, setValue] = useState<BindingValue>({
    behavior_id: current?.behavior_id ?? 0,
    param1: current?.param1 ?? 0,
    param2: current?.param2 ?? 0,
  });

  useEffect(() => {
    setValue({
      behavior_id: current?.behavior_id ?? 0,
      param1: current?.param1 ?? 0,
      param2: current?.param2 ?? 0,
    });
  }, [layer.id, pos, current?.behavior_id, current?.param1, current?.param2]);

  const transparent = state.behaviors.find((b) => b.display_name === "Transparent");

  const apply = (over?: BindingValue) => {
    const body = over ?? value;
    // Only the keymap changes, so the cached features document stays valid.
    void run(() => setKey({ layer_id: layer.id, position: pos, ...body }), "適用しました");
  };

  const ht = features?.holdtaps;
  const slot =
    ht?.available && current ? holdtapSlotFor(ht.slots, current.behavior_id) : undefined;
  const isStockHoldTap = !!current && STOCK_HOLD_TAPS.includes(current.label.behavior);

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="text-base text-zinc-100">
          {current &&
            ("text" in current.label
              ? pretty(current.label.text)
              : `${pretty(current.label.hold)} / ${pretty(current.label.tap)}`)}
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          {current?.label.behavior}
          <Info
            text={BEHAVIOR_HELP[current?.label.behavior ?? ""]}
            label={current?.label.behavior}
          />
        </div>
        <div className="mt-1 font-mono text-[11px] text-zinc-600">
          #{current?.behavior_id} {current?.param1} {current?.param2}
        </div>
      </div>

      <section className="space-y-1">
        <h3 className="text-xs font-medium text-zinc-400">他のレイヤーでのこのキー</h3>
        <ul className="divide-y divide-zinc-800/60 rounded border border-zinc-800">
          {state.keymap.layers
            .filter((l) => l.index !== layer.index)
            .map((l) => {
              const b = l.bindings[pos];
              const text = !b
                ? "—"
                : "text" in b.label
                  ? pretty(b.label.text)
                  : `${pretty(b.label.hold)} / ${pretty(b.label.tap)}`;
              return (
                <li key={l.id}>
                  <button
                    onClick={() => onSelectLayer(l.index)}
                    className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs leading-4 hover:bg-zinc-800"
                  >
                    <span className="w-5 font-mono text-zinc-500">{l.index}</span>
                    <span className="w-24 truncate text-zinc-400">{layerLabel(l)}</span>
                    <span className="truncate text-zinc-200">{text}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </section>

      <BindingForm state={state} value={value} onChange={setValue} disabled={disabled} />

      <div className="flex gap-2">
        <Btn kind="primary" disabled={disabled} onClick={() => apply()}>
          適用
        </Btn>
        {transparent && (
          <Btn
            disabled={disabled}
            onClick={() => apply({ behavior_id: transparent.id, param1: 0, param2: 0 })}
          >
            ▽ にする
          </Btn>
        )}
      </div>

      {slot && ht?.available ? (
        <HoldtapSection slot={slot} flavors={ht.flavors} disabled={disabled} run={run} />
      ) : (
        isStockHoldTap && (
          <p className="text-xs text-zinc-500">
            &amp;mt / &amp;lt のタイミングは runtime 編集できません
          </p>
        )
      )}
    </>
  );
}
