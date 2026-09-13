import { useEffect, useState } from "react";
import type { PanelProps } from "../App";
import { condlayerReset, condlayerSet } from "../api";
import type { CondlayerEntry } from "../types";
import { layerLabel } from "../types";
import { Btn, NotAvailable, Panel, TD, TH } from "./ui";

interface Draft {
  if_layers: number[];
  then_layer: number;
}

const draftOf = (e: CondlayerEntry): Draft => ({
  if_layers: [...e.if_layers],
  then_layer: e.then_layer,
});

const same = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export default function CondlayerPanel({ state, features, disabled, run }: PanelProps) {
  const cl = features.condlayers;
  const entries = cl.available ? cl.entries : [];
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(entries.map((e) => [e.index, draftOf(e)])));
  }, [cl]);

  if (!cl.available) return <NotAvailable title="条件レイヤー" feature={cl} />;

  const name = (i: number) => {
    const l = state.keymap.layers.find((x) => x.index === i);
    return l ? layerLabel(l) : `L${i}`;
  };

  const toggle = (index: number, layer: number) =>
    setDrafts((d) => {
      const cur = d[index].if_layers;
      const next = cur.includes(layer)
        ? cur.filter((x) => x !== layer)
        : [...cur, layer].sort((a, b) => a - b);
      return { ...d, [index]: { ...d[index], if_layers: next } };
    });

  return (
    <Panel
      title="条件レイヤー"
      note="if-layers のレイヤーが同時に有効なとき then-layer も有効になります。エントリ数は devicetree 固定です。"
    >
      <table className="w-full max-w-3xl">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className={TH}>index</th>
            <th className={TH}>if-layers</th>
            <th className={TH}>then-layer</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const d = drafts[e.index] ?? draftOf(e);
            const dirty = !same(d.if_layers, e.if_layers) || d.then_layer !== e.then_layer;
            const isOpen = open === e.index;
            return (
              <tr key={e.index} className="border-b border-zinc-800/60 align-top">
                <td className={`${TD} font-mono text-zinc-400`}>{e.index}</td>
                <td className={TD}>
                  {isOpen ? (
                    <div className="flex max-w-md flex-wrap gap-x-3 gap-y-1">
                      {state.keymap.layers.map((l) => (
                        <label key={l.id} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={d.if_layers.includes(l.index)}
                            onChange={() => toggle(e.index, l.index)}
                            className="accent-sky-500"
                          />
                          <span className="text-zinc-300">{layerLabel(l)}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="text-zinc-300">
                      {e.if_layers.length ? e.if_layers.map(name).join(" + ") : "(なし)"}
                    </span>
                  )}
                </td>
                <td className={TD}>
                  {isOpen ? (
                    <select
                      value={d.then_layer}
                      disabled={disabled}
                      onChange={(ev) =>
                        setDrafts((x) => ({
                          ...x,
                          [e.index]: { ...x[e.index], then_layer: Number(ev.target.value) },
                        }))
                      }
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {state.keymap.layers.map((l) => (
                        <option key={l.id} value={l.index}>
                          {l.index} · {layerLabel(l)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-zinc-300">{name(e.then_layer)}</span>
                  )}
                </td>
                <td className={`${TD} whitespace-nowrap`}>
                  <span className="inline-flex gap-2">
                    <Btn onClick={() => setOpen(isOpen ? null : e.index)}>
                      {isOpen ? "閉じる" : "編集"}
                    </Btn>
                    {isOpen && (
                      <>
                        <Btn
                          kind="primary"
                          disabled={disabled || !dirty}
                          onClick={() =>
                            void run(
                              () => condlayerSet(e.index, d.if_layers, d.then_layer),
                              `entry ${e.index} を適用しました`,
                            )
                          }
                        >
                          適用
                        </Btn>
                        <Btn
                          disabled={disabled}
                          onClick={() =>
                            void run(
                              () => condlayerReset(e.index),
                              `entry ${e.index} を既定に戻しました`,
                            )
                          }
                        >
                          既定に戻す
                        </Btn>
                      </>
                    )}
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
