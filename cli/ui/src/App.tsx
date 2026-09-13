import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFeatures, getState, layerOp, resetDevice, snapshot } from "./api";
import ChangeLog from "./components/ChangeLog";
import ConfirmDialog from "./components/ConfirmDialog";
import Keyboard from "./components/Keyboard";
import KeyEditor from "./components/KeyEditor";
import LayerSidebar, { type RemovedLayer } from "./components/LayerSidebar";
import Toast from "./components/Toast";
import TopBar from "./components/TopBar";
import CondlayerPanel from "./panels/CondlayerPanel";
import HoldtapPanel from "./panels/HoldtapPanel";
import MacroPanel from "./panels/MacroPanel";
import type { Features, Layer, State, Tab } from "./types";

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("keymap");
  const [layerIdx, setLayerIdx] = useState(0);
  const [selPos, setSelPos] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);

  /** Layers present at first load, so layers that disappear can be offered for restore. */
  const initialLayers = useRef<Layer[] | null>(null);

  const refetch = useCallback(async () => {
    try {
      // Both documents come off the same serial line, so they are fetched in
      // series; /api/features is the slow one (~40 round trips on roBa).
      const s = await getState();
      if (initialLayers.current === null) initialLayers.current = s.keymap.layers;
      setState(s);
      setFeatures(await getFeatures());
      setVersion((v) => v + 1);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const removed: RemovedLayer[] = useMemo(() => {
    if (!state || !initialLayers.current) return [];
    const live = new Set(state.keymap.layers.map((l) => l.id));
    return initialLayers.current
      .filter((l) => !live.has(l.id))
      .map((l) => ({ id: l.id, name: l.name, index: l.index }));
  }, [state]);

  const locked = state?.device.lock_state === "LOCKED";

  /** Run one mutating call, surface its error, then reload the device state. */
  const run = useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
      if (locked) {
        setToast("デバイスが LOCKED です。&studio_unlock を押してください。");
        return;
      }
      setBusy(true);
      try {
        const r = await fn();
        setToast(r.ok ? okMsg : (r.error ?? "失敗しました"));
      } catch (e) {
        setToast(String(e));
      } finally {
        setBusy(false);
        await refetch();
      }
    },
    [locked, refetch],
  );

  if (error && !state) return <div className="p-8 text-red-300">接続できません: {error}</div>;
  if (!state) return <div className="p-8 text-zinc-400">roBa を読み込み中…</div>;

  const layer = state.keymap.layers[Math.min(layerIdx, state.keymap.layers.length - 1)];

  const doSnapshot = async () => {
    setBusy(true);
    try {
      const r = await snapshot();
      setToast(`保存: ${r.path} (${r.bytes} bytes)`);
      setVersion((v) => v + 1);
    } catch (e) {
      setToast(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid h-screen grid-rows-[auto_auto_1fr] bg-zinc-950 text-zinc-100">
      <TopBar
        state={state}
        busy={busy}
        logOpen={logOpen}
        tab={tab}
        onTab={setTab}
        onRefresh={() => void refetch()}
        onSnapshot={() => void doSnapshot()}
        onReset={() => setResetOpen(true)}
        onToggleLog={() => setLogOpen((v) => !v)}
      />
      {locked ? (
        <div className="bg-amber-500/20 px-4 py-2 text-sm text-amber-200">
          デバイスが LOCKED です。SETTING 層の &amp;studio_unlock を押して unlock してください。
        </div>
      ) : (
        <div />
      )}

      {tab === "keymap" ? (
        <div className="grid min-h-0 grid-cols-[220px_1fr_320px]">
          <LayerSidebar
            layers={state.keymap.layers}
            current={layer.index}
            onSelect={setLayerIdx}
            availableLayers={state.keymap.available_layers}
            maxNameLength={state.keymap.max_layer_name_length}
            disabled={!!locked || busy}
            removed={removed}
            onRename={(id, name) =>
              void run(() => layerOp("rename", { layer_id: id, name }), "名前を変更しました")
            }
            onMove={(start, dest) =>
              void run(() => layerOp("move", { start, dest }), "並び替えました")
            }
            onAdd={() => void run(() => layerOp("add", {}), "レイヤーを追加しました")}
            onRemove={(index) =>
              void run(() => layerOp("remove", { index }), "レイヤーを削除しました")
            }
            onRestore={(id, at) =>
              void run(() => layerOp("restore", { layer_id: id, at_index: at }), "復元しました")
            }
          />
          <Keyboard
            layout={state.layout}
            layer={layer}
            base={state.keymap.layers[0]}
            selected={selPos}
            onSelect={setSelPos}
          />
          {selPos !== null ? (
            <KeyEditor
              state={state}
              layer={layer}
              pos={selPos}
              disabled={!!locked || busy}
              onApplied={() => {
                setToast("適用しました");
                void refetch();
              }}
              onError={setToast}
            />
          ) : (
            <aside className="min-w-0 border-l border-zinc-800 p-4 text-sm text-zinc-400">
              キーをクリックすると編集できます
            </aside>
          )}
        </div>
      ) : (
        <FeaturePanel
          tab={tab}
          state={state}
          features={features}
          disabled={!!locked || busy}
          run={run}
        />
      )}

      <ConfirmDialog
        open={resetOpen}
        title="設定をリセットしますか?"
        body={
          "NVS に保存されたランタイム設定 (キー割り当て・レイヤー名・マクロ等) を\n" +
          "すべて devicetree の既定値に戻します。取り消せません。\n" +
          "実行前にキーマップのスナップショットを自動保存します。"
        }
        confirmText="リセット"
        danger
        requireTyped={String(state.keymap.layers.length)}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false);
          void run(async () => await resetDevice(), "リセットしました");
        }}
      />
      <ChangeLog open={logOpen} version={version} onClose={() => setLogOpen(false)} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

export interface PanelProps {
  state: State;
  features: Features;
  disabled: boolean;
  run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string): Promise<void>;
}

function FeaturePanel({
  tab,
  features,
  ...rest
}: { tab: Tab; features: Features | null } & Omit<PanelProps, "features">) {
  if (!features) return <div className="p-8 text-zinc-400">機能を読み込み中…</div>;
  const props: PanelProps = { features, ...rest };
  switch (tab) {
    case "macro":
      return <MacroPanel {...props} />;
    case "holdtap":
      return <HoldtapPanel {...props} />;
    case "condlayer":
      return <CondlayerPanel {...props} />;
    default:
      return (
        <div className="min-h-0 overflow-y-auto p-4 text-sm text-zinc-400">
          {tab} パネルは準備中です。
        </div>
      );
  }
}
