import { describe, expect, test } from "bun:test";
import { BatchMissingId, createBatchLoader } from "../src/batchLoader";
import { deferred } from "../src/deferred";
import { createFakeClock, settleMicrotasks } from "../src/testing";

function setup(options: { delayMs?: number; maxBatch?: number } = {}) {
  const clock = createFakeClock();
  const batches: string[][] = [];
  const loader = createBatchLoader<string>({
    env: clock,
    load: (ids) => {
      batches.push(ids);
      return Promise.resolve(new Map(ids.map((id) => [id, id.toUpperCase()])));
    },
    ...options,
  });
  return { batches, clock, loader };
}

describe("batch loader", () => {
  test("gets in the same tick coalesce into one load", async () => {
    const { batches, loader } = setup();
    const values = await Promise.all(["a", "b", "c"].map((id) => loader.get(id)));
    expect(values).toEqual(["A", "B", "C"]);
    expect(batches).toEqual([["a", "b", "c"]]);
  });

  test("the same id requested twice loads once and both callers get the value", async () => {
    const { batches, loader } = setup();
    const [first, second] = await Promise.all([loader.get("a"), loader.get("a")]);
    expect(first).toBe("A");
    expect(second).toBe("A");
    expect(batches).toEqual([["a"]]);
  });

  test("an id already loading joins the running request", async () => {
    const gate = deferred<Map<string, string>>();
    const batches: string[][] = [];
    const loader = createBatchLoader<string>({
      env: createFakeClock(),
      load: (ids) => {
        batches.push(ids);
        return gate.promise;
      },
    });
    const first = loader.get("a");
    await settleMicrotasks();
    const second = loader.get("a");
    gate.resolve(new Map([["a", "A"]]));
    expect(await Promise.all([first, second])).toEqual(["A", "A"]);
    expect(batches).toHaveLength(1);
  });

  test("maxBatch splits a tick into several loads", async () => {
    const { batches, loader } = setup({ maxBatch: 2 });
    await Promise.all(["a", "b", "c", "d", "e"].map((id) => loader.get(id)));
    expect(batches).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  test("delayMs waits for the timer and collects everything requested meanwhile", async () => {
    const { batches, clock, loader } = setup({ delayMs: 50 });
    const first = loader.get("a");
    clock.advance(49);
    const second = loader.get("b");
    await settleMicrotasks();
    expect(batches).toHaveLength(0);
    clock.advance(1);
    expect(await Promise.all([first, second])).toEqual(["A", "B"]);
    expect(batches).toEqual([["a", "b"]]);
  });

  test("a load failure rejects every caller of that batch only", async () => {
    const clock = createFakeClock();
    const loader = createBatchLoader<string>({
      env: clock,
      load: (ids) =>
        ids.includes("bad") ? Promise.reject(new Error("down")) : Promise.resolve({ ok: "fine" }),
      maxBatch: 1,
    });
    const bad = loader.get("bad").catch((error: unknown) => error);
    const good = loader.get("ok");
    expect(await bad).toEqual(new Error("down"));
    expect(await good).toBe("fine");
  });

  test("an id missing from the result rejects instead of hanging", async () => {
    const loader = createBatchLoader<string>({
      env: createFakeClock(),
      load: () => Promise.resolve({}),
    });
    await expect(loader.get("a")).rejects.toBeInstanceOf(BatchMissingId);
  });

  test("a record result works like a map", async () => {
    const loader = createBatchLoader<number>({
      env: createFakeClock(),
      load: (ids) => Promise.resolve(Object.fromEntries(ids.map((id) => [id, id.length]))),
    });
    expect(await loader.get("abc")).toBe(3);
  });

  test("an id can be fetched again after it settled", async () => {
    const { batches, loader } = setup();
    await loader.get("a");
    await loader.get("a");
    expect(batches).toEqual([["a"], ["a"]]);
  });
});
