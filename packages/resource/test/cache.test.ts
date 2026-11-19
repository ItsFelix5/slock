import { describe, expect, test } from "bun:test";
import { harness } from "./harness";

describe("sharing and state", () => {
  test("two subscribers share one in-flight request", async () => {
    const { cache, calls, flush } = harness();
    cache.subscribe("a", () => {});
    cache.subscribe("a", () => {});
    const waiting = cache.ensure("a");
    expect(calls).toHaveLength(1);
    calls[0]?.resolve("v");
    await flush();
    expect(await waiting).toBe("v");
  });

  test("state walks idle, loading, ready, then ready with refreshing while refetching", async () => {
    const { cache, calls, flush } = harness();
    expect(cache.state("a").status).toBe("idle");
    const states: string[] = [];
    cache.subscribe("a", (state) => states.push(`${state.status}:${state.refreshing}`));
    expect(cache.state("a").status).toBe("loading");
    calls[0]?.resolve("one");
    await flush();
    void cache.refresh("a");
    expect(cache.state("a")).toMatchObject({ data: "one", refreshing: true, status: "ready" });
    calls[1]?.resolve("two");
    await flush();
    expect(states).toEqual(["loading:true", "ready:false", "ready:true", "ready:false"]);
    expect(cache.read("a")).toBe("two");
  });

  test("a failed fetch is an error state and keeps the previous data", async () => {
    const { cache, calls, flush } = harness({ retry: { retries: 0 } });
    cache.set("a", "kept");
    const failed = cache.refresh("a").catch((error: unknown) => error);
    calls[0]?.reject(new Error("boom"));
    await flush();
    expect(cache.state("a")).toMatchObject({ data: "kept", failures: 1, status: "error" });
    expect(await failed).toEqual(new Error("boom"));
  });

  test("an invalidated entry is stale until a fetch succeeds", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "v");
    cache.invalidate("a");
    expect(cache.state("a")).toMatchObject({ refreshing: false, stale: true });
    expect(calls).toHaveLength(0);
    const waiting = cache.ensure("a");
    calls[0]?.resolve("fresh");
    await flush();
    expect(await waiting).toBe("fresh");
    expect(cache.state("a").stale).toBe(false);
  });

  test("invalidate refetches immediately only when someone is subscribed", () => {
    const { cache, calls } = harness();
    cache.set("a", "v");
    cache.set("b", "v");
    cache.subscribe("a", () => {});
    cache.invalidate("a");
    cache.invalidate("b");
    expect(calls.map((call) => call.key)).toEqual(["a"]);
  });

  test("invalidateWhere marks every matching entry", () => {
    const { cache, calls } = harness();
    for (const key of ["x:1", "x:2", "y:1"]) {
      cache.set(key, "v");
      cache.subscribe(key, () => {});
    }
    cache.invalidateWhere((key) => key.startsWith("x:"));
    expect(calls.map((call) => call.key)).toEqual(["x:1", "x:2"]);
  });
});

describe("freshness", () => {
  test("ensure returns fresh data without fetching", async () => {
    const { cache, calls } = harness();
    cache.set("a", "v");
    expect(await cache.ensure("a")).toBe("v");
    expect(calls).toHaveLength(0);
  });

  test("maxAgeMs refetches only once the data is older", async () => {
    const { cache, calls, clock, flush } = harness();
    cache.set("a", "v");
    void cache.ensure("a", { maxAgeMs: 5_000 });
    expect(calls).toHaveLength(0);
    clock.advance(5_000);
    const waiting = cache.ensure("a", { maxAgeMs: 5_000 });
    expect(calls).toHaveLength(1);
    calls[0]?.resolve("w");
    await flush();
    expect(await waiting).toBe("w");
  });

  test("dedupeMs makes a zero maxAge reuse a result that just completed", async () => {
    const { cache, calls, clock } = harness({ dedupeMs: 1_000 });
    cache.set("a", "v");
    await cache.ensure("a", { maxAgeMs: 0 });
    expect(calls).toHaveLength(0);
    clock.advance(1_000);
    void cache.ensure("a", { maxAgeMs: 0 });
    expect(calls).toHaveLength(1);
  });

  test("dedupeMs never hides an invalidation", () => {
    const { cache, calls } = harness({ dedupeMs: 60_000 });
    cache.set("a", "v");
    cache.invalidate("a");
    void cache.ensure("a");
    expect(calls).toHaveLength(1);
  });
});

describe("subscribe", () => {
  test("a disabled subscription never fetches", () => {
    const { cache, calls } = harness();
    cache.subscribe("a", () => {}, { enabled: false });
    expect(calls).toHaveLength(0);
  });

  test("subscribing to cached fresh data does not fetch", () => {
    const { cache, calls } = harness();
    cache.set("a", "v");
    cache.subscribe("a", () => {});
    expect(calls).toHaveLength(0);
  });

  test("a subscriber stops hearing after unsubscribe", async () => {
    const { cache, calls, flush } = harness();
    const seen: string[] = [];
    const stop = cache.subscribe("a", (state) => seen.push(state.status));
    stop();
    calls[0]?.resolve("v");
    await flush();
    expect(seen).toEqual(["loading"]);
  });

  test("auto fetch gives up after maxAutoFailures but ensure still fetches", async () => {
    const { cache, calls, flush } = harness({ maxAutoFailures: 1, retry: { retries: 0 } });
    cache.subscribe("a", () => {})();
    calls[0]?.reject(new Error("x"));
    await flush();
    cache.subscribe("a", () => {});
    expect(calls).toHaveLength(1);
    void cache.ensure("a").catch(() => {});
    expect(calls).toHaveLength(2);
  });

  test("read never fetches", () => {
    const { cache, calls } = harness();
    expect(cache.read("a")).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  test("onChange hears every key", () => {
    const { cache } = harness();
    const keys: string[] = [];
    cache.onChange((key) => keys.push(key));
    cache.set("a", "1");
    cache.set("b", "2");
    expect(keys).toEqual(["a", "b"]);
  });
});
