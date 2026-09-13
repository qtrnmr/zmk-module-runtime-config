import { useState } from "react";
import type { Tab } from "../types";
import { TABS } from "../types";

/** Left icon rail: the four pages, plus a `…` menu for the page-wide actions
 *  that used to sit in the top bar (change log, snapshot, reset). */
export default function Rail({
  tab,
  onTab,
  onLog,
  onSnapshot,
  onReset,
  onEncoder,
  busy,
}: {
  tab: Tab;
  onTab(t: Tab): void;
  onLog(): void;
  onSnapshot(): void;
  onReset(): void;
  /** Only set when the board draws no encoder knob but the device has one. */
  onEncoder?: () => void;
  busy: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const items: [string, () => void, boolean, boolean][] = [
    ["変更履歴", onLog, false, false],
    ["スナップショット", onSnapshot, busy, false],
    ...(onEncoder ? ([["エンコーダ", onEncoder, false, false]] as [string, () => void, boolean, boolean][]) : []),
    ["リセット…", onReset, busy, true],
  ];
  return (
    <nav className="flex w-14 flex-col items-center gap-1 border-r border-zinc-800 bg-zinc-950 py-2">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          title={t.label}
          aria-current={tab === t.id ? "page" : undefined}
          className={
            "flex h-11 w-11 flex-col items-center justify-center rounded-lg text-[9px] " +
            (tab === t.id
              ? "bg-sky-600/20 text-sky-300"
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200")
          }
        >
          <span className="text-base leading-none">{t.icon}</span>
          <span className="mt-0.5 leading-none">{t.label.slice(0, 4)}</span>
        </button>
      ))}
      <div className="relative mt-auto">
        <button
          onClick={() => setMenu((v) => !v)}
          title="その他"
          className="h-11 w-11 rounded-lg text-lg text-zinc-400 hover:bg-zinc-800"
        >
          …
        </button>
        {menu && (
          <div
            className="absolute bottom-0 left-12 z-30 w-44 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
            onMouseLeave={() => setMenu(false)}
          >
            {items.map(([label, fn, dis, danger]) => (
              <button
                key={label}
                disabled={dis}
                onClick={() => {
                  setMenu(false);
                  fn();
                }}
                className={
                  "block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-zinc-800 disabled:opacity-40 " +
                  (danger ? "text-red-300" : "text-zinc-200")
                }
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
