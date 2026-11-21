import { createResourceCache } from "./cache";
import type { CacheOptions, ResourceCache } from "./cacheTypes";
import { type Cooldown, createCooldown } from "./cooldown";
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
  "clear" | "dispose" | "evictInactive" | "restore"
> & { inspect(): HubEntry[]; revalidate(): void };

export interface ResourceHub {
  cache<K, T>(options: Omit<CacheOptions<K, T>, "env">): ResourceCache<K, T>;
  clear(): void;
  cooldown: Cooldown;
  dispose(): void;
  evictInactive(): void;
  inspect(): HubEntry[];
  restore(): Promise<void>;
  revalidate(): void;
}

export function createResourceHub(
  env: ResourceEnv,
  options: { jitterMs?: number } = {},
): ResourceHub {
  const cooldown = createCooldown(env, options);
  const members = new Set<Lifecycle>();

  const each = (action: (member: Lifecycle) => void) => {
    for (const member of members) action(member);
  };

  return {
    cache: (cacheOptions) => {
      const cache = createResourceCache({ cooldown, ...cacheOptions, env });
      members.add({
        clear: cache.clear,
        dispose: cache.dispose,
        evictInactive: cache.evictInactive,
        inspect: () =>
          cache.entries().map((entry) => ({
            ...entry,
            cache: cacheOptions.name ?? "cache",
            invalidate: () => cache.invalidate(entry.key),
            refresh: async () => {
              await cache.refresh(entry.key);
            },
          })),
        revalidate: () => cache.invalidateWhere(() => true),
        restore: cache.restore,
      });
      return cache;
    },
    clear: () => each((member) => member.clear()),
    cooldown,
    dispose: () => {
      each((member) => member.dispose());
      members.clear();
    },
    evictInactive: () => each((member) => member.evictInactive()),
    inspect: () => [...members].flatMap((member) => member.inspect()),
    restore: async () => {
      await Promise.all([...members].map((member) => member.restore()));
    },
    revalidate: () => each((member) => member.revalidate()),
  };
}
