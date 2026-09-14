import { useEffect, useState } from "react";
import type { PanelProps } from "../App";
import { condlayerReset, condlayerSet } from "../api";
import type { CondlayerEntry } from "../types";
import { layerLabel } from "../types";
import { LayerCheckboxes, LayerOptions } from "../components/LayerChoice";
import { Btn, Card, INPUT, NotAvailable, Panel } from "./ui";

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

export default function CondlayerPanel({
  state,
  features,
  groups,
  disabled,
  run,
}: PanelProps) {
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
      <div className="space-y-2">
        {entries.map((e) => {
          const d = drafts[e.index] ?? draftOf(e);
          const dirty = !same(d.if_layers, e.if_layers) || d.then_layer !== e.then_layer;
          const isOpen = open === e.index;
          return (
            <Card key={e.index}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="font-mono text-xs text-zinc-500">#{e.index}</span>
                <span className="text-sm text-zinc-200">
                  {e.if_layers.length ? e.if_layers.map(name).join(" + ") : "(なし)"}
                </span>
                <span className="text-zinc-600">→</span>
                <span className="text-sm text-sky-300">{name(e.then_layer)}</span>
                <span className="ml-auto inline-flex gap-2">
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
                            ["condlayers"],
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
                            ["condlayers"],
                          )
                        }
                      >
                        既定に戻す
                      </Btn>
                    </>
                  )}
                </span>
              </div>

              {isOpen && (
                <div className="space-y-3 border-t border-zinc-800 pt-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-zinc-400">if-layers</span>
                    <LayerCheckboxes
                      layers={state.keymap.layers}
                      groups={groups}
                      checked={d.if_layers}
                      disabled={disabled}
                      onToggle={(i) => toggle(e.index, i)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                    then-layer
                    <select
                      value={d.then_layer}
                      disabled={disabled}
                      onChange={(ev) =>
                        setDrafts((x) => ({
                          ...x,
                          [e.index]: { ...x[e.index], then_layer: Number(ev.target.value) },
                        }))
                      }
                      className={INPUT}
                    >
                      <LayerOptions layers={state.keymap.layers} groups={groups} />
                    </select>
                  </label>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </Panel>
  );
}
