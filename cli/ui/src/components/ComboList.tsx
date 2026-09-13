import { comboKeysText, labelText } from "../board";
import type { Combos, Layer, Selection } from "../types";
import { layerLabel } from "../types";

/**
 * Every combo the firmware knows, under the layer card: the board only draws
 * the ones active on the current layer, so this is the one place you can see
 * that a chord exists but is scoped to another layer.
 */
export default function ComboList({
  combos,
  layers,
  base,
  currentLayer,
  selected,
  hover,
  onHover,
  onSelect,
  showCombos,
  onToggleCombos,
}: {
  /** null while /api/features is still in flight. */
  combos: Combos | null;
  layers: Layer[];
  base: Layer | undefined;
  currentLayer: number;
  selected: number | null;
  hover: number | null;
  onHover(index: number | null): void;
  onSelect(sel: Selection): void;
  /** Whether the board draws combo links; the switch lives here so the toggle
   *  sits next to the list it controls. */
  showCombos: boolean;
  onToggleCombos(v: boolean): void;
}) {
  // A keyboard without the combos RPC gets no card at all, rather than an
  // empty one that suggests it simply has no combos.
  if (combos && !combos.available) return null;

  const entries = combos?.available ? combos.entries : [];

  return (
    <aside className="mx-3 mb-3 flex min-h-0 w-56 flex-col rounded-xl border border-zinc-700/80 bg-zinc-900/80 shadow-xl shadow-black/40 backdrop-blur">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-400">コンボ</h2>
        {!!entries.length && (
          <span className="font-mono text-[11px] text-zinc-600">{entries.length}</span>
        )}
        <label
          title="盤面にコンボの線とピルを描く"
          className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400"
        >
          盤面に表示
          <span
            className={
              "relative inline-block h-4 w-7 rounded-full transition-colors " +
              (showCombos ? "bg-amber-500" : "bg-zinc-700")
            }
          >
            <input
              type="checkbox"
              checked={showCombos}
              onChange={(e) => onToggleCombos(e.target.checked)}
              className="peer absolute inset-0 cursor-pointer opacity-0"
            />
            <span
              className={
                "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all " +
                (showCombos ? "left-3.5" : "left-0.5")
              }
            />
          </span>
        </label>
      </header>

      {!combos ? (
        <p className="px-3 py-2 text-xs text-zinc-500">読み込み中…</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {entries.map((c) => {
            const scoped = c.layers.length > 0;
            const active = !scoped || c.layers.includes(currentLayer);
            const on = c.layers
              .map((i) => {
                const l = layers.find((x) => x.index === i);
                return l ? layerLabel(l) : String(i);
              })
              .join(", ");
            const isSel = selected === c.index;
            return (
              <li key={c.index}>
                <button
                  onMouseEnter={() => onHover(c.index)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect({ kind: "combo", index: c.index })}
                  title={`コンボ ${c.index}${scoped ? ` · 有効レイヤー: ${on}` : ""}`}
                  className={
                    "flex w-full items-baseline gap-1.5 rounded-lg px-2 py-1 text-left text-xs transition-colors " +
                    (isSel
                      ? "bg-sky-600 font-medium text-white shadow-md shadow-sky-900/50"
                      : hover === c.index
                        ? "bg-zinc-800 text-zinc-100"
                        : active
                          ? "text-zinc-200 hover:bg-zinc-800"
                          : "text-zinc-500 hover:bg-zinc-800")
                  }
                >
                  <span className="shrink-0 font-mono">{comboKeysText(c, base)}</span>
                  <span className={isSel ? "text-sky-200" : "text-zinc-600"}>→</span>
                  <span className="truncate">{labelText(c.effective.label, "?")}</span>
                  {!active && (
                    <span
                      className={
                        "ml-auto max-w-[72px] shrink-0 truncate text-[10px] " +
                        (isSel ? "text-sky-200" : "text-zinc-600")
                      }
                    >
                      {on}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {!entries.length && (
            <li className="px-2 py-1 text-xs text-zinc-500">コンボはありません</li>
          )}
        </ul>
      )}
    </aside>
  );
}
