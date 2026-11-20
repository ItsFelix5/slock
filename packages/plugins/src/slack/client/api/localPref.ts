import { createPref, parseLike } from "@slock/core";
import { service } from "@slock/core/solid";
import { getCachedWorkspaceId } from "@slock/slack";
import { createSignal, getOwner, onCleanup } from "solid-js";

const env = service("env");

function scopedKey(key: string): string {
  return `slock:${getCachedWorkspaceId() ?? "default"}:${key}`;
}

export function createLocalPref<T>(
  key: string,
  fallback: T,
  parse: (value: unknown) => T | undefined = parseLike(fallback),
) {
  const storageKey = scopedKey(key);
  const pref = createPref(env.storage, { fallback, key: storageKey, parse });
  const [value, setValue] = createSignal(() => pref.get());
  if (getOwner()) onCleanup(pref.onRemoteChange((next) => setValue(() => next)));
  function persist(next: T): void {
    setValue(() => next);
    if (!pref.set(next)) console.error(`Failed to save ${key} locally`);
  }
  return [value, persist] as const;
}
