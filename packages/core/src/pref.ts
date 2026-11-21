import type { Env } from "./types";
import { isRecord } from "./util/guards";

export type PrefCodec<T> = {
  encode(value: T): string;
  decode(raw: string): unknown;
};

export const jsonCodec: PrefCodec<unknown> = {
  decode: (raw) => JSON.parse(raw),
  encode: (value) => JSON.stringify(value),
};

export const textCodec: PrefCodec<string> = {
  decode: (raw) => raw,
  encode: (value) => value,
};

export type PrefSpec<T> = {
  key: string;
  fallback: T;
  parse(value: unknown): T | undefined;
  codec?: PrefCodec<T>;
};

export type Pref<T> = {
  get(): T;
  set(value: T): boolean;
  reset(): boolean;
  onRemoteChange(listener: (value: T) => void): () => void;
};

export function createPref<T>(storage: Env["storage"], spec: PrefSpec<T>): Pref<T> {
  const codec: PrefCodec<T> = spec.codec ?? jsonCodec;
  const listeners = new Set<(value: T) => void>();
  let stopListening: (() => void) | undefined;

  function read(): T {
    try {
      const raw = storage.get(spec.key);
      if (raw === null) return spec.fallback;
      const parsed = spec.parse(codec.decode(raw));
      return parsed === undefined ? spec.fallback : parsed;
    } catch {
      return spec.fallback;
    }
  }

  let current = read();

  function listen() {
    stopListening = storage.subscribe((key) => {
      if (key !== null && key !== spec.key) return;
      current = read();
      for (const listener of listeners) listener(current);
    });
  }

  return {
    get: () => current,
    onRemoteChange(listener) {
      listeners.add(listener);
      if (listeners.size === 1) listen();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stopListening?.();
        stopListening = undefined;
      };
    },
    reset() {
      current = spec.fallback;
      try {
        storage.remove(spec.key);
        return true;
      } catch {
        return false;
      }
    },
    set(value) {
      current = value;
      try {
        storage.set(spec.key, codec.encode(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export function parseString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function parseRecordOf<V>(
  parseValue: (value: unknown) => V | undefined,
): (value: unknown) => Record<string, V> | undefined {
  return (value) => {
    if (!isRecord(value)) return;
    const out: Record<string, V> = {};
    for (const [key, entry] of Object.entries(value)) {
      const parsed = parseValue(entry);
      if (parsed !== undefined) out[key] = parsed;
    }
    return out;
  };
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ["boolean", "number", "string"].includes(typeof value);
}

function isLike<T>(sample: T): (value: unknown) => value is T {
  if (sample === null) return (value): value is T => isPrimitive(value);
  if (Array.isArray(sample)) return (value): value is T => Array.isArray(value);
  if (typeof sample === "object") return (value): value is T => isRecord(value);
  return (value): value is T => typeof value === typeof sample;
}

export function parseLike<T>(sample: T): (value: unknown) => T | undefined {
  const matches = isLike(sample);
  return (value) => (matches(value) ? value : undefined);
}
