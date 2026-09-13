import { useCallback, useEffect, useState } from "react";
import { getState } from "./api";
import Keyboard from "./components/Keyboard";
import LayerSidebar from "./components/LayerSidebar";
import Toast from "./components/Toast";
import TopBar from "./components/TopBar";
import type { State } from "./types";

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layerIdx, setLayerIdx] = useState(0);
  const [selPos, setSelPos] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setState(await getState());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  if (error && !state) return <div className="p-8 text-red-300">接続できません: {error}</div>;
  if (!state) return <div className="p-8 text-zinc-400">roBa を読み込み中…</div>;

  const layer = state.keymap.layers[Math.min(layerIdx, state.keymap.layers.length - 1)];
  const locked = state.device.lock_state === "LOCKED";

  return (
    <div className="grid h-screen grid-rows-[auto_auto_1fr] bg-zinc-950 text-zinc-100">
      <TopBar state={state} onRefresh={refetch} />
      {locked ? (
        <div className="bg-amber-500/20 px-4 py-2 text-sm text-amber-200">
          デバイスが LOCKED です。SETTING 層の &amp;studio_unlock を押して unlock してください。
        </div>
      ) : (
        <div />
      )}
      <div className="grid min-h-0 grid-cols-[220px_1fr_320px]">
        <LayerSidebar layers={state.keymap.layers} current={layer.index} onSelect={setLayerIdx} />
        <Keyboard
          layout={state.layout}
          layer={layer}
          base={state.keymap.layers[0]}
          selected={selPos}
          onSelect={setSelPos}
        />
        <aside className="border-l border-zinc-800 p-4 text-sm text-zinc-400">
          キーをクリックすると編集できます
        </aside>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
