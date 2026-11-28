import { createPref, isRecord } from "@slock/core";
import { service } from "@slock/core/solid";
import { getCachedWorkspaceId } from "@slock/slack/client";
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

export function parseLike<T>(sample: T): (value: unknown) => T | undefined {
  const matches = isLike(sample);
  return (value) => (matches(value) ? value : undefined);
}

function isLike<T>(sample: T): (value: unknown) => value is T {
  if (sample === null) return (value): value is T => isPrimitive(value);
  if (Array.isArray(sample)) return (value): value is T => Array.isArray(value);
  if (typeof sample === "object") return (value): value is T => isRecord(value);
  return (value): value is T => typeof value === typeof sample;
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ["boolean", "number", "string"].includes(typeof value);
}
