import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FULL_KEYBOARD, SHIFT_CODES, type FullKey } from "../fullKeyboard";
import { keycodeHelp } from "../help";
import { pretty } from "../prettyKeycode";
import { splitMods } from "../params";
import AllKeysSection from "./AllKeysSection";

/** 1u in px, and the flex gap between caps, so a 2u cap spans two cells. */
const UNIT = 30;
const GAP = 4;

function span(w = 1): number {
  return w * UNIT + (w - 1) * GAP;
}

/** Shrink the label until it fits its cap: `Pause` and `半角/全角` are both
 *  wider than a 1u key at the default size. Latin is ~6.5px per character at
 *  11px, CJK ~11px. */
function fit(label: string, w = 1): string {
  const room = span(w) - 6;
  const est = (px: number) =>
    [...label].reduce((sum, ch) => sum + (/[ -~]/.test(ch) ? px * 0.6 : px), 0);
  if (est(11) <= room) return "text-[11px]";
  if (est(9) <= room) return "text-[9px]";
  return "text-[8px]";
}

interface CapCtx {
  /** The full current keycode value, modifier bits and all. */
  value: number;
  /** The same value with the modifier bits stripped. */
  base: number;
  /**
   * Whether some keycode names `value` outright. `PLUS` does, so only `+`
   * lights up; `LS(A)` does not, so the plain `A` cap lights up instead and a
   * modifier toggle never leaves the board with nothing selected.
   */
  exact: boolean;
  keycodes: Record<string, number>;
  shift: boolean;
  onPick(code: string): void;
  onShift(): void;
}

function Cap({
  cap,
  value,
  base,
  exact,
  keycodes,
  shift,
  onPick,
  onShift,
}: CapCtx & { cap: FullKey }) {
  if (!cap.code) return <span style={{ width: span(cap.w) }} className="shrink-0" />;

  // The Shift caps drive the ⇧ layer instead of committing themselves — as on
  // a real board, where holding Shift is how you reach the symbols above.
  if (SHIFT_CODES.includes(cap.code))
    return (
      <button
        type="button"
        onClick={onShift}
        aria-pressed={shift}
        title={`⇧ Shift 表示の切り替え。キーコードとしての ${cap.code} は検索か「すべてのキー」から選べます。`}
        style={{ width: span(cap.w) }}
        className={
          `h-8 shrink-0 overflow-hidden rounded border leading-none ${fit(cap.label, cap.w)} ` +
          (shift
            ? "border-amber-400 bg-amber-500/25 text-amber-100"
            : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700")
        }
      >
        {cap.label}
      </button>
    );

  const face = shift && cap.shifted ? cap.shifted : cap;
  const code = keycodes[face.code];
  const missing = code === undefined;
  // `+` and `=` share a base and differ only in the modifier bit `PLUS` carries,
  // so while the value has a name of its own it alone lights up.
  const on = !missing && (exact ? code === value : code === base);
  return (
    <button
      type="button"
      disabled={missing}
      onClick={() => onPick(face.code)}
      title={missing ? `${face.code} (このファームウェアには無い)` : `${face.code}\n${keycodeHelp(face.code) ?? ""}`}
      style={{ width: span(cap.w) }}
      className={
        `h-8 shrink-0 overflow-hidden rounded border leading-none ${fit(face.label, cap.w)} ` +
        (missing
          ? "cursor-not-allowed border-zinc-800 bg-zinc-900/40 text-zinc-700"
          : on
            ? "border-sky-400 bg-sky-500/25 text-sky-100"
            : face !== cap
              ? "border-amber-700/70 bg-zinc-800 text-amber-100 hover:border-amber-500 hover:bg-zinc-700"
              : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-700")
      }
    >
      {face.label}
    </button>
  );
}

function Block({ rows, ...rest }: CapCtx & { rows: FullKey[][] }) {
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
 * Only the keycode is picked; the modifier toggles in KeycodePicker keep
 * whatever they had.
 *
 * The ⇧ toggle turns the number row and the punctuation into the dedicated
 * shifted keycodes — `!` really is `EXCL`, not `LS` plus `NUM_1` — and
 * everything with no cap at all lives in すべてのキー underneath.
 */
export default function FullKeyboardPicker({
  value,
  keycodes,
  onPick,
  onClose,
}: {
  /** The current keycode value, modifier bits and all. */
  value: number;
  keycodes: Record<string, number>;
  onPick(code: string): void;
  onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Deliberately not remembered: ⇧ describes what you are looking at right
  // now, and reopening the board to a shifted face nobody asked for is worse
  // than one extra click.
  const [shift, setShift] = useState(false);
  /** Shortest name for the current value (whole value first, then its base). */
  const currentName = (() => {
    const byValue = (v: number) =>
      Object.keys(keycodes)
        .filter((n) => keycodes[n] === v)
        .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0];
    const whole = byValue(value);
    if (whole) return whole;
    const { base, mods } = splitMods(value);
    const b = byValue(base);
    return b ? mods.reduceRight((t, m) => `${m}(${t})`, b) : undefined;
  })();

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
  const { base } = splitMods(value);
  const exact = Object.values(keycodes).includes(value);
  const rest = {
    value,
    base,
    exact,
    keycodes,
    shift,
    onPick,
    onShift: () => setShift((v) => !v),
  };

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
            押したキーがキーコードになります (修飾トグルはそのまま)
          </span>
          {currentName && (
            <span
              className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-sky-700/60 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-100"
              title="いま押されたことにするキー"
            >
              現在 <span className="text-sm font-semibold">{pretty(currentName)}</span>
              <span className="font-mono text-[10px] text-sky-300/80">{currentName}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setShift((v) => !v)}
            aria-pressed={shift}
            title="数字と記号のキーを、Shift を押したときの記号 (! @ # … + { } ? ~) に切り替えます。画面上の Shift キーでも切り替えられます。"
            className={
              "ml-auto rounded border px-2 py-0.5 text-[11px] " +
              (shift
                ? "border-amber-400 bg-amber-500/20 text-amber-100"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")
            }
          >
            ⇧ Shift 表示
          </button>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded px-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
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

        <AllKeysSection
          value={value}
          base={base}
          exact={exact}
          keycodes={keycodes}
          onPick={onPick}
        />
      </div>
    </div>,
    document.body,
  );
}
