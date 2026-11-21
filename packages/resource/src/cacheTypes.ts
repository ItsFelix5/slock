import type { Cooldown } from "./cooldown";
import type { ResourceEnv } from "./delay";
import type { FetchContext } from "./fetchRun";
import type { PersistOptions } from "./persistence";
import type { RetryPolicy } from "./retry";
import type { EntryState, StateListener } from "./state";

export type Unsubscribe = () => void;
export type Undo = () => void;

export interface CacheOptions<K, T> {
  cooldown?: Cooldown;
  dedupeMs?: number;
  env: ResourceEnv;
  gcMs?: number;
  load: (key: K, context: FetchContext) => Promise<T>;
  maxAgeMs?: number;
  maxAutoFailures?: number;
  name?: string;
  persist?: PersistOptions<K, T>;
  retry?: RetryPolicy;
}

export interface EntryInfo<K, T> {
  dataAt: number;
  key: K;
  state: EntryState<T>;
  subscribers: number;
}

export interface EnsureOptions {
  maxAgeMs?: number;
}

export interface SubscribeOptions extends EnsureOptions {
  enabled?: boolean;
}

export interface ResourceCache<K, T> {
  clear(): void;
  dispose(): void;
  ensure(key: K, options?: EnsureOptions): Promise<T>;
  entries(): EntryInfo<K, T>[];
  evictInactive(): void;
  invalidate(key: K): void;
  invalidateWhere(match: (key: K) => boolean): void;
  onChange(listener: (key: K, state: EntryState<T>) => void): Unsubscribe;
  patch(key: K, update: (current: T | undefined) => T): Undo;
  read(key: K): T | undefined;
  refresh(key: K): Promise<T>;
  remove(key: K): void;
  restore(): Promise<void>;
  set(key: K, data: T): void;
  state(key: K): EntryState<T>;
  subscribe(key: K, listener: StateListener<T>, options?: SubscribeOptions): Unsubscribe;
}

export class ResourceCleared extends Error {
  constructor() {
    super("resource cleared before it loaded");
    this.name = "ResourceCleared";
  }
}
