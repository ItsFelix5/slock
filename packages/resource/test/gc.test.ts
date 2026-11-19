import { describe, expect, test } from "bun:test";
import { createResourceHub } from "../src/hub";
import { createFakeClock, manualLoader } from "../src/testing";
import { harness } from "./harness";

describe("gc", () => {
  test("gc removes entries only when no subscriber remains", () => {
    const { cache, clock } = harness({ gcMs: 1_000 });
    cache.set("a", "v");
    const stop = cache.subscribe("a", () => {});
    clock.advance(10_000);
    expect(cache.read("a")).toBe("v");
    stop();
    clock.advance(999);
    expect(cache.read("a")).toBe("v");
    clock.advance(1);
    expect(cache.read("a")).toBeUndefined();
  });

  test("a new subscriber cancels a pending gc", () => {
    const { cache, clock } = harness({ gcMs: 1_000 });
    cache.set("a", "v");
    clock.advance(900);
    cache.subscribe("a", () => {});
    clock.advance(10_000);
    expect(cache.read("a")).toBe("v");
  });

  test("the gc timer restarts from the last unsubscribe", () => {
    const { cache, clock } = harness({ gcMs: 1_000 });
    cache.set("a", "v");
    const stop = cache.subscribe("a", () => {});
    clock.advance(5_000);
    stop();
    clock.advance(500);
    expect(cache.read("a")).toBe("v");
    clock.advance(500);
    expect(cache.read("a")).toBeUndefined();
  });

  test("an entry with a request in flight is not collected", async () => {
    const { cache, calls, clock } = harness({ gcMs: 1_000 });
    const waiting = cache.ensure("a");
    clock.advance(10_000);
    calls[0]?.resolve("v");
    expect(await waiting).toBe("v");
    expect(cache.read("a")).toBe("v");
  });

  test("evictInactive drops unsubscribed entries and keeps subscribed ones", () => {
    const { cache } = harness();
    cache.set("kept", "1");
    cache.set("gone", "2");
    cache.subscribe("kept", () => {});
    cache.evictInactive();
    expect(cache.read("kept")).toBe("1");
    expect(cache.read("gone")).toBeUndefined();
  });

  test("evictInactive keeps entries that are fetching", () => {
    const { cache } = harness();
    void cache.ensure("a");
    cache.evictInactive();
    expect(cache.state("a").status).toBe("loading");
  });

  test("remove and clear reset subscribed entries and delete the rest", () => {
    const { cache } = harness();
    cache.set("a", "1");
    cache.set("b", "2");
    const seen: string[] = [];
    cache.subscribe("a", (state) => seen.push(state.status));
    cache.remove("a");
    expect(seen).toEqual(["idle"]);
    cache.clear();
    expect(cache.read("b")).toBeUndefined();
  });

  test("a cleared entry rejects waiters instead of hanging them", async () => {
    const { cache } = harness();
    const waiting = cache.ensure("a");
    cache.clear();
    await expect(waiting).rejects.toThrow("resource cleared");
  });

  test("hub evictInactive and dispose reach every cache", () => {
    const clock = createFakeClock();
    const hub = createResourceHub(clock);
    const loader = manualLoader<string, string>();
    const a = hub.cache({ load: loader.load });
    const b = hub.cache({ load: loader.load });
    a.set("x", "1");
    b.set("y", "2");
    hub.evictInactive();
    expect(a.read("x")).toBeUndefined();
    expect(b.read("y")).toBeUndefined();
    a.set("x", "1");
    hub.dispose();
    expect(clock.pending()).toBe(0);
  });
});
