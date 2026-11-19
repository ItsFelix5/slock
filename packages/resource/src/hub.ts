import { createResourceCache } from "./cache";
import type { CacheOptions, ResourceCache } from "./cacheTypes";
import { type Cooldown, createCooldown } from "./cooldown";
import type { ResourceEnv } from "./env";

type Lifecycle = Pick<
  ResourceCache<never, never>,
  "clear" | "dispose" | "evictInactive" | "restore"
>;

export interface ResourceHub {
  cache<K, T>(options: Omit<CacheOptions<K, T>, "env">): ResourceCache<K, T>;
  clear(): void;
  cooldown: Cooldown;
  dispose(): void;
  evictInactive(): void;
  restore(): Promise<void>;
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
    restore: async () => {
      await Promise.all([...members].map((member) => member.restore()));
    },
  };
}
