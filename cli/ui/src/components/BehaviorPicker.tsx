import { useEffect, useMemo, useRef, useState } from "react";
import { BEHAVIOR_HELP, behaviorJa, behaviorSummary, groupBehaviors } from "../help";
import type { Behavior } from "../types";
import { DT_DEFAULT_ID } from "../types";

/**
 * The behaviour field: a button that says, in Japanese, what the current
 * behaviour does, and a grouped list to pick another one from.
 *
 * A `<select>` showed thirty-six names like `LAYER_TAP_TO_0` in one flat
 * alphabetical run, and the only explanation was a tooltip you had to know to
 * hover. Here every row carries its Japanese name, its ZMK spelling and one
 * line of what it does, under the section it belongs to.
 */
export default function BehaviorPicker({
  behaviors,
  value,
  onPick,
  disabled,
}: {
  behaviors: Behavior[];
  value: number;
  onPick(id: number): void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = behaviors.find((b) => b.id === value);

  /** Japanese name, ZMK name and the help text are all searchable: someone who
   *  only knows "レイヤー" and someone who only knows "&mo" both find it. */
  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (b: Behavior) =>
      !needle ||
      b.display_name.toLowerCase().includes(needle) ||
      behaviorJa(b.display_name).toLowerCase().includes(needle) ||
      (BEHAVIOR_HELP[b.display_name] ?? "").toLowerCase().includes(needle);
    return groupBehaviors(behaviors.filter(hit));
  }, [behaviors, q]);

  const flat = useMemo(() => sections.flatMap((s) => s.behaviors), [sections]);

  // Opening lands on the behaviour already in the field, so ↑↓ starts from
  // where you are rather than from the top of the list.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(Math.max(0, behaviors.findIndex((b) => b.id === value)));
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActive((a) => (a < flat.length ? a : 0));
  }, [flat.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, flat.length]);

  // A click anywhere else closes the list; the inspector's own Escape handler
  // is kept away from it while it is open (see onKeyDown).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (id: number) => {
    onPick(id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) pick(flat[active].id);
    }
  };

  let row = -1;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-left hover:border-zinc-600 disabled:opacity-50"
      >
        <span className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium text-zinc-100">
            {current ? behaviorJa(current.display_name) : "(devicetree の既定のまま)"}
          </span>
          {current && (
            <span className="truncate font-mono text-[11px] text-zinc-500">
              {current.display_name}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[10px] text-zinc-500">▾</span>
        </span>
        {current && behaviorSummary(current.display_name) && (
          <span className="mt-0.5 block text-[13px] leading-snug text-zinc-400">
            {behaviorSummary(current.display_name)}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 left-0 z-30 mt-1 rounded border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/60"
          onKeyDown={onKeyDown}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="絞り込み (レイヤー, mo, 長押し…)"
            className="w-full border-b border-zinc-800 bg-transparent px-2 py-1.5 text-sm outline-none"
          />
          <div ref={listRef} className="max-h-80 overflow-y-auto">
            {sections.map((sec) => (
              <div key={sec.group}>
                <div className="sticky top-0 bg-zinc-950/95 px-2 py-1 text-[11px] font-medium text-zinc-500">
                  {sec.group}
                </div>
                {sec.behaviors.map((b) => {
                  row += 1;
                  const i = row;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      data-idx={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => pick(b.id)}
                      className={
                        "block w-full px-2 py-1.5 text-left " +
                        (i === active ? "bg-zinc-800 " : "") +
                        (b.id === value ? "border-l-2 border-sky-500" : "border-l-2 border-transparent")
                      }
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">
                          {behaviorJa(b.display_name)}
                        </span>
                        <span className="truncate font-mono text-[11px] text-zinc-500">
                          {b.display_name}
                        </span>
                      </span>
                      {behaviorSummary(b.display_name) && (
                        <span className="mt-0.5 block text-[13px] leading-snug text-zinc-400">
                          {behaviorSummary(b.display_name)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {!flat.length && <p className="px-2 py-2 text-xs text-zinc-500">該当なし</p>}
            {value === DT_DEFAULT_ID && !current && (
              <p className="border-t border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-500">
                このキーはまだ runtime で上書きされていません (devicetree の既定のまま)。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
