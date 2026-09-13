import { useEffect, useState } from "react";
import { backupLog } from "../api";

type Entry = Record<string, unknown>;

function summary(e: Entry): string {
  const op = String(e.op ?? "");
  if (op === "ui_key_set") {
    const n = (e.new ?? {}) as Record<string, number>;
    return `L${e.layer_id} pos${e.position} → #${n.behavior_id} ${n.param1} ${n.param2}`;
  }
  if (op.startsWith("ui_layer_")) return JSON.stringify(e.args ?? {});
  if (op === "ui_snapshot" || op === "ui_start") return String(e.path ?? "");
  if (op === "ui_reset") return String(e.snapshot ?? "");
  return "";
}

export default function ChangeLog({
  open,
  version,
  onClose,
}: {
  open: boolean;
  /** Bumped by App after every mutation so the drawer reloads. */
  version: number;
  onClose(): void;
}) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    backupLog(50)
      .then((r) => alive && setEntries([...r.entries].reverse()))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [open, version]);

  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 max-h-[45vh] overflow-y-auto border-t border-zinc-700 bg-zinc-900/97">
      <div className="sticky top-0 flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
        <h3 className="text-sm font-semibold">変更履歴</h3>
        <span className="text-xs text-zinc-500">.zmkrt-backup.jsonl (新しい順)</span>
        <button
          onClick={onClose}
          className="ml-auto rounded border border-zinc-700 px-2 py-0.5 text-xs hover:bg-zinc-800"
        >
          閉じる
        </button>
      </div>
      {error && <p className="p-4 text-xs text-red-300">{error}</p>}
      {!entries && !error && <p className="p-4 text-xs text-zinc-500">読み込み中…</p>}
      {entries && !entries.length && <p className="p-4 text-xs text-zinc-500">まだ履歴がありません。</p>}
      <table className="w-full text-xs">
        <tbody>
          {entries?.map((e, i) => (
            <tr key={i} className="border-b border-zinc-800/60">
              <td className="w-40 px-4 py-1 font-mono text-zinc-500">{String(e.ts ?? "")}</td>
              <td className="w-36 px-2 py-1 font-medium text-sky-300">{String(e.op ?? "")}</td>
              <td className="px-2 py-1 font-mono break-all text-zinc-400">{summary(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
