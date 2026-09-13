import type { ReactNode } from "react";
import type { Unavailable } from "../types";

/** Shell every feature panel shares: heading, optional note, scroll container. */
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-h-0 min-w-0 space-y-3 overflow-y-auto p-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {note && <p className="text-xs text-zinc-500">{note}</p>}
      </header>
      {children}
    </section>
  );
}

/** What a tab shows when the keyboard does not ship that custom RPC subsystem. */
export function NotAvailable({ title, feature }: { title: string; feature: Unavailable }) {
  return (
    <Panel title={title}>
      <div className="rounded border border-amber-800/60 bg-amber-500/10 p-3 text-xs text-amber-200">
        <p className="font-medium">このキーボードではこの機能を使えません。</p>
        <p className="mt-1 font-mono break-all text-amber-300/80">{feature.error}</p>
      </div>
    </Panel>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  disabled,
  width = "w-24",
}: {
  label?: string;
  value: number;
  onChange(v: number): void;
  min?: number;
  disabled?: boolean;
  width?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${width} rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50`}
      />
    </label>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  kind = "ghost",
  title,
}: {
  children: ReactNode;
  onClick(): void;
  disabled?: boolean;
  kind?: "primary" | "ghost" | "danger";
  title?: string;
}) {
  const cls =
    kind === "primary"
      ? "bg-sky-600 text-white hover:bg-sky-500"
      : kind === "danger"
        ? "border border-red-800 bg-red-900/30 text-red-300 hover:bg-red-900/60"
        : "border border-zinc-700 text-zinc-200 hover:bg-zinc-800";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-40 ${cls}`}
    >
      {children}
    </button>
  );
}

export const TH = "px-2 py-1 text-left text-xs font-medium text-zinc-400";
export const TD = "px-2 py-1 align-middle text-sm";
