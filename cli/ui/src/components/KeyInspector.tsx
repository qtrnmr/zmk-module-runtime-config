import { useEffect, useMemo, useState } from "react";
import { setKey } from "../api";
import { holdtapSlotFor } from "../board";
import { decorFor } from "../decor";
import { describeBinding } from "../describe";
import { BEHAVIOR_HELP } from "../help";
import { reverseKeycodes } from "../macroFormat";
import { Btn } from "../panels/ui";
import { pretty } from "../prettyKeycode";
import { layerLabel } from "../types";
import { groupLayers } from "../groups";
import BindingForm, { type BindingValue } from "./BindingForm";
import { GroupHeading } from "./LayerChoice";
import { EncoderSection } from "./EncoderInspector";
import HoldtapSection from "./HoldtapSection";
import type { InspectorProps } from "./Inspector";
import { Info } from "./Tooltip";

/** The stock &mt / &lt: hold-taps, but not runtime-editable ones. */
const STOCK_HOLD_TAPS = ["Mod-Tap", "Layer-Tap"];

export default function KeyInspector({
  state,
  features,
  layer,
  groups,
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

  const byId = useMemo(() => new Map(state.behaviors.map((b) => [b.id, b])), [state.behaviors]);
  const rev = useMemo(() => reverseKeycodes(state.keycodes), [state.keycodes]);
  /** One Japanese sentence for what this key does right now — the card's
   *  headline is the cap's own text, which says nothing on its own. */
  const said = current
    ? describeBinding(current, {
        byId,
        layers: state.keymap.layers,
        rev,
        base: state.keymap.layers[0],
        pos,
        macros: features?.macros ?? null,
      })
    : "";

  const apply = (over?: BindingValue) => {
    const body = over ?? value;
    // Only the keymap changes, so the cached features document stays valid.
    void run(() => setKey({ layer_id: layer.id, position: pos, ...body }), "適用しました");
  };

  const ht = features?.holdtaps;
  const slot =
    ht?.available && current ? holdtapSlotFor(ht.slots, current.behavior_id) : undefined;
  const isStockHoldTap = !!current && STOCK_HOLD_TAPS.includes(current.label.behavior);
  /** The wheel that sits on this key, if any: its rotation is edited here too. */
  const sensor = decorFor(state.layout)?.encoders.find((e) => e.pos === pos)?.sensor;

  return (
    <>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="text-base text-zinc-100">
          {current &&
            ("text" in current.label
              ? pretty(current.label.text)
              : `${pretty(current.label.hold)} / ${pretty(current.label.tap)}`)}
        </div>
        {said && <p className="mt-0.5 text-sm leading-snug text-zinc-300">{said}</p>}
        <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
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
          {groupLayers(state.keymap.layers, groups).flatMap((sec) => {
            const rows = sec.layers.filter((l) => l.index !== layer.index);
            if (!rows.length) return [];
            return [
              // A one-group keymap needs no dividing line; several do.
              ...(groups.length
                ? [
                    <li key={`h:${sec.group?.id ?? ":none"}`} className="bg-zinc-900/60 px-2 py-0.5">
                      <GroupHeading group={sec.group} />
                    </li>,
                  ]
                : []),
              ...rows.map((l) => {
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
              }),
            ];
          })}
        </ul>
      </section>

      <BindingForm
        state={state}
        groups={groups}
        value={value}
        onChange={setValue}
        disabled={disabled}
      />

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

      {sensor !== undefined && (
        <section className="space-y-2">
          <h3 className="text-xs font-medium text-zinc-400">
            エンコーダ {sensor} の回転 · レイヤー {layer.index} {layerLabel(layer)}
          </h3>
          <p className="text-[11px] text-zinc-500">
            このキーはロータリーエンコーダの押し込みです。上の割当が押し込み、ここが回転です。
          </p>
          <EncoderSection
            state={state}
            features={features}
            layer={layer}
            groups={groups}
            sensor={sensor}
            disabled={disabled}
            run={run}
          />
        </section>
      )}
    </>
  );
}
