import { useEffect, useMemo, useState } from "react";
import { keycodeHelp } from "../help";
import { catalog, type CatalogEntry } from "../keycodeCatalog";
import { pretty } from "../prettyKeycode";

/** Remembered across sessions: someone who opens this once usually wants it. */
const OPEN_KEY = "zmkrt.allKeysOpen";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    // Private windows and blocked site data throw on access; closed is fine.
    return false;
  }
}

/** Name, every other spelling of it, and the Japanese note — so 「音量」 finds
 *  C_VOL_UP and 「かっこ」 finds LPAR without knowing either name. */
function haystack(e: CatalogEntry): string {
  return [e.name, ...e.aliases, keycodeHelp(e.name) ?? ""].join(" ").toLowerCase();
}

function Chip({
  entry,
  on,
  onPick,
}: {
  entry: CatalogEntry;
  on: boolean;
  onPick(code: string): void;
}) {
  const help = keycodeHelp(entry.name);
  const alias = entry.aliases.length ? `\n別名: ${entry.aliases.join(", ")}` : "";
  const glyph = pretty(entry.name);
  return (
    <button
      type="button"
      onClick={() => onPick(entry.name)}
      title={`${entry.name}${alias}${help ? `\n${help}` : ""}`}
      className={
        "flex max-w-full items-baseline gap-1.5 rounded border px-1.5 py-0.5 leading-none " +
        (on
          ? "border-sky-400 bg-sky-500/25 text-sky-100"
          : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700")
      }
    >
      {/* The glyph is only worth a column when it is not the name again. */}
      {glyph !== entry.name && <span className="shrink-0 text-[11px]">{glyph}</span>}
      <span className="truncate font-mono text-[10px] text-zinc-400">{entry.name}</span>
    </button>
  );
}

/**
 * Every keycode the firmware knows, under the drawn keyboard.
 *
 * The board above can only offer the keys a full-size board has caps for. This
 * is the rest — shelved by keycodeCatalog.ts, one entry per value, filtered by
 * name, by any other spelling of it, or by the Japanese note. Collapsed by
 * default because 371 chips is not what most visits are here for.
 */
export default function AllKeysSection({
  value,
  base,
  exact,
  keycodes,
  onPick,
}: {
  /** The full current keycode value, modifier bits and all. */
  value: number;
  /** The same value with the modifier bits stripped. */
  base: number;
  /** Whether some keycode names `value` outright — see FullKeyboardPicker. */
  exact: boolean;
  keycodes: Record<string, number>;
  onPick(code: string): void;
}) {
  const [open, setOpen] = useState(readOpen);
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      // Nothing to do: the section still works, it just forgets.
    }
  }, [open]);

  const sections = useMemo(() => catalog(keycodes), [keycodes]);
  const total = useMemo(() => sections.reduce((n, s) => n + s.entries.length, 0), [sections]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sections;
    return sections
      .map((s) => ({ ...s, entries: s.entries.filter((e) => haystack(e).includes(needle)) }))
      .filter((s) => s.entries.length);
  }, [sections, q]);

  return (
    <div className="mt-4 border-t border-zinc-800 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-zinc-800/60"
      >
        <span className="w-3 text-zinc-500">{open ? "▾" : "▸"}</span>
        <span className="text-sm font-semibold text-zinc-100">すべてのキー</span>
        <span className="text-[11px] text-zinc-500">
          キーボードに無い記号・F13〜F24・メディア・アプリ操作など {total} 種類
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前・別名・説明で絞り込み (例: 音量, PLUS, かっこ)"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs outline-none focus:border-sky-600"
          />
          {shown.map((sec) => (
            <div key={sec.category}>
              <p className="mb-1 text-[11px] text-zinc-500">
                {sec.category}
                <span className="ml-1 text-zinc-600">{sec.entries.length}</span>
              </p>
              <div className="flex flex-wrap gap-1">
                {sec.entries.map((e) => (
                  <Chip
                    key={e.name}
                    entry={e}
                    // `+` and `=` share a base; while the value has a name of
                    // its own, only that one is the current key.
                    on={exact ? e.value === value : e.value === base}
                    onPick={onPick}
                  />
                ))}
              </div>
            </div>
          ))}
          {!shown.length && <p className="px-1 text-xs text-zinc-500">該当なし</p>}
        </div>
      )}
    </div>
  );
}
