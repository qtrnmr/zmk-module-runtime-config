import type { Binding, OpResult, State } from "./types";

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
