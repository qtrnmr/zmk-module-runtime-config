import { useEffect, useRef } from "react";
import { activeLayerNames, clearLog, type PracticeState } from "../practice";
import type { Layer } from "../types";

/**
 * The 練習モード banner: what the keyboard is sending, which layers are on, and
 * a scrolling log of what just happened. Read-only — it never touches the
 * device, it only draws what /api/events said.
 */
export default function PracticeStrip({
  practice,
  layers,
  onChange,
  onStop,
}: {
  practice: PracticeState;
  layers: Layer[];
  onChange(next: PracticeState): void;
  onStop(): void;
}) {
  const names = activeLayerNames(practice, layers);
  const highest = layers[Math.min(practice.highest, layers.length - 1)];
  const highestName = highest ? highest.name || `L${highest.index}` : "";
  const chips = practice.output.length
    ? practice.output
    : practice.last
      ? [practice.last]
      : [];
  const held = practice.output.length > 0;

  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "nearest", inline: "end" });
  }, [practice.log]);

  return (
    <div className="flex min-w-0 items-center gap-x-4 overflow-hidden border-b border-emerald-700/40 bg-emerald-950/30 px-4 py-1.5 text-xs">
      <span className="flex shrink-0 items-center gap-1.5 font-medium text-emerald-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        練習モード
      </span>

      {/* left: what is being sent right now */}
      <div className="flex min-w-0 max-w-[40%] items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 text-zinc-500">出力:</span>
        {chips.length === 0 ? (
          <span className="text-zinc-600">—</span>
        ) : (
          chips.map((c, i) => (
            <span
              key={`${c.text}-${i}`}
              className={
                "rounded px-1.5 py-0.5 font-medium " +
                (held
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "bg-zinc-800 text-zinc-400")
              }
            >
              {c.encoder ? "↻ " : ""}
              {c.text}
            </span>
          ))
        )}
      </div>

      {/* middle: the layers the firmware says are on */}
      <div className="flex min-w-0 max-w-[30%] items-center gap-1.5 overflow-hidden">
        <span className="shrink-0 text-zinc-500">レイヤー:</span>
        {names.length === 0 ? (
          <span className="text-zinc-600">—</span>
        ) : (
          names.map((n) => (
            <span
              key={n}
              className={n === highestName ? "font-semibold text-emerald-200" : "text-zinc-400"}
            >
              {n}
            </span>
          ))
        )}
      </div>

      {/* right: the log, newest at the right edge */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-hidden whitespace-nowrap font-mono text-[11px] text-zinc-400">
          {practice.log.length === 0 && <span className="text-zinc-600">キーを押してみてください</span>}
          {practice.log.map((e) => (
            <span key={e.id} className={e.kind === "layers" ? "text-sky-300" : undefined}>
              {e.text}
            </span>
          ))}
          <div ref={logEnd} />
        </div>
        <button
          onClick={() => onChange(clearLog(practice))}
          className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          クリア
        </button>
        <button
          onClick={onStop}
          className="shrink-0 rounded border border-emerald-700 px-2 py-0.5 text-emerald-300 hover:bg-emerald-900/40"
        >
          終了
        </button>
      </div>
    </div>
  );
}
