import { useMemo } from "react";
import { HOW_JA, groupKeyActivators, type Activator, type KeyActivator } from "../activators";
import { capText } from "../board";
import type { Layer } from "../types";
import { layerLabel } from "../types";

const CHIP =
  "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4";

/**
 * The line above the board: **how you get onto the layer you just picked**.
 *
 * Thirteen layers read as thirteen names, and a name says nothing about the
 * key you hold to be there. Each way in becomes a chip; clicking one takes you
 * to the layer the key lives on and opens it in the inspector, so "which key
 * is 英数?" is one click from the answer rather than a hunt across layers.
 */
export default function LayerEntry({
  layer,
  layers,
  base,
  activators,
  pending,
  onGo,
  onHide,
}: {
  layer: Layer;
  layers: Layer[];
  base: Layer | undefined;
  /** Every way into `layer`, from layerActivators(). */
  activators: Activator[];
  /** /api/features has not answered yet, so conditional layers and the
   *  trackball are still missing from the list. */
  pending: boolean;
  onGo(layerIndex: number, pos: number): void;
  onHide(): void;
}) {
  const name = (index: number) => {
    const l = layers.find((x) => x.index === index);
    return l ? layerLabel(l) : `L${index}`;
  };
  const keys = useMemo(() => groupKeyActivators(activators), [activators]);
  const rest = activators.filter((a): a is Exclude<Activator, KeyActivator> => a.kind !== "key");

  return (
    <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/40 px-4 py-1.5">
      <span className="shrink-0 text-xs text-zinc-400">
        <span className="font-medium text-zinc-200">{layerLabel(layer)}</span> へ入るには:
      </span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {keys.map((k) => (
          <button
            key={`${k.pos}:${k.how}`}
            onClick={() => onGo(k.on[0], k.pos)}
            title={`${name(k.on[0])} のこのキー (pos ${k.pos}) を開く`}
            className={
              CHIP +
              " border-violet-500/50 bg-violet-500/10 text-violet-100 hover:bg-violet-500/25"
            }
          >
            <span className="font-medium">{capText(base?.bindings[k.pos]?.label)}</span>
            <span className="text-violet-300">{HOW_JA[k.how]}</span>
            <span className="text-violet-400/80">({k.on.map(name).join(" · ")})</span>
          </button>
        ))}

        {rest.map((a, i) =>
          a.kind === "condlayer" ? (
            <span
              key={`c${i}`}
              className={CHIP + " border-emerald-600/50 bg-emerald-500/10 text-emerald-200"}
            >
              {a.ifLayers.map(name).join(" + ")} が同時に有効なとき自動
            </span>
          ) : (
            <span
              key={`t${i}`}
              className={CHIP + " border-zinc-700 bg-zinc-800/60 text-zinc-300"}
            >
              {a.text}
            </span>
          ),
        )}

        {pending && (
          <span
            title="条件レイヤーとトラックボールを読み込み中"
            className={CHIP + " border-zinc-800 bg-zinc-900 text-zinc-500"}
          >
            …
          </span>
        )}

        {!activators.length && !pending && (
          <span className="text-[11px] text-zinc-500">
            このレイヤーに入るキーは見つかりませんでした
          </span>
        )}
      </div>

      <button
        onClick={onHide}
        title="入り方の表示を隠す (レイヤーカードから戻せます)"
        className="shrink-0 px-1 text-sm leading-none text-zinc-600 hover:text-zinc-200"
      >
        ×
      </button>
    </div>
  );
}
