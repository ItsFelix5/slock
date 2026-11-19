import type { ResourceEnv, TimerHandle } from "./env";

export interface StoredEntry {
  at: number;
  data: unknown;
  key: unknown;
}

export interface StoredSnapshot {
  entries: StoredEntry[];
  version: number;
}

export interface PersistAdapter {
  load(name: string): Promise<StoredSnapshot | undefined>;
  save(name: string, snapshot: StoredSnapshot): Promise<void>;
}

export interface PersistOptions<K, T> {
  adapter: PersistAdapter;
  delayMs?: number;
  migrate: (stored: StoredEntry, fromVersion: number) => { data: T; key: K } | undefined;
  name: string;
  onError?: (error: unknown) => void;
  version: number;
}

export interface PersistHost<K, T> {
  env: ResourceEnv;
  hydrate: (key: K, data: T, at: number) => void;
  options: PersistOptions<K, T>;
  ready: () => Iterable<StoredEntry & { data: T; key: K }>;
}

export interface Persistence {
  restore(): Promise<void>;
  schedule(): void;
  stop(): void;
}

export function createMemoryAdapter(): PersistAdapter & { snapshots: Map<string, StoredSnapshot> } {
  const snapshots = new Map<string, StoredSnapshot>();
  return {
    load: (name) => Promise.resolve(structuredClone(snapshots.get(name))),
    save: (name, snapshot) => {
      snapshots.set(name, structuredClone(snapshot));
      return Promise.resolve();
    },
    snapshots,
  };
}

export function createPersistence<K, T>(host: PersistHost<K, T>): Persistence {
  const { adapter, delayMs = 1_000, name, onError, version } = host.options;
  let timer: TimerHandle | undefined;

  const flush = () => {
    timer = undefined;
    const entries = [...host.ready()];
    adapter.save(name, { entries, version }).catch((error) => onError?.(error));
  };

  return {
    restore: async () => {
      const snapshot = await adapter.load(name);
      if (!snapshot) return;
      for (const stored of snapshot.entries) {
        const parsed = host.options.migrate(stored, snapshot.version);
        if (parsed) host.hydrate(parsed.key, parsed.data, stored.at);
      }
    },
    schedule: () => {
      timer ??= host.env.setTimeout(flush, delayMs);
    },
    stop: () => {
      if (timer !== undefined) host.env.clearTimeout(timer);
      timer = undefined;
    },
  };
}
