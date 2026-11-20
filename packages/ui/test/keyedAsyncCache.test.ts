import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { createKeyedAsyncCache } from "../src/keyedAsyncCache";

function remote() {
  const calls: string[] = [];
  const pending = new Map<string, PromiseWithResolvers<string>[]>();
  const fetcher = (key: string) => {
    calls.push(key);
    const deferred = Promise.withResolvers<string>();
    pending.set(key, [...(pending.get(key) ?? []), deferred]);
    return deferred.promise;
  };
  const answer = (key: string, value: string, index = 0) =>
    pending.get(key)?.[index]?.resolve(value);
  const fail = (key: string, error: Error) => pending.get(key)?.[0]?.reject(error);
  return { answer, calls, fail, fetcher };
}

function withCache<T>(
  fetcher: (key: string) => Promise<T>,
  onError?: (error: unknown, key: string) => void,
) {
  return createRoot(() => ({
    cache: createKeyedAsyncCache(fetcher, { onError }),
  }));
}

describe("createKeyedAsyncCache", () => {
  test("concurrent ensure calls share one fetch and one result", async () => {
    const api = remote();
    const { cache } = withCache(api.fetcher);
    const first = cache.ensure("a");
    const second = cache.ensure("a");
    flush();
    expect(cache.isLoading("a")).toBe(true);
    expect(cache.isKnown("a")).toBe(true);
    expect(cache.has("a")).toBe(false);
    api.answer("a", "one");
    expect(await first).toBe("one");
    expect(await second).toBe("one");
    flush();
    expect(api.calls).toEqual(["a"]);
    expect(cache.entry("a")).toBe("one");
    expect(cache.isLoading("a")).toBe(false);
  });

  test("ensure serves a cached value without fetching", async () => {
    const api = remote();
    const { cache } = withCache(api.fetcher);
    cache.set("a", "seeded");
    flush();
    expect(await cache.ensure("a")).toBe("seeded");
    expect(api.calls).toEqual([]);
  });

  test("a rejected fetch flags the error, reports it, and can be retried", async () => {
    const api = remote();
    const errors: [unknown, string][] = [];
    const { cache } = withCache(api.fetcher, (error, key) => errors.push([error, key]));
    const failure = new Error("ratelimited");
    const attempt = cache.ensure("a");
    api.fail("a", failure);
    expect(await attempt).toBeUndefined();
    flush();
    expect(errors).toEqual([[failure, "a"]]);
    expect(cache.hasError("a")).toBe(true);
    expect(cache.isKnown("a")).toBe(false);
    const retry = cache.ensure("a");
    flush();
    expect(cache.hasError("a")).toBe(false);
    api.answer("a", "fine", 1);
    expect(await retry).toBe("fine");
    expect(api.calls).toEqual(["a", "a"]);
  });

  test("refresh refetches a cached key and shares an in-flight fetch", async () => {
    const api = remote();
    const { cache } = withCache(api.fetcher);
    cache.set("a", "old");
    const first = cache.refresh("a");
    const second = cache.refresh("a");
    flush();
    expect(cache.entry("a")).toBe("old");
    api.answer("a", "new");
    await Promise.all([first, second]);
    flush();
    expect(cache.entry("a")).toBe("new");
    expect(api.calls).toEqual(["a"]);
  });

  test("invalidate drops the value and the error so the next ensure refetches", async () => {
    const api = remote();
    const { cache } = withCache(api.fetcher);
    cache.set("a", "old");
    flush();
    cache.invalidate("a");
    flush();
    expect(cache.has("a")).toBe(false);
    const next = cache.ensure("a");
    api.answer("a", "fresh");
    expect(await next).toBe("fresh");
  });

  test("a fetch started before invalidate cannot overwrite what follows", async () => {
    const api = remote();
    const { cache } = withCache(api.fetcher);
    const stale = cache.ensure("a");
    cache.invalidate("a");
    flush();
    expect(cache.isLoading("a")).toBe(false);
    const fresh = cache.ensure("a");
    api.answer("a", "fresh", 1);
    await fresh;
    api.answer("a", "stale", 0);
    await stale;
    flush();
    expect(cache.entry("a")).toBe("fresh");
    expect(cache.isLoading("a")).toBe(false);
  });

  test("update derives from the current value and keys stay independent", () => {
    const api = remote();
    const { cache } = withCache(api.fetcher);
    cache.update("a", (value) => `${value ?? "none"}+1`);
    cache.set("b", "other");
    flush();
    expect(cache.entry("a")).toBe("none+1");
    cache.invalidate("a");
    flush();
    expect(cache.entry("b")).toBe("other");
  });
});
