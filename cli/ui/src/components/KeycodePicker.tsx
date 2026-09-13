import { useEffect, useMemo, useRef, useState } from "react";
import { MOD_HELP, keycodeHelp } from "../help";
import { MOD_BITS, MOD_ORDER, joinMods, splitMods, type ModName } from "../params";
import { pretty } from "../prettyKeycode";
import { Info } from "./Tooltip";

const MOD_GLYPH: Record<ModName, string> = {
  LC: "^", LS: "⇧", LA: "⌥", LG: "⌘",
  RC: "^", RS: "⇧", RA: "⌥", RG: "⌘",
};

const MAX_ROWS = 60;

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
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const { base, mods } = splitMods(value);

  const names = useMemo(() => Object.keys(keycodes).sort(), [keycodes]);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return names.slice(0, MAX_ROWS);
    return names.filter((n) => n.toLowerCase().includes(needle)).slice(0, MAX_ROWS);
  }, [names, q]);

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
    } else if (e.key === "Enter") {
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

      <div className="relative">
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
          placeholder="キーコード検索 (例: TAB, NUM_1)"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm outline-none focus:border-sky-600"
        />
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
          </ul>
        )}
      </div>
    </div>
  );
}
