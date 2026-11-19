import type { Deferred } from "./deferred";
import type { TimerHandle } from "./env";
import { type EntryState, IDLE, type StateListener } from "./state";

export interface Inflight {
  controller: AbortController;
}

export interface Entry<K, T> {
  box: { value: T } | undefined;
  dataAt: number;
  error: { value: unknown } | undefined;
  failures: number;
  gc: TimerHandle | undefined;
  hash: string;
  idle: Deferred | undefined;
  inflight: Inflight | undefined;
  key: K;
  listeners: Set<StateListener<T>>;
  stale: boolean;
  state: EntryState<T>;
}

export function createEntry<K, T>(key: K, hash: string): Entry<K, T> {
  return {
    box: undefined,
    dataAt: 0,
    error: undefined,
    failures: 0,
    gc: undefined,
    hash,
    idle: undefined,
    inflight: undefined,
    key,
    listeners: new Set(),
    stale: false,
    state: IDLE,
  };
}

export function deriveState<K, T>(entry: Entry<K, T>): EntryState<T> {
  const { box, error, failures, inflight, stale } = entry;
  const refreshing = inflight !== undefined;
  if (box && error)
    return { data: box.value, error: error.value, failures, refreshing, stale, status: "error" };
  if (box)
    return { data: box.value, error: undefined, failures: 0, refreshing, stale, status: "ready" };
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

export function isFresh<K, T>(entry: Entry<K, T>, now: number, maxAgeMs: number): boolean {
  return entry.box !== undefined && !entry.stale && now - entry.dataAt < maxAgeMs;
}
