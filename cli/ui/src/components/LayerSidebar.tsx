import { useState } from "react";
import type { Layer } from "../types";
import { layerLabel } from "../types";
import ConfirmDialog from "./ConfirmDialog";

export interface RemovedLayer {
  id: number;
  name: string;
  index: number;
}

export default function LayerSidebar({
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
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);

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
    <nav className="min-w-0 overflow-y-auto border-r border-zinc-800 p-2">
      <div className="flex items-center gap-1 px-2 pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500">レイヤー</h2>
        <button
          onClick={onAdd}
          disabled={!canAdd}
          title={
            availableLayers === 0
              ? "available_layers = 0 (再フラッシュが必要)"
              : "レイヤーを追加"
          }
          className="ml-auto rounded border border-zinc-700 px-1.5 text-sm leading-5 text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </div>
      <ul className="space-y-0.5">
        {layers.map((l) => (
          <li
            key={l.id}
            draggable={!disabled}
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
              "group flex items-center gap-1 rounded " +
              (l.index === current ? "bg-zinc-800" : "hover:bg-zinc-900") +
              (dragFrom !== null && dragFrom !== l.index ? " border-y border-dashed border-transparent hover:border-sky-600" : "")
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
                className="mx-1 w-full rounded border border-sky-600 bg-zinc-950 px-1 py-1 text-sm"
              />
            ) : (
              <>
                <button
                  onClick={() => onSelect(l.index)}
                  onDoubleClick={() => startEdit(l)}
                  title="ダブルクリックで名前を編集"
                  className={
                    "flex min-w-0 flex-1 items-baseline gap-2 px-2 py-1.5 text-left text-sm " +
                    (l.index === current ? "text-sky-300" : "")
                  }
                >
                  <span className="w-5 shrink-0 font-mono text-xs text-zinc-500">{l.index}</span>
                  <span className="truncate">{layerLabel(l)}</span>
                </button>
                <button
                  onClick={() => setConfirmIdx(l.index)}
                  disabled={disabled}
                  title="レイヤーを削除"
                  className="mr-1 hidden px-1 text-xs text-zinc-500 hover:text-red-400 group-hover:block disabled:hidden"
                >
                  🗑
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {removed.length > 0 && (
        <div className="mt-3 border-t border-zinc-800 pt-2">
          <button
            onClick={() => setShowRemoved((v) => !v)}
            className="w-full px-2 text-left text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showRemoved ? "▾" : "▸"} 削除済み ({removed.length})
          </button>
          {showRemoved && (
            <ul className="mt-1 space-y-0.5">
              {removed.map((r) => (
                <li key={r.id} className="flex items-center gap-1 px-2 py-1 text-xs">
                  <span className="truncate text-zinc-400">
                    {r.name || `L${r.index}`}
                  </span>
                  <button
                    onClick={() => onRestore(r.id, layers.length)}
                    disabled={disabled}
                    className="ml-auto rounded border border-zinc-700 px-1.5 py-0.5 hover:bg-zinc-800 disabled:opacity-40"
                  >
                    復元
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmIdx !== null}
        title="レイヤーを削除しますか?"
        body={
          confirmIdx === null
            ? ""
            : `レイヤー ${confirmIdx} · ${layerLabel(layers[confirmIdx])} を削除します。\n削除後は「削除済み」から復元できます。`
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
    </nav>
  );
}
