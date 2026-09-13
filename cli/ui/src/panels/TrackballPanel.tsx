import { useState } from "react";
import type { PanelProps } from "../App";
import { trackballReset, trackballSet } from "../api";
import ConfirmDialog from "../components/ConfirmDialog";
import { Info } from "../components/Tooltip";
import { TRACKBALL_HELP, groupTrackballFields } from "../help";
import type { Processor, TrackballField } from "../types";
import { layerLabel } from "../types";
import { Btn, Card, INPUT, NotAvailable, Panel } from "./ui";

export default function TrackballPanel({ state, features, disabled, run }: PanelProps) {
  const tb = features.trackball;
  const processors = tb.available ? tb.processors : [];
  const fields = tb.available ? tb.fields : [];
  const [id, setId] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  /** Field name -> transient "✓" / error, cleared on the next change. */
  const [marks, setMarks] = useState<Record<string, string>>({});

  if (!tb.available) return <NotAvailable title="トラックボール" feature={tb} />;

  const proc: Processor | undefined = processors.find((p) => p.id === id) ?? processors[0];
  if (!proc) return <NotAvailable title="トラックボール" feature={{ available: false, error: "プロセッサが 1 つも見つかりません" }} />;

  /** Each control applies on its own: there is one RPC per field anyway, and a
   *  trackball setting is worth feeling immediately. */
  const send = (f: TrackballField, value: number | boolean | string) => {
    setMarks((m) => ({ ...m, [f.name]: "…" }));
    void run(async () => {
      const r = await trackballSet(id, f.name, value);
      setMarks((m) => ({ ...m, [f.name]: r.ok ? "✓" : (r.error ?? "失敗") }));
      return r;
    }, `${f.name} = ${value}`, ["trackball"]);
  };

  const control = (f: TrackballField) => {
    const raw = proc[f.info_key];
    if (f.kind === "bool")
      return (
        <input
          type="checkbox"
          disabled={disabled}
          checked={Boolean(raw)}
          onChange={(e) => send(f, e.target.checked)}
          className="accent-sky-500"
        />
      );
    if (f.kind === "enum")
      return (
        <select
          disabled={disabled}
          value={f.options?.[Number(raw)] ?? ""}
          onChange={(e) => send(f, e.target.value)}
          className={INPUT}
        >
          {f.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    if (f.kind === "layer")
      return (
        <select
          disabled={disabled}
          value={Number(raw)}
          onChange={(e) => send(f, Number(e.target.value))}
          className={INPUT}
        >
          {state.keymap.layers.map((l) => (
            <option key={l.id} value={l.index}>
              {l.index} · {layerLabel(l)}
            </option>
          ))}
        </select>
      );
    return (
      <input
        type="number"
        // Applies on blur / Enter, not on every keystroke: each edit is an RPC
        // plus a full refetch.
        defaultValue={Number(raw)}
        key={`${id}-${f.name}-${raw}`}
        disabled={disabled}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (v !== Number(raw)) send(f, v);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={`w-28 ${INPUT}`}
      />
    );
  };

  return (
    <Panel
      title="トラックボール"
      note="各項目は変更した時点で個別にデバイスへ書き込まれます (数値は入力欄から離れたとき)。"
    >
      {processors.length > 1 && (
        <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
          プロセッサ
          <select value={id} onChange={(e) => setId(Number(e.target.value))} className={INPUT}>
            {processors.map((p) => (
              <option key={String(p.id)} value={Number(p.id)}>
                {String(p.id)} · {String(p.name)}
              </option>
            ))}
          </select>
        </label>
      )}

      {groupTrackballFields(fields).map(({ group, fields: rows }) => (
        <Card key={group} title={group}>
          <div className="space-y-2.5">
            {rows.map((f) => {
              // A field this table does not know (another keyboard's processor)
              // still has to be editable, so fall back to its raw name.
              const h = TRACKBALL_HELP[f.name];
              return (
                <div key={f.name} className="flex max-w-xl flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-zinc-200">{h?.label ?? f.name}</span>
                      <Info text={h?.help} label={h?.label ?? f.name} />
                    </div>
                    <div className="font-mono text-[11px] break-all text-zinc-600">{f.name}</div>
                  </div>
                  {control(f)}
                  <span
                    className={
                      "w-3 text-xs " +
                      (marks[f.name] === "✓" ? "text-emerald-400" : "text-amber-300")
                    }
                    title={marks[f.name]}
                  >
                    {marks[f.name] === "✓" || marks[f.name] === "…"
                      ? marks[f.name]
                      : marks[f.name] && "!"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <div>
        <Btn kind="danger" disabled={disabled} onClick={() => setResetOpen(true)}>
          既定に戻す
        </Btn>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={`プロセッサ ${id} (${String(proc.name)}) を既定に戻しますか?`}
        body={
          "devicetree の既定値に戻します。現在の値:\n" +
          fields.map((f) => `  ${f.name} = ${String(proc[f.info_key])}`).join("\n")
        }
        confirmText="戻す"
        danger
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          void run(() => trackballReset(id), `プロセッサ ${id} を既定に戻しました`, ["trackball"]);
        }}
      />
    </Panel>
  );
}
