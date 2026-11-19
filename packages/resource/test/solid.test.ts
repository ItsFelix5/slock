import { describe, expect, test } from "bun:test";
import { createEffect, createRoot, createSignal, flush, isPending } from "solid-js";
import { createCacheReader, createCacheState, createCacheValue } from "../src/solid";
import { harness } from "./harness";

const settle = async (flushMicrotasks: () => Promise<void>) => {
  await flushMicrotasks();
  flush();
  await flushMicrotasks();
  flush();
};

describe("createCacheState", () => {
  test("subscribes, fetches and publishes loading then ready", async () => {
    const { cache, calls, flush: tick } = harness();
    const seen: string[] = [];
    const dispose = createRoot((stop) => {
      const state = createCacheState(cache, () => "a");
      createEffect(
        () => state().status,
        (status) => void seen.push(status),
      );
      return stop;
    });
    await settle(tick);
    expect(calls).toHaveLength(1);
    calls[0]?.resolve("one");
    await settle(tick);
    expect(seen).toEqual(["idle", "loading", "ready"]);
    dispose();
  });

  test("moves the subscription when the key changes", async () => {
    const { cache, calls, flush: tick } = harness();
    const [key, setKey] = createSignal("a");
    let state: ReturnType<typeof createCacheState<string, string>> | undefined;
    const dispose = createRoot((stop) => {
      state = createCacheState(cache, key);
      createEffect(
        () => state?.().data,
        () => {},
      );
      return stop;
    });
    await settle(tick);
    calls[0]?.resolve("A");
    await settle(tick);
    expect(state?.().data).toBe("A");
    setKey("b");
    await settle(tick);
    expect(calls.map((call) => call.key)).toEqual(["a", "b"]);
    expect(state?.().status).toBe("loading");
    calls[1]?.resolve("B");
    await settle(tick);
    expect(state?.().data).toBe("B");
    dispose();
  });

  test("a disposed root releases its listener so gc can collect", async () => {
    const { cache, calls, clock, flush: tick } = harness({ gcMs: 1000 });
    const dispose = createRoot((stop) => {
      const state = createCacheState(cache, () => "a");
      createEffect(
        () => state().status,
        () => {},
      );
      return stop;
    });
    await settle(tick);
    calls[0]?.resolve("one");
    await settle(tick);
    dispose();
    clock.advance(1001);
    expect(cache.read("a")).toBeUndefined();
  });

  test("a stale invalidation refetches while mounted", async () => {
    const { cache, calls, flush: tick } = harness();
    const dispose = createRoot((stop) => {
      const state = createCacheState(cache, () => "a");
      createEffect(
        () => state().status,
        () => {},
      );
      return stop;
    });
    await settle(tick);
    calls[0]?.resolve("one");
    await settle(tick);
    cache.invalidate("a");
    await settle(tick);
    expect(calls).toHaveLength(2);
    calls[1]?.resolve("two");
    await settle(tick);
    expect(cache.read("a")).toBe("two");
    dispose();
  });
});

describe("createCacheValue", () => {
  test("suspends until data lands, then reads synchronously", async () => {
    const { cache, calls, flush: tick } = harness();
    const seen: (string | undefined)[] = [];
    let pending: (() => boolean) | undefined;
    const dispose = createRoot((stop) => {
      const value = createCacheValue(cache, () => "a");
      pending = () => isPending(value);
      createEffect(value, (current) => void seen.push(current));
      return stop;
    });
    await settle(tick);
    expect(seen).toEqual([]);
    calls[0]?.resolve("one");
    await settle(tick);
    expect(seen).toEqual(["one"]);
    cache.set("a", "two");
    await settle(tick);
    expect(seen).toEqual(["one", "two"]);
    expect(calls).toHaveLength(1);
    expect(pending?.()).toBe(false);
    dispose();
  });

  test("surfaces a failed load as an error", async () => {
    const { cache, calls, flush: tick } = harness({ retry: { retries: 0 } });
    const errors: unknown[] = [];
    const dispose = createRoot((stop) => {
      const value = createCacheValue(cache, () => "a");
      createEffect(value, {
        effect: () => {},
        error: (error) => void errors.push(error),
      });
      return stop;
    });
    await settle(tick);
    calls[0]?.reject(new Error("nope"));
    await settle(tick);
    expect(errors).toHaveLength(1);
    dispose();
  });

  test("returns stale data without suspending when a refetch is running", async () => {
    const { cache, calls, flush: tick } = harness();
    cache.set("a", "old");
    const seen: (string | undefined)[] = [];
    const dispose = createRoot((stop) => {
      const value = createCacheValue(cache, () => "a", { maxAgeMs: 0 });
      createEffect(value, (current) => void seen.push(current));
      return stop;
    });
    await settle(tick);
    expect(seen).toEqual(["old"]);
    expect(calls).toHaveLength(1);
    calls[0]?.resolve("new");
    await settle(tick);
    expect(seen).toEqual(["old", "new"]);
    dispose();
  });

  test("undefined key yields undefined without fetching", async () => {
    const { cache, calls, flush: tick } = harness();
    const [key, setKey] = createSignal<string | undefined>(undefined);
    const seen: (string | undefined)[] = [];
    const dispose = createRoot((stop) => {
      const value = createCacheValue(cache, key);
      createEffect(value, (current) => void seen.push(current));
      return stop;
    });
    await settle(tick);
    expect(calls).toHaveLength(0);
    setKey("a");
    await settle(tick);
    calls[0]?.resolve("one");
    await settle(tick);
    expect(seen).toEqual([undefined, "one"]);
    dispose();
  });
});

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

  test("undoing a patch notifies readers", async () => {
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
    const undo = cache.patch("a", () => "patched");
    await settle(tick);
    undo();
    await settle(tick);
    expect(seen).toEqual(["base", "patched", "base"]);
    dispose();
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
