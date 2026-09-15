import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { layerActivators, type Activator } from "./activators";
import {
  getFeatures,
  getState,
  getUiMeta,
  layerOp,
  openEvents,
  putUiMeta,
  resetDevice,
  snapshot,
} from "./api";
import { activeCombos, labelText } from "./board";
import {
  followIndex,
  initial as initialPractice,
  reduce as reducePractice,
  reverseKeycodes,
  type PracticeCtx,
  type PracticeState,
} from "./practice";
import { decorFor } from "./decor";
import ChangeLog from "./components/ChangeLog";
import ComboList from "./components/ComboList";
import ConfirmDialog from "./components/ConfirmDialog";
import Inspector from "./components/Inspector";
import Keyboard from "./components/Keyboard";
import LayerChips, { type RemovedLayer } from "./components/LayerChips";
import LayerEntry from "./components/LayerEntry";
import PracticeStrip from "./components/PracticeStrip";
import Rail from "./components/Rail";
import Toast from "./components/Toast";
import TopBar from "./components/TopBar";
import CondlayerPanel from "./panels/CondlayerPanel";
import MacroPanel from "./panels/MacroPanel";
import TrackballPanel from "./panels/TrackballPanel";
import type { FeatureKey, Features, Layer, LayerGroup, Selection, State, Tab, UiMeta } from "./types";

