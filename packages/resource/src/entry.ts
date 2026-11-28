import type { TimerHandle } from "@slock/core/types";
import type { Deferred } from "./deferred";
import { share } from "./share";
import { type EntryState, IDLE, type StateListener } from "./state";

export interface Inflight {
  consumed: boolean;
  controller: AbortController;
}

interface Layer<T> {
  apply: (data: T) => T;
}

export interface Entry<K, T> {
  box: { value: T } | undefined;
  dataAt: number;
  error: { value: unknown } | undefined;
  failures: number;
  permanent: boolean;
  timer: TimerHandle | undefined;
  hash: string;
  idle: Deferred | undefined;
  inflight: Inflight | undefined;
  key: K;
  layers: Set<Layer<T>>;
  listeners: Set<StateListener<T>>;
  stale: boolean;
  state: EntryState<T>;
  view: { value: T } | undefined;
  waiters: number;
}

export function createEntry<K, T>(key: K, hash: string): Entry<K, T> {
  return {
    box: undefined,
    dataAt: 0,
    error: undefined,
    failures: 0,
    permanent: false,
    timer: undefined,
    hash,
    idle: undefined,
    inflight: undefined,
    key,
    layers: new Set(),
    listeners: new Set(),
    stale: false,
    state: IDLE,
    view: undefined,
    waiters: 0,
  };
}

function viewOf<K, T>({ box, layers, view }: Entry<K, T>): Entry<K, T>["view"] {
  if (!box || layers.size === 0) return box;
  let { value } = box;
  for (const layer of layers) value = layer.apply(value);
  return { value: view ? share(view.value, value) : value };
}

export function derive<K, T>(entry: Entry<K, T>): void {
  entry.view = viewOf(entry);
  entry.state = stateOf(entry);
}

function stateOf<K, T>(entry: Entry<K, T>): EntryState<T> {
  const { error, failures, inflight, stale, view } = entry;
  const refreshing = inflight !== undefined;
  if (view && error)
    return { data: view.value, error: error.value, failures, refreshing, stale, status: "error" };
  if (view)
    return { data: view.value, error: undefined, failures: 0, refreshing, stale, status: "ready" };
  if (error)
    return { data: undefined, error: error.value, failures, refreshing, stale, status: "error" };
  if (refreshing)
    return {
      data: undefined,
      error: undefined,
      failures,
      refreshing: true,
      stale,
      status: "loading",
    };
  return IDLE;
}

export function isInactive<K, T>({ inflight, layers, listeners }: Entry<K, T>): boolean {
  return listeners.size === 0 && layers.size === 0 && inflight === undefined;
}

export function isFresh<K, T>(entry: Entry<K, T>, now: number, maxAgeMs: number): boolean {
  return entry.box !== undefined && !entry.stale && now - entry.dataAt < maxAgeMs;
}
