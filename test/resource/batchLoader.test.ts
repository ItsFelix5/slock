import { describe, expect, test } from "bun:test";
import { BatchMissingId, createBatchLoader } from "../../packages/resource/src/batchLoader";
import { deferred } from "../../packages/resource/src/deferred";
import { settleMicrotasks } from "../support/resource";

function setup(maxBatch = 100) {
  const batches: string[][] = [];
  const get = createBatchLoader<string>({
    load: (ids) => {
      batches.push(ids);
      return Promise.resolve(new Map(ids.map((id) => [id, id.toUpperCase()])));
    },
    maxBatch,
  });
  return { batches, get };
}

describe("batch loader", () => {
  test("gets in the same tick coalesce into one load", async () => {
    const { batches, get } = setup();
    const values = await Promise.all(["a", "b", "c"].map(get));
    expect(values).toEqual(["A", "B", "C"]);
    expect(batches).toEqual([["a", "b", "c"]]);
  });

  test("the same id requested twice loads once and both callers get the value", async () => {
    const { batches, get } = setup();
    expect(await Promise.all([get("a"), get("a")])).toEqual(["A", "A"]);
    expect(batches).toEqual([["a"]]);
  });

  test("an id asked for after its batch left gets a new request", async () => {
    const gates = [deferred<Map<string, string>>(), deferred<Map<string, string>>()];
    let calls = 0;
    const get = createBatchLoader<string>({
      load: () => gates[calls++]?.promise ?? Promise.reject(new Error("extra load")),
      maxBatch: 100,
    });
    const first = get("a");
    await settleMicrotasks();
    const second = get("a");
    await settleMicrotasks();
    gates[1]?.resolve(new Map([["a", "new"]]));
    gates[0]?.resolve(new Map([["a", "old"]]));
    expect(await Promise.all([first, second])).toEqual(["old", "new"]);
  });

  test("maxBatch splits a tick into several loads", async () => {
    const { batches, get } = setup(2);
    await Promise.all(["a", "b", "c", "d", "e"].map(get));
    expect(batches).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  test("a load failure rejects every caller of that batch only", async () => {
    const get = createBatchLoader<string>({
      load: (ids) =>
        ids.includes("bad")
          ? Promise.reject(new Error("down"))
          : Promise.resolve(new Map([["ok", "fine"]])),
      maxBatch: 1,
    });
    const bad = get("bad").catch((error: unknown) => error);
    const good = get("ok");
    expect(await bad).toEqual(new Error("down"));
    expect(await good).toBe("fine");
  });

  test("an id missing from the result rejects instead of hanging", async () => {
    const get = createBatchLoader<string>({
      load: () => Promise.resolve(new Map()),
      maxBatch: 100,
    });
    await expect(get("a")).rejects.toBeInstanceOf(BatchMissingId);
  });
});
