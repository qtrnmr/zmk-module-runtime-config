import type { Binding, FeatureKey, Features, MacroStep, OpResult, State } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? r.statusText);
  return data as T;
}

export interface KeySetBody {
  layer_id: number;
  position: number;
  behavior_id: number;
  param1: number;
  param2: number;
}

export const getState = () => call<State>("GET", "/api/state");

export const setKey = (b: KeySetBody) =>
  call<{ ok: boolean; error?: string; binding?: Binding }>("POST", "/api/key", b);

export const layerOp = (
  op: "rename" | "add" | "remove" | "move" | "restore",
  body: object,
) => call<OpResult>("POST", `/api/layer/${op}`, body);

export const snapshot = () => call<{ path: string; bytes: number }>("POST", "/api/snapshot", {});

export const resetDevice = () => call<{ ok: boolean }>("POST", "/api/reset", {});

export const backupLog = (limit = 50) =>
  call<{ entries: Record<string, unknown>[] }>("GET", `/api/backup-log?limit=${limit}`);

// ---- feature panels -------------------------------------------------------

/** Without `only`, the whole document (cast to Features by the caller).
 *  With `only`, just those features — merged into the cached document. */
export const getFeatures = (only?: FeatureKey[]) =>
  call<Partial<Features>>(
    "GET",
    only?.length ? `/api/features?only=${only.join(",")}` : "/api/features",
  );

/** Parse the macro DSL server-side. Pure: touches no device. */
export const macroParse = (dsl: string, allow_unbalanced = false) =>
  call<{ ok: boolean; steps?: MacroStep[]; error?: string }>("POST", "/api/macro/parse", {
    dsl,
    allow_unbalanced,
  });

export const macroSet = (slot: number, steps: MacroStep[]) =>
  call<OpResult & { warning?: string | null }>("POST", "/api/macro", { slot, steps });

export const holdtapSet = (slot: number, field: string, value: number | string) =>
  call<OpResult>("POST", "/api/holdtap", { slot, field, value });

export const holdtapReset = (slot: number) => call<OpResult>("POST", "/api/holdtap/reset", { slot });

export const condlayerSet = (index: number, if_layers: number[], then_layer: number) =>
  call<OpResult>("POST", "/api/condlayer", { index, if_layers, then_layer });

export const condlayerReset = (index: number) =>
  call<OpResult>("POST", "/api/condlayer/reset", { index });

export interface ComboSetBody {
  index: number;
  field: "binding" | "timeout-ms" | "require-prior-idle-ms" | "layers" | "slow-release";
  value?: number | boolean | number[];
  binding?: { behavior_id: number; param1: number; param2: number };
}

export const comboSet = (body: ComboSetBody) => call<OpResult>("POST", "/api/combo", body);

export const comboReset = (index: number) => call<OpResult>("POST", "/api/combo/reset", { index });

export interface EncoderSetBody {
  sensor: number;
  layer: number;
  direction: "cw" | "ccw";
  behavior_id: number;
  param1: number;
  param2: number;
  tap_ms: number;
}

export const encoderSet = (body: EncoderSetBody) => call<OpResult>("POST", "/api/encoder", body);

export const encoderReset = (sensor: number, layer: number) =>
  call<OpResult>("POST", "/api/encoder/reset", { sensor, layer });

export const trackballSet = (id: number, field: string, value: number | boolean | string) =>
  call<OpResult>("POST", "/api/trackball", { id, field, value });

export const trackballReset = (id: number) =>
  call<OpResult>("POST", "/api/trackball/reset", { id });
