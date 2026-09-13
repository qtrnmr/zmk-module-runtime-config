import { useEffect, useState } from "react";
import { encoderReset, encoderSet } from "../api";
import { encoderLayerBinding } from "../board";
import { ENCODER_HELP } from "../help";
import { Btn, NumberField } from "../panels/ui";
import type { EncoderBinding, FeatureKey } from "../types";
import BindingForm, { type BindingValue } from "./BindingForm";
import type { InspectorProps } from "./Inspector";

type Direction = "cw" | "ccw";
interface Draft extends BindingValue {
  tap_ms: number;
}

const draftOf = (b: EncoderBinding): Draft => ({
  behavior_id: b.behavior_id,
  param1: b.param1,
  param2: b.param2,
  tap_ms: b.tap_ms,
});

const PARTS: FeatureKey[] = ["encoder"];
const DIR_LABEL: Record<Direction, string> = { cw: "↻ 時計回り (cw)", ccw: "↺ 反時計回り (ccw)" };

function DirectionCard({
  state,
  sensor,
  layerIndex,
  direction,
  current,
  disabled,
  run,
}: {
  state: InspectorProps["state"];
  sensor: number;
  layerIndex: number;
  direction: Direction;
  current: EncoderBinding;
  disabled: boolean;
  run: InspectorProps["run"];
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  useEffect(() => {
    setDraft(draftOf(current));
  }, [current, sensor, layerIndex, direction]);

  const dirty =
    draft.behavior_id !== current.behavior_id ||
    draft.param1 !== current.param1 ||
    draft.param2 !== current.param2 ||
    draft.tap_ms !== current.tap_ms;

  return (
    <section className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <h3 className="text-xs font-medium text-zinc-400">{DIR_LABEL[direction]}</h3>
      <BindingForm
        state={state}
        value={draft}
        disabled={disabled}
        onChange={(v) => setDraft({ ...draft, ...v })}
      />
      <NumberField
        label="tap_ms"
        help={ENCODER_HELP.tap_ms}
        value={draft.tap_ms}
        disabled={disabled}
        onChange={(v) => setDraft({ ...draft, tap_ms: v })}
      />
      <Btn
        kind="primary"
        disabled={disabled || !dirty}
        onClick={() =>
          void run(
            () =>
              encoderSet({
                sensor,
                layer: layerIndex,
                direction,
                behavior_id: draft.behavior_id,
                param1: draft.param1,
                param2: draft.param2,
                tap_ms: draft.tap_ms,
              }),
            `sensor ${sensor} layer ${layerIndex} ${direction} を適用しました`,
            PARTS,
          )
        }
      >
        適用
      </Btn>
    </section>
  );
}

export default function EncoderInspector({
  state,
  features,
  layer,
  sensor,
  disabled,
  run,
  onSelect,
}: InspectorProps & { sensor: number }) {
  const enc = features?.encoder;
  if (!enc) return <p className="text-xs text-zinc-500">機能を読み込み中…</p>;
  if (!enc.available)
    return <p className="font-mono text-xs break-all text-amber-300/80">{enc.error}</p>;

  const lb = encoderLayerBinding(enc, sensor, layer.index);

  return (
    <>
      {/* Every sensor is reachable here, even the ones the board does not draw. */}
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        センサー
        <select
          value={sensor}
          onChange={(e) => onSelect({ kind: "encoder", sensor: Number(e.target.value) })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
        >
          {enc.sensors.map((s) => (
            <option key={s.index} value={s.index}>
              {s.index} · {s.name}
            </option>
          ))}
        </select>
      </label>

      {lb ? (
        <>
          <DirectionCard
            state={state}
            sensor={sensor}
            layerIndex={layer.index}
            direction="cw"
            current={lb.cw}
            disabled={disabled}
            run={run}
          />
          <DirectionCard
            state={state}
            sensor={sensor}
            layerIndex={layer.index}
            direction="ccw"
            current={lb.ccw}
            disabled={disabled}
            run={run}
          />
          <Btn
            disabled={disabled}
            onClick={() =>
              void run(
                () => encoderReset(sensor, layer.index),
                `sensor ${sensor} layer ${layer.index} を既定に戻しました`,
                PARTS,
              )
            }
          >
            このレイヤーを既定に戻す
          </Btn>
        </>
      ) : (
        <p className="text-xs text-zinc-500">このレイヤーには sensor-bindings がありません</p>
      )}
    </>
  );
}
