import { useEffect } from "react";
import type { FeatureKey, Features, Layer, LayerGroup, Selection, State } from "../types";
import { layerLabel } from "../types";
import ComboInspector from "./ComboInspector";
import EncoderInspector from "./EncoderInspector";
import KeyInspector from "./KeyInspector";

export interface InspectorProps {
  selection: Selection | null;
  state: State;
  features: Features | null;
  layer: Layer;
  /** UI-only layer groups: every layer list in here follows their order. */
  groups: LayerGroup[];
  disabled: boolean;
  run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
    parts?: FeatureKey[],
  ): Promise<void>;
  onClose(): void;
  onSelectLayer(index: number): void;
  onSelect(sel: Selection): void;
}

function title(sel: Selection, p: InspectorProps): string {
  switch (sel.kind) {
    case "key":
      return `pos ${sel.pos} · レイヤー ${p.layer.index} ${layerLabel(p.layer)}`;
    case "combo":
      return `コンボ ${sel.index}`;
    case "encoder":
      return `エンコーダ ${sel.sensor} · レイヤー ${p.layer.index} ${layerLabel(p.layer)}`;
  }
}

/** The right-hand panel: what is selected on the board, and how to change it. */
export default function Inspector(props: InspectorProps) {
  const { selection, onClose } = props;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  if (!selection) return null;
  return (
    <aside className="flex h-full w-[360px] min-w-0 animate-[slideIn_150ms_ease-out] flex-col border-l border-zinc-800 bg-zinc-950">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <h2 className="min-w-0 truncate text-sm font-semibold text-zinc-200">
          {title(selection, props)}
        </h2>
        <button
          onClick={onClose}
          title="閉じる (Esc)"
          className="ml-auto rounded px-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          ×
        </button>
      </header>
      <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto p-4">
        {selection.kind === "key" && <KeyInspector {...props} pos={selection.pos} />}
        {selection.kind === "combo" && <ComboInspector {...props} index={selection.index} />}
        {selection.kind === "encoder" && <EncoderInspector {...props} sensor={selection.sensor} />}
      </div>
    </aside>
  );
}
