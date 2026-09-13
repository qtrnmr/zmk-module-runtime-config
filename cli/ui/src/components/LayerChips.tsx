import { useState } from "react";
import type { Layer } from "../types";
import { layerLabel } from "../types";
import ConfirmDialog from "./ConfirmDialog";

export interface RemovedLayer {
  id: number;
  name: string;
  index: number;
}

/** The layer switcher: a small floating card beside the keyboard with one row
 *  per layer. Click selects, double-click renames inline, drag reorders, `×`
 *  removes (with confirm); removed layers get a dashed "復元" row. */
export default function LayerChips({
  layers,
  current,
  onSelect,
  availableLayers,
  maxNameLength,
  disabled,
  onRename,
  onMove,
  onAdd,
  onRemove,
  removed,
  onRestore,
  showCombos,
  onToggleCombos,
}: {
  layers: Layer[];
  current: number;
  onSelect(index: number): void;
  availableLayers: number;
  maxNameLength: number;
  disabled: boolean;
  onRename(layerId: number, name: string): void;
  onMove(start: number, dest: number): void;
  onAdd(): void;
  onRemove(index: number): void;
  removed: RemovedLayer[];
  onRestore(layerId: number, atIndex: number): void;
  showCombos: boolean;
  onToggleCombos(v: boolean): void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);

  const startEdit = (l: Layer) => {
    if (disabled) return;
    setEditing(l.id);
    setDraft(l.name);
  };
  const commit = (l: Layer) => {
    setEditing(null);
    if (draft !== l.name) onRename(l.id, draft);
  };

  const canAdd = availableLayers > 0 && !disabled;

  return (
    <aside className="m-3 flex min-h-0 w-56 flex-col self-start rounded-xl border border-zinc-700/80 bg-zinc-900/80 shadow-xl shadow-black/40 backdrop-blur">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-400">レイヤー</h2>
        <button
          onClick={onAdd}
          disabled={!canAdd}
          title={availableLayers === 0 ? "available_layers = 0 (再フラッシュが必要)" : "レイヤーを追加"}
          className="ml-auto h-6 w-6 rounded-md border border-dashed border-zinc-600 text-sm leading-none text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </header>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {layers.map((l) => (
          <li
            key={l.id}
            draggable={!disabled && editing !== l.id}
            onDragStart={(e) => {
              setDragFrom(l.index);
              e.dataTransfer.setData("text/plain", String(l.index));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragFrom !== null && dragFrom !== l.index) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              setDragFrom(null);
              if (!Number.isNaN(from) && from !== l.index) onMove(from, l.index);
            }}
            className={
              "group flex items-center rounded-lg text-sm transition-colors " +
              (l.index === current
                ? "bg-sky-600 font-semibold text-white shadow-md shadow-sky-900/50"
                : "text-zinc-200 hover:bg-zinc-800") +
              (dragFrom !== null && dragFrom !== l.index ? " outline outline-1 outline-dashed outline-zinc-600" : "")
            }
          >
            {editing === l.id ? (
              <input
                autoFocus
                value={draft}
                maxLength={maxNameLength}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(l)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit(l);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="m-1 w-full rounded-md border border-sky-600 bg-zinc-950 px-2 py-1 text-sm outline-none"
              />
            ) : (
              <button
                onClick={() => onSelect(l.index)}
                onDoubleClick={() => startEdit(l)}
                title="ダブルクリックで名前を編集"
                className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-1.5 pr-2 text-left"
              >
                <span
                  className={
                    "inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] " +
                    (l.index === current ? "bg-white/20 text-white" : "bg-zinc-950/70 text-zinc-400")
                  }
                >
                  {l.index}
                </span>
                <span className="truncate">{layerLabel(l)}</span>
              </button>
            )}
            <button
              onClick={() => setConfirmIdx(l.index)}
              disabled={disabled}
              title="削除"
              className={
                "hidden pr-2 group-hover:block disabled:hidden " +
                (l.index === current ? "text-sky-200 hover:text-white" : "text-zinc-500 hover:text-red-400")
              }
            >
              ×
            </button>
          </li>
        ))}

        {removed.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onRestore(r.id, layers.length)}
              disabled={disabled}
              title="削除したレイヤーを復元"
              className="w-full rounded-lg border border-dashed border-zinc-600 px-2 py-1.5 text-left text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
            >
              復元: {r.name || `L${r.index}`}
            </button>
          </li>
        ))}
      </ul>

      <label className="flex items-center gap-2 border-t border-zinc-800 px-3 py-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={showCombos}
          onChange={(e) => onToggleCombos(e.target.checked)}
          className="accent-amber-500"
        />
        コンボ表示
      </label>

      <ConfirmDialog
        open={confirmIdx !== null}
        title="レイヤーを削除しますか?"
        body={
          confirmIdx === null
            ? ""
            : `レイヤー ${confirmIdx} · ${layerLabel(layers[confirmIdx])} を削除します。\n削除後は「復元」から戻せます。`
        }
        confirmText="削除"
        danger
        onCancel={() => setConfirmIdx(null)}
        onConfirm={() => {
          const i = confirmIdx!;
          setConfirmIdx(null);
          onRemove(i);
        }}
      />
    </aside>
  );
}
