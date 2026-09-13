import { useEffect, useState } from "react";

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmText = "実行",
  requireTyped,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmText?: string;
  /** When set, the confirm button unlocks only once this exact text is typed. */
  requireTyped?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);
  if (!open) return null;
  const ready = requireTyped === undefined || typed === requireTyped;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md space-y-3 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {body && <p className="whitespace-pre-line text-xs text-zinc-400">{body}</p>}
        {requireTyped !== undefined && (
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">
              確認のため <span className="font-mono text-zinc-200">{requireTyped}</span> と入力
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready}
            className={
              "rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 " +
              (danger ? "bg-red-600 hover:bg-red-500" : "bg-sky-600 hover:bg-sky-500")
            }
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
