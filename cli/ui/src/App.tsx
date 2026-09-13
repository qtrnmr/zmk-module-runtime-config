import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFeatures, getState, layerOp, resetDevice, snapshot } from "./api";
import { activeCombos } from "./board";
import { decorFor } from "./decor";
import ChangeLog from "./components/ChangeLog";
import ComboList from "./components/ComboList";
import ConfirmDialog from "./components/ConfirmDialog";
import Inspector from "./components/Inspector";
import Keyboard from "./components/Keyboard";
import LayerChips, { type RemovedLayer } from "./components/LayerChips";
import Rail from "./components/Rail";
import Toast from "./components/Toast";
import TopBar from "./components/TopBar";
import CondlayerPanel from "./panels/CondlayerPanel";
import MacroPanel from "./panels/MacroPanel";
import TrackballPanel from "./panels/TrackballPanel";
import type { FeatureKey, Features, Layer, Selection, State, Tab } from "./types";

const SHOW_COMBOS_KEY = "zmkrt.showCombos";

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("keymap");
  const [layerIdx, setLayerIdx] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  const [showCombos, setShowCombos] = useState(
    () => localStorage.getItem(SHOW_COMBOS_KEY) !== "0",
  );
  const [hoverCombo, setHoverCombo] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(SHOW_COMBOS_KEY, showCombos ? "1" : "0");
  }, [showCombos]);

  /** Layers present at first load, so layers that disappear can be offered for restore. */
  const initialLayers = useRef<Layer[] | null>(null);

  /** Reload the state, then the features. `parts` fetches only those features
   *  and merges them into the cached document — one mutation costs one or two
   *  RPC round trips instead of the ~40 a full /api/features takes. */
  const refetch = useCallback(async (parts?: FeatureKey[]) => {
    try {
      const s = await getState();
      if (initialLayers.current === null) initialLayers.current = s.keymap.layers;
      setState(s);
      setError(null);
      setLoadingFeatures(true);
      const f = await getFeatures(parts);
      setFeatures((prev) => (parts && prev ? { ...prev, ...f } : (f as Features)));
      setVersion((v) => v + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingFeatures(false);
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

  /** Run one mutating call, surface its error, then reload. */
  const run = useCallback(
    async (
      fn: () => Promise<{ ok: boolean; error?: string }>,
      okMsg: string,
      parts?: FeatureKey[],
    ) => {
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
        await refetch(parts);
      }
    },
    [locked, refetch],
  );

  const changeTab = useCallback((t: Tab) => {
    setTab(t);
    if (t !== "keymap") setSelection(null);
  }, []);

  if (error && !state) return <div className="p-8 text-red-300">接続できません: {error}</div>;
  if (!state) return <div className="p-8 text-zinc-400">キーボードを読み込み中…</div>;

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
    <div className="grid h-screen grid-cols-[56px_1fr_auto] bg-zinc-950 text-zinc-100">
      <Rail
        tab={tab}
        onTab={changeTab}
        onLog={() => setLogOpen(true)}
        onSnapshot={() => void doSnapshot()}
        onReset={() => setResetOpen(true)}
        onEncoder={
          features?.encoder.available && !decorFor(state.layout)?.encoders.length
            ? () => {
                setTab("keymap");
                setSelection({ kind: "encoder", sensor: features.encoder.available ? features.encoder.sensors[0]?.index ?? 0 : 0 });
              }
            : undefined
        }
        busy={busy}
      />

      <div className="grid min-w-0 grid-rows-[auto_auto_1fr]">
        <TopBar
          state={state}
          busy={busy}
          onRefresh={() => void refetch()}
          loadingFeatures={loadingFeatures}
        />
        {locked ? (
          <div className="bg-amber-500/20 px-4 py-2 text-sm text-amber-200">
            デバイスが LOCKED です。SETTING 層の &amp;studio_unlock を押して unlock してください。
          </div>
        ) : (
          <div />
        )}

        {tab === "keymap" ? (
          <div className="grid min-h-0 grid-cols-[auto_1fr]">
            {/* The layer card and the combo list share one column; both give
                the width back to the board while the inspector is open. */}
            <div className="flex min-h-0 flex-col">
              <LayerChips
                layers={state.keymap.layers}
                current={layer.index}
                onSelect={setLayerIdx}
                availableLayers={state.keymap.available_layers}
                maxNameLength={state.keymap.max_layer_name_length}
                disabled={!!locked || busy}
                collapsed={selection !== null}
                removed={removed}
                showCombos={showCombos}
                onToggleCombos={setShowCombos}
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
              {selection === null && (
                <ComboList
                  combos={features?.combos ?? null}
                  layers={state.keymap.layers}
                  base={state.keymap.layers[0]}
                  currentLayer={layer.index}
                  selected={null /* the card hides while the inspector is open */}
                  hover={hoverCombo}
                  onHover={setHoverCombo}
                  onSelect={setSelection}
                />
              )}
            </div>
            <div className="relative min-h-0">
              <Keyboard
                layout={state.layout}
                layer={layer}
                base={state.keymap.layers[0]}
                selection={selection}
                onSelect={setSelection}
                combos={
                  features?.combos.available
                    ? activeCombos(features.combos.entries, layer.index)
                    : []
                }
                showCombos={showCombos}
                behaviors={state.behaviors}
                keycodes={state.keycodes}
                layers={state.keymap.layers}
                encoder={features?.encoder ?? null}
                decor={decorFor(state.layout)}
                hoverCombo={hoverCombo}
                onHoverCombo={setHoverCombo}
                onTrackball={() => changeTab("trackball")}
              />
            </div>
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
      </div>

      {selection ? (
        <Inspector
          selection={selection}
          state={state}
          features={features}
          layer={layer}
          disabled={!!locked || busy}
          run={run}
          onClose={() => setSelection(null)}
          onSelectLayer={setLayerIdx}
          onSelect={setSelection}
        />
      ) : (
        <div />
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
  run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
    parts?: FeatureKey[],
  ): Promise<void>;
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
    case "condlayer":
      return <CondlayerPanel {...props} />;
    case "trackball":
      return <TrackballPanel {...props} />;
    default:
      return (
        <div className="min-h-0 overflow-y-auto p-4 text-sm text-zinc-400">
          {tab} パネルは準備中です。
        </div>
      );
  }
}