const SHOW_COMBOS_KEY = "zmkrt.showCombos";
const ENTRY_HIDDEN_KEY = "zmkrt.layerEntryHidden";

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
  /** The "how do I get here" banner above the board, dismissible for good. */
  const [entryHidden, setEntryHidden] = useState(
    () => localStorage.getItem(ENTRY_HIDDEN_KEY) === "1",
  );
  /** UI-only layer groups; null until /api/ui-meta answers. */
  const [meta, setMeta] = useState<UiMeta | null>(null);
  /** 練習モード: null when off, the live board state when on. */
  const [practice, setPractice] = useState<PracticeState | null>(null);
  /** Closes the EventSource. Kept in a ref so the toggle and the unmount
   *  cleanup can both reach the *current* stream. */
  const stopEvents = useRef<(() => void) | null>(null);

  useEffect(() => {
    localStorage.setItem(SHOW_COMBOS_KEY, showCombos ? "1" : "0");
  }, [showCombos]);

  useEffect(() => {
    localStorage.setItem(ENTRY_HIDDEN_KEY, entryHidden ? "1" : "0");
  }, [entryHidden]);

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

  /** Groups live in .zmkrt-ui.json, not on the device, so they are fetched on
   *  their own — and refetched after a layer op, which is the only thing that
   *  can change which layer ids exist. */
  const refetchMeta = useCallback(async () => {
    try {
      setMeta(await getUiMeta());
    } catch {
      setMeta({ version: 1, groups: [] });
    }
  }, []);

  useEffect(() => {
    void refetch();
    void refetchMeta();
  }, [refetch, refetchMeta]);

  const saveGroups = useCallback(async (groups: LayerGroup[]) => {
    try {
      setMeta(await putUiMeta({ groups }));
    } catch (e) {
      setToast(String(e));
    }
  }, []);

  const removed: RemovedLayer[] = useMemo(() => {
    if (!state || !initialLayers.current) return [];
    const live = new Set(state.keymap.layers.map((l) => l.id));
    return initialLayers.current
      .filter((l) => !live.has(l.id))
      .map((l) => ({ id: l.id, name: l.name, index: l.index }));
  }, [state]);

  /** How each layer is entered, for every layer at once: the board marks the
   *  current layer's keys, the banner spells them out and the layer card shows
   *  a one-character summary per row, and all three must agree. */
  const activators = useMemo(() => {
    const m = new Map<number, Activator[]>();
    if (!state) return m;
    const decor = decorFor(state.layout);
    for (const l of state.keymap.layers) {
      m.set(l.index, layerActivators(state, features, decor, l.index));
    }
    return m;
  }, [state, features]);

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

  /** A layer op can add or remove layer ids, so the groups are reread after it. */
  const runLayer = useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
      await run(fn, okMsg);
      await refetchMeta();
    },
    [run, refetchMeta],
  );

  /** The layers as of the last render, for the event callback (which is
   *  created once and must not close over a stale list). */
  const layersRef = useRef<Layer[]>([]);

  const stopPractice = useCallback(() => {
    stopEvents.current?.();
    stopEvents.current = null;
    setPractice(null);
  }, []);

  /** Everything the reducer needs to name a position, a keycode or a layer.
   *  Read off the state the board is already drawing, so the log says the same
   *  words the caps do. */
  const practiceCtx = useRef<PracticeCtx>({});

  const startPractice = useCallback(() => {
    setSelection(null); // the board wants the width
    setPractice(initialPractice());
    stopEvents.current = openEvents(
      (ev) => {
        setPractice((prev) => (prev ? reducePractice(prev, ev, practiceCtx.current) : prev));
        // The displayed layer follows the highest active one; a layer the user
        // picked by hand therefore holds only until the next layer change.
        if (ev.type === "layers") {
          setLayerIdx(followIndex({ highest: ev.highest } as PracticeState, layersRef.current));
        }
      },
      (message) => {
        setToast(message);
        stopPractice();
      },
    );
  }, [stopPractice]);

  useEffect(() => () => stopEvents.current?.(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      if (practice) stopPractice();
      else startPractice();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [practice, startPractice, stopPractice]);

  const changeTab = useCallback((t: Tab) => {
    setTab(t);
    if (t !== "keymap") setSelection(null);
  }, []);

  if (error && !state) return <div className="p-8 text-red-300">接続できません: {error}</div>;
  if (!state) return <div className="p-8 text-zinc-400">キーボードを読み込み中…</div>;

  const layer = state.keymap.layers[Math.min(layerIdx, state.keymap.layers.length - 1)];

  layersRef.current = state.keymap.layers;
  practiceCtx.current = {
    rev: reverseKeycodes(state.keycodes),
    layerNames: Object.fromEntries(state.keymap.layers.map((l) => [l.id, l.name || `L${l.index}`])),
    capLabels: Object.fromEntries(layer.bindings.map((b) => [b.pos, labelText(b.label)])),
  };
  const activeLayerIds = practice ? new Set(practice.activeIds) : undefined;

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
    <div className="grid h-screen grid-cols-[56px_minmax(0,1fr)_auto] overflow-hidden bg-zinc-950 text-zinc-100">
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

      <div className="grid min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
        <TopBar
          state={state}
          busy={busy}
          onRefresh={() => void refetch()}
          loadingFeatures={loadingFeatures}
          practice={practice !== null}
          onPractice={() => (practice ? stopPractice() : startPractice())}
        />
        {/* One grid row, however many banners: the row count is fixed. */}
        <div className="min-w-0 overflow-hidden">
          {locked && (
            <div className="bg-amber-500/20 px-4 py-2 text-sm text-amber-200">
              デバイスが LOCKED です。SETTING 層の &amp;studio_unlock を押して unlock してください。
            </div>
          )}
          {practice && (
            <PracticeStrip
              practice={practice}
              layers={state.keymap.layers}
              onChange={setPractice}
              onStop={stopPractice}
            />
          )}
        </div>

        {tab === "keymap" ? (
          <div className="grid min-h-0 grid-cols-[auto_minmax(0,1fr)]">
            {/* The layer card and the combo list share one column; both give
                the width back to the board while the inspector is open. */}
            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <LayerChips
                layers={state.keymap.layers}
                current={layer.index}
                onSelect={setLayerIdx}
                activeIds={activeLayerIds}
                availableLayers={state.keymap.available_layers}
                maxNameLength={state.keymap.max_layer_name_length}
                disabled={!!locked || busy}
                collapsed={selection !== null}
                removed={removed}
                onRename={(id, name) =>
                  void run(() => layerOp("rename", { layer_id: id, name }), "名前を変更しました")
                }
                onMove={(start, dest) =>
                  void runLayer(() => layerOp("move", { start, dest }), "並び替えました")
                }
                onAdd={() => void runLayer(() => layerOp("add", {}), "レイヤーを追加しました")}
                onRemove={(index) =>
                  void runLayer(() => layerOp("remove", { index }), "レイヤーを削除しました")
                }
                onRestore={(id, at) =>
                  void runLayer(
                    () => layerOp("restore", { layer_id: id, at_index: at }),
                    "復元しました",
                  )
                }
                groups={meta?.groups ?? []}
                suggested={meta?.suggested}
                onGroups={(g) => void saveGroups(g)}
                entryHidden={entryHidden}
                onShowEntry={() => setEntryHidden(false)}
                activators={activators}
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
                  showCombos={showCombos}
                  onToggleCombos={setShowCombos}
                />
              )}
            </div>
            <div className="flex min-h-0 flex-col">
              {!entryHidden && !practice && (
                <LayerEntry
                  layer={layer}
                  layers={state.keymap.layers}
                  base={state.keymap.layers[0]}
                  activators={activators.get(layer.index) ?? []}
                  pending={!features}
                  onGo={(index, pos) => {
                    setLayerIdx(index);
                    setSelection({ kind: "key", pos });
                  }}
                  onHide={() => setEntryHidden(true)}
                />
              )}
              <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
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
                  macros={features?.macros ?? null}
                  encoder={features?.encoder ?? null}
                  decor={decorFor(state.layout)}
                  activators={activators.get(layer.index) ?? []}
                  hoverCombo={hoverCombo}
                  onHoverCombo={setHoverCombo}
                  onTrackball={() => changeTab("trackball")}
                  pressed={practice?.pressed}
                />
              </div>
            </div>
          </div>
        ) : (
          <FeaturePanel
            tab={tab}
            state={state}
            features={features}
            groups={meta?.groups ?? []}
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
          groups={meta?.groups ?? []}
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
  groups: LayerGroup[];
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
