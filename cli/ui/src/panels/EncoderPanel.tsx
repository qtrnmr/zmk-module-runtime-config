import { useEffect, useState } from "react";
import type { PanelProps } from "../App";
import { encoderReset, encoderSet } from "../api";
import BindingForm, { type BindingValue } from "../components/BindingForm";
import type { EncoderBinding } from "../types";
import { layerLabel } from "../types";
import { Btn, LabelText, NotAvailable, NumberField, Panel, TD, TH } from "./ui";

type Direction = "cw" | "ccw";

interface Cell {
  layer: number;
  direction: Direction;
}

interface Draft extends BindingValue {
  tap_ms: number;
}

const draftOf = (b: EncoderBinding): Draft => ({
  behavior_id: b.behavior_id,
  param1: b.param1,
  param2: b.param2,
  tap_ms: b.tap_ms,
});

export default function EncoderPanel({ state, features, disabled, run }: PanelProps) {
  const enc = features.encoder;
  const sensors = enc.available ? enc.sensors : [];
  const [sensor, setSensor] = useState(0);
  const [cell, setCell] = useState<Cell | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const layers = enc.available
    ? (enc.bindings.find((b) => b.sensor === sensor)?.layers ?? [])
    : [];
  const current = cell ? layers.find((l) => l.layer === cell.layer)?.[cell.direction] : undefined;

  // Re-seed the open cell after a refetch so it shows what the device now holds.
  useEffect(() => {
    setDraft(current ? draftOf(current) : null);
  }, [enc, cell?.layer, cell?.direction, sensor]);

  if (!enc.available) return <NotAvailable title="エンコーダ" feature={enc} />;

  const layerName = (i: number) => {
    const l = state.keymap.layers.find((x) => x.index === i);
    return l ? layerLabel(l) : `L${i}`;
  };

  const dirty =
    !!draft &&
    !!current &&
    (draft.behavior_id !== current.behavior_id ||
      draft.param1 !== current.param1 ||
      draft.param2 !== current.param2 ||
      draft.tap_ms !== current.tap_ms);

  return (
    <Panel
      title="エンコーダ"
      note="レイヤーごとに cw / ccw の binding を設定します。「DT 既定」はまだランタイムで上書きしていないことを意味します。"
    >
      <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
        センサー
        <select
          value={sensor}
          onChange={(e) => {
            setSensor(Number(e.target.value));
            setCell(null);
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
        >
          {sensors.map((s) => (
            <option key={s.index} value={s.index}>
              {s.index} · {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_340px]">
        <table className="w-full min-w-0">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className={TH}>レイヤー</th>
              <th className={TH}>cw (時計回り)</th>
              <th className={TH}>ccw (反時計回り)</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {layers.map((l) => (
              <tr key={l.layer} className="border-b border-zinc-800/60">
                <td className={`${TD} text-zinc-300`}>
                  <span className="font-mono text-zinc-500">{l.layer}</span> {layerName(l.layer)}
                </td>
                {(["cw", "ccw"] as Direction[]).map((d) => (
                  <td key={d} className={TD}>
                    <button
                      onClick={() => setCell({ layer: l.layer, direction: d })}
                      className={
                        "w-full min-w-0 rounded px-2 py-1 text-left hover:bg-zinc-800 " +
                        (cell?.layer === l.layer && cell.direction === d ? "bg-sky-600/20" : "")
                      }
                    >
                      <LabelText label={l[d].label} />
                    </button>
                  </td>
                ))}
                <td className={`${TD} whitespace-nowrap`}>
                  <Btn
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        () => encoderReset(sensor, l.layer),
                        `sensor ${sensor} layer ${l.layer} を既定に戻しました`,
                      )
                    }
                  >
                    既定に戻す
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {cell && draft && (
          <aside className="min-w-0 space-y-3 rounded border border-zinc-800 bg-zinc-900/40 p-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              sensor {sensor} · {layerName(cell.layer)} · {cell.direction}
            </h3>
            <BindingForm
              state={state}
              value={draft}
              disabled={disabled}
              onChange={(v) => setDraft({ ...draft, ...v })}
            />
            <NumberField
              label="tap_ms"
              value={draft.tap_ms}
              disabled={disabled}
              onChange={(v) => setDraft({ ...draft, tap_ms: v })}
            />
            <div className="flex gap-2 pt-1">
              <Btn
                kind="primary"
                disabled={disabled || !dirty}
                onClick={() =>
                  void run(
                    () =>
                      encoderSet({
                        sensor,
                        layer: cell.layer,
                        direction: cell.direction,
                        behavior_id: draft.behavior_id,
                        param1: draft.param1,
                        param2: draft.param2,
                        tap_ms: draft.tap_ms,
                      }),
                    `sensor ${sensor} layer ${cell.layer} ${cell.direction} を適用しました`,
                  )
                }
              >
                適用
              </Btn>
              <Btn onClick={() => setCell(null)}>閉じる</Btn>
            </div>
            <p className="font-mono text-[11px] text-zinc-600">
              送信: #{draft.behavior_id} {draft.param1} {draft.param2} tap={draft.tap_ms}
            </p>
          </aside>
        )}
      </div>
    </Panel>
  );
}
