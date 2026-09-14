import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FULL_KEYBOARD, type FullKey } from "../fullKeyboard";
import { keycodeHelp } from "../help";

/** 1u in px, and the flex gap between caps, so a 2u cap spans two cells. */
const UNIT = 30;
const GAP = 4;

function span(w = 1): number {
  return w * UNIT + (w - 1) * GAP;
}

function Cap({
  cap,
  value,
  keycodes,
  onPick,
}: {
  cap: FullKey;
  value: number;
  keycodes: Record<string, number>;
  onPick(code: string): void;
}) {
  if (!cap.code) return <span style={{ width: span(cap.w) }} className="shrink-0" />;
  const code = keycodes[cap.code];
  const missing = code === undefined;
  const on = !missing && code === value;
  return (
    <button
      type="button"
      disabled={missing}
      onClick={() => onPick(cap.code)}
      title={missing ? `${cap.code} (このファームウェアには無い)` : `${cap.code}\n${keycodeHelp(cap.code) ?? ""}`}
      style={{ width: span(cap.w) }}
      className={
        "h-8 shrink-0 overflow-hidden rounded border text-[11px] leading-none " +
        (missing
          ? "cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-700"
          : on
            ? "border-sky-400 bg-sky-500/25 text-sky-100"
            : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700")
      }
    >
      {cap.label}
    </button>
  );
}

function Block({
  rows,
  ...rest
}: {
  rows: FullKey[][];
  value: number;
  keycodes: Record<string, number>;
  onPick(code: string): void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1">
          {row.map((cap, j) => (
            <Cap key={`${cap.code}:${j}`} cap={cap} {...rest} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * "Which key is `APOSTROPHE` again?" — the other way to answer that is to draw
 * the keyboard and let it be pointed at. Keys the firmware does not know are
 * drawn dim and dead rather than hidden, so the board never changes shape.
 *
 * Only the base keycode is picked; the modifier toggles in KeycodePicker keep
 * whatever they had.
 */
export default function FullKeyboardPicker({
  value,
  keycodes,
  onPick,
  onClose,
}: {
  /** The current BASE keycode value (mods already stripped). */
  value: number;
  keycodes: Record<string, number>;
  onPick(code: string): void;
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const [fn, main, nav, numpad, media, jis] = FULL_KEYBOARD;
  const rest = { value, keycodes, onPick };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (!ref.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={ref}
        style={{ width: 820, maxWidth: "96vw", maxHeight: "92vh" }}
        className="overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-2xl shadow-black/70"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">キーボードから選ぶ</span>
          <span className="text-[11px] text-zinc-500">
            押したキーが base のキーコードになります (修飾トグルはそのまま)
          </span>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="ml-auto rounded px-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-3">
          <div className="flex flex-col gap-2">
            <Block rows={fn.rows} {...rest} />
            <Block rows={main.rows} {...rest} />
          </div>
          {/* PrtSc / ScrLk / Pause line up with the function row; the rest of
              the cluster and the numpad line up with the main block. */}
          <div className="flex flex-col gap-2">
            <Block rows={nav.rows.slice(0, 1)} {...rest} />
            <Block rows={nav.rows.slice(1)} {...rest} />
          </div>
          <div className="flex flex-col gap-2">
            <div style={{ height: 32 }} />
            <Block rows={numpad.rows} {...rest} />
          </div>
        </div>

        {[media, jis].map((sec) => (
          <div key={sec.name} className="mt-3">
            <p className="mb-1 text-[11px] text-zinc-500">{sec.name}</p>
            <Block rows={sec.rows} {...rest} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
