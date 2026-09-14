import { useEffect, useMemo, useRef, useState } from "react";
import { MOD_HELP, keycodeHelp } from "../help";
import { MOD_BITS, MOD_ORDER, joinMods, splitMods, type ModName } from "../params";
import { pretty } from "../prettyKeycode";
import FullKeyboardPicker from "./FullKeyboardPicker";
import { Info } from "./Tooltip";

const MOD_GLYPH: Record<ModName, string> = {
  LC: "^", LS: "⇧", LA: "⌥", LG: "⌘",
  RC: "^", RS: "⇧", RA: "⌥", RG: "⌘",
};

const MAX_ROWS = 60;

/** Search ranking: what you started typing beats what merely contains it, and
 *  both beat a hit in the Japanese description — so `PLU` offers `PLUS` first
 *  and not `KP_PLUS` or `C_MEDIA_VCR_PLUS`. */
function rankOf(name: string, needle: string): number {
  const n = name.toLowerCase();
  if (n.startsWith(needle)) return 0;
  if (n.includes(needle)) return 1;
  return (keycodeHelp(name) ?? "").toLowerCase().includes(needle) ? 2 : 3;
}

/** Candidates for `q`, best first: prefix, then substring, then description,
 *  and the shorter name inside each band. An empty query lists everything. */
export function searchKeycodes(names: string[], q: string, max = MAX_ROWS): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return names.slice(0, max);
  return names
    .map((n) => [n, rankOf(n, needle)] as const)
    .filter(([, r]) => r < 3)
    .sort((a, b) => a[1] - b[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([n]) => n);
}

/**
 * Modifier toggles, the current value, and a search box whose results drop over
 * the form instead of sitting under it: the list is only useful while you are
 * typing in it, and a permanently open one pushed the rest of the key inspector
 * off screen.
 */
export default function KeycodePicker({
  value,
  keycodes,
  onChange,
}: {
  value: number;
  keycodes: Record<string, number>;
  onChange(v: number): void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { base, mods } = splitMods(value);

  const names = useMemo(() => Object.keys(keycodes).sort(), [keycodes]);
  const hits = useMemo(() => searchKeycodes(names, q), [names, q]);

  /** The rest of the highlighted candidate, drawn behind the caret. */
  const ghost = useMemo(() => {
    const top = hits[active];
    if (!q || !top || !top.toLowerCase().startsWith(q.toLowerCase())) return "";
    return top.slice(q.length);
  }, [hits, active, q]);

  // Keep the highlighted row in range and in view as the query narrows.
  useEffect(() => {
    setActive((a) => (a < hits.length ? a : 0));
  }, [hits]);
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const baseName = useMemo(
    () => names.find((n) => keycodes[n] === base) ?? `0x${base.toString(16).toUpperCase()}`,
    [names, keycodes, base],
  );
  const canonical = mods.reduceRight((t, m) => `${m}(${t})`, baseName);

  const toggle = (m: ModName) => {
    const next = mods.includes(m) ? mods.filter((x) => x !== m) : [...mods, m];
    onChange(joinMods(base, next));
  };

  const pick = (n: string) => {
    onChange(joinMods(keycodes[n], mods));
    setQ("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      // The inspector closes on a window-level Escape; while the list is open
      // the key belongs to the list, so keep it from reaching that listener.
      if (open) e.stopPropagation();
      setOpen(false);
      return;
    }
    if (!open) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      // Tab completes the ghost the same way Enter commits the row, so the
      // hand never has to leave the home position to accept a suggestion.
      e.preventDefault();
      if (hits[active]) pick(hits[active]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {MOD_ORDER.map((m) => (
          <button
            key={m}
            onClick={() => toggle(m)}
            title={`${MOD_HELP[m]} ${m} = 0x${MOD_BITS[m].toString(16)}`}
            className={
              "rounded border px-1.5 py-0.5 font-mono text-[11px] " +
              (mods.includes(m)
                ? "border-sky-500 bg-sky-500/20 text-sky-200"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")
            }
          >
            {m}
            <span className="ml-0.5 text-zinc-500">{MOD_GLYPH[m]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs">
        <span className="font-mono text-zinc-300">{canonical}</span>
        <span className="text-zinc-500">{pretty(canonical)}</span>
        <span className="ml-auto">
          <Info text={keycodeHelp(canonical)} label={canonical} />
        </span>
      </div>

      <div className="flex items-start gap-1">
        <div className="relative min-w-0 flex-1">
          <div className="flex rounded border border-zinc-700 bg-zinc-900 focus-within:border-sky-600">
            {/* Inline autocomplete: the typed text is spaced out invisibly and
                the rest of the highlighted candidate sits behind the caret, so
                `PLU` reads as `PLU`+`S` without touching the input's value. */}
            {ghost && (
              <div className="pointer-events-none absolute inset-0 px-2 py-1 font-mono text-sm whitespace-pre">
                <span className="invisible">{q}</span>
                <span className="text-zinc-600">{ghost}</span>
              </div>
            )}
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              // The list closes on blur, so a row has to commit before it: mousedown
              // on the list is swallowed and the click lands on a still-open list.
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
              placeholder="キーコード検索 (例: TAB, PLU, ミュート)"
              className="w-full bg-transparent px-2 py-1 font-mono text-sm outline-none"
            />
          </div>
          {open && (
            <ul
              ref={listRef}
              onMouseDown={(e) => e.preventDefault()}
              className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/60"
            >
              {hits.map((n, i) => (
                <li
                  key={n}
                  className={
                    "flex items-center gap-1 pr-1.5 " + (i === active ? "bg-zinc-800" : "")
                  }
                >
                  <button
                    onClick={() => pick(n)}
                    onMouseMove={() => setActive(i)}
                    className={
                      "flex min-w-0 flex-1 items-baseline justify-between px-2 py-1 text-left font-mono text-xs " +
                      (keycodes[n] === base ? "text-sky-300" : "text-zinc-300")
                    }
                  >
                    <span className="truncate">{n}</span>
                    <span className="ml-2 shrink-0 text-zinc-500">{pretty(n)}</span>
                  </button>
                  <Info text={keycodeHelp(n)} label={n} />
                </li>
              ))}
              {!hits.length && <li className="px-2 py-1 text-xs text-zinc-500">該当なし</li>}
              {!!hits.length && (
                <li className="border-t border-zinc-800 px-2 py-1 text-[10px] text-zinc-600">
                  Tab / Enter で確定 · ↑↓ で移動 · Esc で閉じる
                </li>
              )}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => setBoard(true)}
          title="フルサイズのキーボードから選ぶ"
          className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-[11px] whitespace-nowrap text-zinc-300 hover:bg-zinc-800"
        >
          ⌨ キーボードから選ぶ
        </button>
      </div>

      {board && (
        <FullKeyboardPicker
          value={base}
          keycodes={keycodes}
          onPick={(code) => {
            pick(code);
            setBoard(false);
          }}
          onClose={() => setBoard(false)}
        />
      )}
    </div>
  );
}
