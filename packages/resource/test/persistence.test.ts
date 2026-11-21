import { describe, expect, test } from "bun:test";
import { createResourceCache } from "../src/cache";
import type { CacheOptions } from "../src/cacheTypes";
import { createMemoryAdapter } from "../src/persistence";
import { createFakeClock, manualLoader, settleMicrotasks } from "../src/testing";

function setup(version = 1, adapter = createMemoryAdapter()) {
  const clock = createFakeClock();
  const loader = manualLoader<string, number>();
  const persist: CacheOptions<string, number>["persist"] = {
    adapter,
    migrate: (stored, fromVersion) => {
      if (typeof stored.key !== "string" || typeof stored.data !== "number") return;
      return { data: fromVersion < version ? stored.data * 10 : stored.data, key: stored.key };
    },
    name: "account-1",
    version,
  };
  const cache = createResourceCache({ env: clock, load: loader.load, persist });
  return { adapter, cache, clock, loader };
}

describe("persistence", () => {
  test("a successful fetch is saved after the debounce delay, once", async () => {
    const { adapter, cache, clock, loader } = setup();
    const waiting = cache.ensure("a");
    loader.calls[0]?.resolve(1);
    await waiting;
    cache.set("b", 2);
    clock.advance(999);
    await settleMicrotasks();
    expect(adapter.snapshots.size).toBe(0);
    clock.advance(1);
    await settleMicrotasks();
    const saved = adapter.snapshots.get("account-1");
    expect(saved?.version).toBe(1);
    expect(saved?.entries.map(({ data, key }) => [key, data])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  test("restored entries are readable at once and stale so subscribers refetch", async () => {
    const adapter = createMemoryAdapter();
    const first = setup(1, adapter);
    first.cache.set("a", 7);
    first.clock.advance(1_000);
    await settleMicrotasks();

    const second = setup(1, adapter);
    await second.cache.restore();
    expect(second.cache.read("a")).toBe(7);
    expect(second.cache.state("a")).toMatchObject({ data: 7, stale: true, status: "ready" });
    second.cache.subscribe("a", () => {});
    expect(second.loader.calls).toHaveLength(1);
  });

  test("an older stored version goes through migrate", async () => {
    const adapter = createMemoryAdapter();
    const first = setup(1, adapter);
    first.cache.set("a", 7);
    first.clock.advance(1_000);
    await settleMicrotasks();

    const second = setup(2, adapter);
    await second.cache.restore();
    expect(second.cache.read("a")).toBe(70);
  });

  test("entries migrate rejects are dropped", async () => {
    const adapter = createMemoryAdapter();
    await adapter.save("account-1", { entries: [{ at: 0, data: "bad", key: "a" }], version: 1 });
    const { cache } = setup(1, adapter);
    await cache.restore();
    expect(cache.read("a")).toBeUndefined();
  });

  test("restoring never overwrites data that is already there", async () => {
    const adapter = createMemoryAdapter();
    await adapter.save("account-1", { entries: [{ at: 0, data: 1, key: "a" }], version: 1 });
    const { cache } = setup(1, adapter);
    cache.set("a", 99);
    await cache.restore();
    expect(cache.read("a")).toBe(99);
  });

  test("restoring does not schedule a write", async () => {
    const adapter = createMemoryAdapter();
    await adapter.save("account-1", { entries: [{ at: 0, data: 1, key: "a" }], version: 1 });
    const { cache, clock } = setup(1, adapter);
    await cache.restore();
    expect(clock.pendingTimers()).toBe(1);
  });

  test("a failing adapter reports to onError instead of rejecting unhandled", async () => {
    const clock = createFakeClock();
    const loader = manualLoader<string, number>();
    const errors: unknown[] = [];
    const cache = createResourceCache({
      env: clock,
      load: loader.load,
      persist: {
        adapter: {
          load: () => Promise.resolve(undefined),
          save: () => Promise.reject(new Error("disk")),
        },
        migrate: () => undefined,
        name: "x",
        onError: (error) => errors.push(error),
        version: 1,
      },
    });
    cache.set("a", 1);
    clock.advance(1_000);
    await settleMicrotasks();
    expect(errors).toEqual([new Error("disk")]);
  });
});
