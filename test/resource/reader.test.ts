import { describe, expect, test } from "bun:test";
import { createEffect, createRoot, flush } from "solid-js";
import { createCacheReader } from "../../packages/resource/src/solid";
import { harness } from "./harness";

const settle = async (flushMicrotasks: () => Promise<void>) => {
  await flushMicrotasks();
  flush();
  await flushMicrotasks();
  flush();
};

describe("createCacheReader", () => {
  test("peek triggers one fetch and is reactive to later writes", async () => {
    const { cache, calls, flush: tick } = harness();
    const reader = createCacheReader(cache);
    const seen: (string | undefined)[] = [];
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.peek("a"),
        (value) => void seen.push(value),
      );
      createEffect(
        () => reader.peek("a"),
        () => {},
      );
      return stop;
    });
    await settle(tick);
    expect(calls).toHaveLength(1);
    calls[0]?.resolve("one");
    await settle(tick);
    cache.set("a", "two");
    await settle(tick);
    expect(seen).toEqual([undefined, "one", "two"]);
    dispose();
  });

  test("a later read reloads an expired value", async () => {
    const { cache, calls, clock, flush: tick } = harness({ maxAgeMs: 1_000 });
    cache.set("a", "base");
    const reader = createCacheReader(cache);
    expect(reader.peek("a")).toBe("base");
    await settle(tick);
    expect(calls).toHaveLength(0);
    clock.advance(5_000);
    expect(reader.peek("a")).toBe("base");
    await settle(tick);
    expect(calls).toHaveLength(1);
  });

  test("a value with no lifetime is not reloaded by reading it", async () => {
    const { cache, calls, flush: tick } = harness({ maxAgeMs: 0 });
    cache.set("a", "base");
    createCacheReader(cache).peek("a");
    await settle(tick);
    expect(calls).toHaveLength(0);
  });

  test("discarding an overlay notifies readers", async () => {
    const { cache, flush: tick } = harness();
    cache.set("a", "base");
    const reader = createCacheReader(cache);
    const seen: (string | undefined)[] = [];
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.peek("a"),
        (value) => void seen.push(value),
      );
      return stop;
    });
    await settle(tick);
    const layer = cache.overlay("a", () => "patched");
    await settle(tick);
    layer.discard();
    await settle(tick);
    expect(seen).toEqual(["base", "patched", "base"]);
    dispose();
  });

  test("an entry outlives gc while a computation reads it and expires after", async () => {
    const { cache, clock, flush: tick } = harness({ gcMs: 1000 });
    cache.set("a", "base");
    const reader = createCacheReader(cache);
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.peek("a"),
        () => {},
      );
      return stop;
    });
    await settle(tick);
    clock.advance(5000);
    expect(cache.read("a")).toBe("base");
    dispose();
    await settle(tick);
    clock.advance(1000);
    expect(cache.read("a")).toBeUndefined();
  });

  test("values lists every cached value and follows changes", async () => {
    const { cache, flush: tick } = harness();
    const reader = createCacheReader(cache);
    const seen: string[] = [];
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.values().join(),
        (value) => void seen.push(value),
      );
      return stop;
    });
    cache.set("a", "1");
    await settle(tick);
    cache.set("b", "2");
    await settle(tick);
    expect(seen.at(-1)).toBe("1,2");
    dispose();
  });

  test("a failed entry a reader has read still expires so it can retry", async () => {
    const { cache, calls, clock, flush: tick } = harness({ gcMs: 1000, retry: { retries: 0 } });
    const reader = createCacheReader(cache);
    reader.peek("a");
    await settle(tick);
    calls[0]?.reject(new Error("down"));
    await settle(tick);
    expect(reader.entry("a").status).toBe("error");
    clock.advance(1000);
    expect(cache.state("a").status).toBe("idle");
  });

  test("a reader reloads an invalidated entry it is showing", async () => {
    const { cache, calls, flush: tick } = harness();
    cache.set("a", "base");
    const reader = createCacheReader(cache);
    const seen: (string | undefined)[] = [];
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.peek("a"),
        (value) => void seen.push(value),
      );
      return stop;
    });
    await settle(tick);
    cache.invalidate("a");
    await settle(tick);
    await settle(tick);
    calls[0]?.resolve("server");
    await settle(tick);
    expect(seen.at(-1)).toBe("server");
    expect(calls).toHaveLength(1);
    dispose();
  });

  test("a computation can start a fetch that readers are watching", async () => {
    const { cache, calls, flush: tick } = harness();
    const reader = createCacheReader(cache);
    const results: string[] = [];
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.peek("a"),
        () => {},
      );
      createEffect(
        () => reader.values(),
        () => {},
      );
      return stop;
    });
    await settle(tick);
    cache.invalidate("a");
    const second = createRoot((stop) => {
      createEffect(
        () => cache.ensure("b"),
        (value) => void results.push(value),
      );
      return stop;
    });
    await settle(tick);
    for (const call of calls) call.resolve(call.key);
    await settle(tick);
    expect(results).toEqual(["b"]);
    dispose();
    second();
  });

  test("ensure can be disabled", async () => {
    const { cache, calls, flush: tick } = harness();
    const reader = createCacheReader(cache, { ensure: false });
    const dispose = createRoot((stop) => {
      createEffect(
        () => reader.peek("a"),
        () => {},
      );
      return stop;
    });
    await settle(tick);
    expect(calls).toHaveLength(0);
    dispose();
  });
});
