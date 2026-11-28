import { service } from "@slock/core/solid";
import type {
  EnsureOptions,
  EntryState,
  FetchContext,
  Overlay,
  PersistOptions,
  ResourceCache,
  ResourceHub,
  RetryPolicy,
  SubscribeOptions,
} from "@slock/resource";
import {
  type CacheReader,
  createCacheReader,
  createCacheState,
  createCacheValue,
} from "@slock/resource/solid";
import type { Accessor } from "solid-js";
import { retryPolicy } from "../retryPolicy";

interface QueryPersistence<Arg, T> {
  isArg: (value: unknown) => value is Arg;
  isData: (value: unknown) => value is T;
  version: number;
}

export interface QueryDefinition<Arg, T> {
  gcMs?: number;
  retry?: RetryPolicy;
  load: (arg: Arg, context: FetchContext) => Promise<T>;
  maxAgeMs?: number | ((data: T) => number);
  name: string;
  persist?: QueryPersistence<Arg, T>;
  revalidates?: boolean;
}

export interface Query<Arg, T> {
  ensure(arg: Arg, options?: EnsureOptions): Promise<T>;
  entry(arg: Arg): EntryState<T>;
  invalidate(arg: Arg): void;
  invalidateAll(): void;
  invalidateWhere(match: (arg: Arg) => boolean): void;
  modify(arg: Arg, update: (current: T) => T): void;
  overlay(arg: Arg, apply: (data: T) => T): Overlay;
  patch(arg: Arg, update: (current: T | undefined) => T): void;
  peek(arg: Arg): T | undefined;
  read(arg: Arg): T | undefined;
  refresh(arg: Arg): Promise<T>;
  request<R>(load: (context: FetchContext) => Promise<R>): Promise<R | undefined>;
  remove(arg: Arg): void;
  restore(): Promise<void>;
  set(arg: Arg, data: T): void;
  state(arg: Accessor<Arg | undefined>, options?: SubscribeOptions): Accessor<EntryState<T>>;
  use(arg: Accessor<Arg | undefined>, options?: SubscribeOptions): Accessor<T | undefined>;
  values(): T[];
}

interface Bound<Arg, T> {
  cache: ResourceCache<Arg, T>;
  reader: CacheReader<Arg, T>;
}

const GC_MS = 120_000;

const query = service("query");

function persistOptions<Arg, T>(
  name: string,
  persist: QueryPersistence<Arg, T>,
): PersistOptions<Arg, T> {
  return {
    adapter: query.persist,
    migrate: (stored, fromVersion) =>
      fromVersion === persist.version && persist.isArg(stored.key) && persist.isData(stored.data)
        ? { data: stored.data, key: stored.key }
        : undefined,
    name,
    version: persist.version,
  };
}

export function defineQuery<Arg, T>(definition: QueryDefinition<Arg, T>): Query<Arg, T> {
  const bound = new WeakMap<ResourceHub, Bound<Arg, T>>();

  const bind = (): Bound<Arg, T> => {
    const { hub } = query;
    const existing = bound.get(hub);
    if (existing) return existing;
    const cache = hub.cache<Arg, T>({
      gcMs: definition.gcMs ?? GC_MS,
      load: definition.load,
      maxAgeMs: definition.maxAgeMs,
      name: definition.name,
      persist: definition.persist && persistOptions(definition.name, definition.persist),
      retry: definition.retry ?? retryPolicy,
      revalidates: definition.revalidates,
    });
    const created = { cache, reader: createCacheReader(cache) };
    bound.set(hub, created);
    if (definition.persist) void cache.restore().catch(() => {});
    return created;
  };

  return {
    ensure: (arg, options) => bind().cache.ensure(arg, options),
    entry: (arg) => bind().reader.entry(arg),
    invalidate: (arg) => bind().cache.invalidate(arg),
    invalidateAll: () => bind().cache.invalidateWhere(() => true),
    invalidateWhere: (match) => bind().cache.invalidateWhere(match),
    modify: (arg, update) => bind().cache.modify(arg, update),
    overlay: (arg, apply) => bind().cache.overlay(arg, apply),
    patch: (arg, update) => bind().cache.patch(arg, update),
    peek: (arg) => bind().reader.peek(arg),
    read: (arg) => bind().cache.read(arg),
    refresh: (arg) => bind().cache.refresh(arg),
    remove: (arg) => bind().cache.remove(arg),
    request: (load) => bind().cache.request(load),
    restore: () => bind().cache.restore(),
    set: (arg, data) => bind().cache.set(arg, data),
    state: (arg, options) => createCacheState(bind().cache, arg, options),
    use: (arg, options) => createCacheValue(bind().cache, arg, options),
    values: () => bind().reader.values(),
  };
}
