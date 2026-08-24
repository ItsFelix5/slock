import { getCachedWorkspaceId } from "@slock/types";
import { createSignal } from "solid-js";

function scopedKey(key: string): string {
  return `slock:${getCachedWorkspaceId() ?? "default"}:${key}`;
}

export function createLocalPref<T>(key: string, fallback: T) {
  const storageKey = scopedKey(key);
  const read = (): T => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw == null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  };
  const [value, setValue] = createSignal<T>(read());
  function persist(next: T): void {
    setValue(() => next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (err) {
      console.error(`Failed to save ${key} locally`, err);
    }
  }
  return [value, persist] as const;
}
