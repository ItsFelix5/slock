import { createResourceCache } from "./cache";
import type { CacheOptions, ResourceCache } from "./cacheTypes";
import { createCooldown } from "./cooldown";
import type { ResourceEnv } from "./delay";
import type { EntryState } from "./state";

export interface HubEntry {
  cache: string;
  dataAt: number;
  invalidate(): void;
  key: unknown;
  refresh(): Promise<void>;
  state: EntryState<unknown>;
  subscribers: number;
}

type Lifecycle = Pick<
  ResourceCache<never, never>,
  "clear" | "dispose" | "evictInactive" | "flush" | "restore"
> & { inspect(): HubEntry[]; revalidate(): void };

export interface ResourceHub {
  cache<K, T>(options: HubCacheOptions<K, T>): ResourceCache<K, T>;
  clear(): void;
  dispose(): void;
  evictInactive(): void;
  flush(): void;
  inspect(): HubEntry[];
  onFlush(flush: () => void): () => void;
  restore(): Promise<void>;
  revalidate(): void;
}

type HubCacheOptions<K, T> = Omit<CacheOptions<K, T>, "env"> & {
  revalidates?: boolean;
};

export function createResourceHub(
  env: ResourceEnv,
  options: { jitterMs?: number } = {},
): ResourceHub {
  const members = new Set<Lifecycle>();
  const pendingWork = new Set<() => void>();

  const each = (action: (member: Lifecycle) => void) => {
    for (const member of members) action(member);
  };

  return {
    cache: ({ revalidates = true, ...cacheOptions }) => {
      const cooldown = createCooldown(env, options);
      const cache = createResourceCache({ cooldown, ...cacheOptions, env });
      members.add({
        clear: cache.clear,
        dispose: cache.dispose,
        evictInactive: cache.evictInactive,
        flush: cache.flush,
        inspect: () =>
          cache.entries().map((entry) => ({
            ...entry,
            cache: cacheOptions.name ?? "cache",
            invalidate: () => cache.invalidate(entry.key),
            refresh: async () => {
              await cache.refresh(entry.key);
            },
          })),
        revalidate: () => {
          if (revalidates) cache.invalidateWhere(() => true);
        },
        restore: cache.restore,
      });
      return cache;
    },
    clear: () => each((member) => member.clear()),
    dispose: () => {
      each((member) => member.dispose());
      members.clear();
      pendingWork.clear();
    },
    evictInactive: () => each((member) => member.evictInactive()),
    flush: () => {
      for (const flush of pendingWork) flush();
      each((member) => member.flush());
    },
    inspect: () => [...members].flatMap((member) => member.inspect()),
    onFlush: (flush) => {
      pendingWork.add(flush);
      return () => pendingWork.delete(flush);
    },
    restore: async () => {
      await Promise.all([...members].map((member) => member.restore()));
    },
    revalidate: () => each((member) => member.revalidate()),
  };
}
