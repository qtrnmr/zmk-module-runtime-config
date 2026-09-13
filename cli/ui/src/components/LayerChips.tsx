import { useState } from "react";
import type { Layer } from "../types";
import { layerLabel } from "../types";
import ConfirmDialog from "./ConfirmDialog";

export interface RemovedLayer {
  id: number;
  name: string;
  index: number;
}

/** The layer switcher, as a wrapping chip row above the keyboard. Click
 *  selects, double-click renames inline, drag reorders, `×` removes. */
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
    <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/60 px-4 py-2">
      {layers.map((l) => (
        <div
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
            "group flex items-center rounded-full border text-xs " +
            (l.index === current
              ? "border-sky-500 bg-sky-600/20 text-sky-200"
              : "border-zinc-700 text-zinc-300 hover:bg-zinc-800") +
            (dragFrom !== null && dragFrom !== l.index ? " border-dashed" : "")
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
              className="w-24 rounded-full border border-sky-600 bg-zinc-950 px-2.5 py-1 text-xs outline-none"
            />
          ) : (
            <button
              onClick={() => onSelect(l.index)}
              onDoubleClick={() => startEdit(l)}
              title="ダブルクリックで名前を編集"
              className="flex items-center gap-1.5 py-1 pl-2.5 pr-2"
            >
              <span className="font-mono text-[10px] text-zinc-500">{l.index}</span>
              <span>{layerLabel(l)}</span>
            </button>
          )}
          <button
            onClick={() => setConfirmIdx(l.index)}
            disabled={disabled}
            title="削除"
            className="hidden pr-2 text-zinc-500 hover:text-red-400 group-hover:block disabled:hidden"
          >
            ×
          </button>
        </div>
      ))}

      <button
        onClick={onAdd}
        disabled={!canAdd}
        title={availableLayers === 0 ? "available_layers = 0 (再フラッシュが必要)" : "レイヤーを追加"}
        className="rounded-full border border-dashed border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        +
      </button>

      {removed.map((r) => (
        <button
          key={r.id}
          onClick={() => onRestore(r.id, layers.length)}
          disabled={disabled}
          title="削除したレイヤーを復元"
          className="rounded-full border border-dashed border-zinc-700 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
        >
          復元: {r.name || `L${r.index}`}
        </button>
      ))}

      <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-400">
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
            : `レイヤー ${confirmIdx} · ${layerLabel(layers[confirmIdx])} を削除します。\n削除後は「復元」チップから戻せます。`
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
    </div>
  );
}
