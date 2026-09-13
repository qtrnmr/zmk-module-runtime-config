import { useMemo, useState } from "react";
import { MOD_BITS, MOD_ORDER, joinMods, splitMods, type ModName } from "../params";
import { pretty } from "../prettyKeycode";

const MOD_GLYPH: Record<ModName, string> = {
  LC: "^", LS: "⇧", LA: "⌥", LG: "⌘",
  RC: "^", RS: "⇧", RA: "⌥", RG: "⌘",
};

const MAX_ROWS = 60;

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
  const { base, mods } = splitMods(value);

  const names = useMemo(() => Object.keys(keycodes).sort(), [keycodes]);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return names.slice(0, MAX_ROWS);
    return names.filter((n) => n.toLowerCase().includes(needle)).slice(0, MAX_ROWS);
  }, [names, q]);

  const baseName = useMemo(
    () => names.find((n) => keycodes[n] === base) ?? `0x${base.toString(16).toUpperCase()}`,
    [names, keycodes, base],
  );
  const canonical = mods.reduceRight((t, m) => `${m}(${t})`, baseName);

  const toggle = (m: ModName) => {
    const next = mods.includes(m) ? mods.filter((x) => x !== m) : [...mods, m];
    onChange(joinMods(base, next));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {MOD_ORDER.map((m) => (
          <button
            key={m}
            onClick={() => toggle(m)}
            title={`${m} (0x${MOD_BITS[m].toString(16)})`}
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
      <div className="rounded border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-xs">
        <span className="font-mono text-zinc-300">{canonical}</span>
        <span className="ml-2 text-zinc-500">{pretty(canonical)}</span>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="キーコード検索 (例: TAB, NUM_1)"
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm outline-none focus:border-sky-600"
      />
      <ul className="max-h-52 overflow-y-auto rounded border border-zinc-800">
        {hits.map((n) => (
          <li key={n}>
            <button
              onClick={() => onChange(joinMods(keycodes[n], mods))}
              className={
                "flex w-full items-baseline justify-between px-2 py-1 text-left font-mono text-xs hover:bg-zinc-800 " +
                (keycodes[n] === base ? "bg-zinc-800 text-sky-300" : "text-zinc-300")
              }
            >
              <span>{n}</span>
              <span className="text-zinc-500">{pretty(n)}</span>
            </button>
          </li>
        ))}
        {!hits.length && <li className="px-2 py-1 text-xs text-zinc-500">一致なし</li>}
      </ul>
    </div>
  );
}
