import { describe, expect, test } from "bun:test";
import { createMutation, type MutationOptions } from "../../packages/resource/src/mutation";
import { forAll, int } from "../support/core";
import { settleMicrotasks } from "../support/resource";
import { harness } from "./harness";

type Cursor = { id: string; version: number };

function setup(options: Partial<MutationOptions<Cursor, void>> = {}) {
  const written: Cursor[] = [];
  const gates: PromiseWithResolvers<void>[] = [];
  const mutation = createMutation<Cursor>({
    key: (cursor) => cursor.id,
    mode: "latest",
    run: (cursor) => {
      written.push(cursor);
      const gate = Promise.withResolvers<void>();
      gates.push(gate);
      return gate.promise;
    },
    version: (cursor) => cursor.version,
    ...options,
  });
  const release = async (error?: unknown) => {
    const gate = gates.shift();
    if (error) gate?.reject(error);
    else gate?.resolve();
    await settleMicrotasks();
  };
  return { gates, mutation, release, written };
}

const versions = (written: Cursor[]) => written.map((cursor) => cursor.version);

describe("latest mutation", () => {
  test("writes once and resolves true", async () => {
    const { mutation, release, written } = setup();
    const result = mutation.run({ id: "a", version: 1 });
    await release();
    expect(await result).toBe(true);
    expect(written).toHaveLength(1);
  });

  test("skips versions that are not newer than the synced one", async () => {
    const { mutation, release, written } = setup();
    const first = mutation.run({ id: "a", version: 5 });
    await release();
    await first;
    expect(await mutation.run({ id: "a", version: 5 })).toBe(true);
    expect(await mutation.run({ id: "a", version: 3 })).toBe(true);
    expect(written).toHaveLength(1);
  });

  test("coalesces values requested while a write is running", async () => {
    const { mutation, release, written } = setup();
    const results = [1, 2, 3, 4].map((version) => mutation.run({ id: "a", version }));
    await release();
    await release();
    expect(await Promise.all(results)).toEqual([true, true, true, true]);
    expect(versions(written)).toEqual([1, 4]);
  });

  test("keys are independent", async () => {
    const { mutation, release, written } = setup();
    void mutation.run({ id: "a", version: 1 });
    void mutation.run({ id: "b", version: 1 });
    expect(mutation.pending("a")).toBe(true);
    expect(written).toHaveLength(2);
    await release();
    expect(mutation.pending("a")).toBe(false);
    expect(mutation.pending("b")).toBe(true);
    expect(mutation.pending()).toBe(true);
  });

  test("a failed write resolves false, reports once and the same version retries", async () => {
    const errors: unknown[] = [];
    const { mutation, release, written } = setup({ onError: (error) => errors.push(error) });
    const failed = mutation.run({ id: "a", version: 2 });
    await release(new Error("boom"));
    expect(await failed).toBe(false);
    const retry = mutation.run({ id: "a", version: 2 });
    await release();
    expect(await retry).toBe(true);
    expect(written).toHaveLength(2);
    expect(errors).toHaveLength(1);
  });

  test("a settled error counts as success", async () => {
    const { mutation, release, written } = setup({ settles: () => true });
    const result = mutation.run({ id: "a", version: 2 });
    await release(new Error("channel_not_found"));
    expect(await result).toBe(true);
    expect(await mutation.run({ id: "a", version: 2 })).toBe(true);
    expect(written).toHaveLength(1);
  });

  test("a failure of an outdated value is silent when a newer one is waiting", async () => {
    const errors: unknown[] = [];
    const { mutation, release, written } = setup({ onError: (error) => errors.push(error) });
    const first = mutation.run({ id: "a", version: 1 });
    const second = mutation.run({ id: "a", version: 2 });
    await release(new Error("boom"));
    await release();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(versions(written)).toEqual([1, 2]);
    expect(errors).toHaveLength(0);
  });

  test("force writes even when the version is lower", async () => {
    const { mutation, release, written } = setup();
    void mutation.run({ id: "a", version: 9 });
    await release();
    const forced = mutation.run({ id: "a", version: 2 }, { force: true });
    await release();
    expect(await forced).toBe(true);
    expect(versions(written)).toEqual([9, 2]);
  });

  test("property: the last write is the highest version and writes never go backwards", async () => {
    const runs: number[][] = [];
    forAll(
      (random) => Array.from({ length: int(random, 1, 8) }, () => int(random, 1, 20)),
      (list) => runs.push(list),
      40,
    );
    for (const list of runs) {
      const { gates, mutation, release, written } = setup();
      const results = list.map((version) => mutation.run({ id: "a", version }));
      while (gates.length) await release();
      await Promise.all(results);
      expect(versions(written).at(-1)).toBe(Math.max(...list));
      expect(versions(written)).toEqual([...versions(written)].sort((a, b) => a - b));
    }
  });
});

describe("mutation modes", () => {
  const once = { version: undefined } as const;

  test("single ignores a second call while one runs", async () => {
    const { mutation, release, written } = setup({ ...once, mode: "single" });
    const first = mutation.run({ id: "a", version: 1 });
    expect(await mutation.run({ id: "a", version: 2 })).toBe(false);
    await release();
    expect(await first).toBe(true);
    expect(written).toHaveLength(1);
  });

  test("queue runs calls of one key in order, even after a failure", async () => {
    const { mutation, release, written } = setup({ ...once, mode: "queue" });
    const first = mutation.run({ id: "a", version: 1 });
    const second = mutation.run({ id: "a", version: 2 });
    await settleMicrotasks();
    expect(written).toHaveLength(1);
    await release(new Error("boom"));
    expect(written).toHaveLength(2);
    await release();
    expect(await Promise.all([first, second])).toEqual([false, true]);
  });

  test("optimistic data shows at once, stays on success and leaves on failure", async () => {
    const { cache } = harness();
    cache.set("a", "base");
    const gates: PromiseWithResolvers<void>[] = [];
    const mutation = createMutation<string>({
      optimistic: (suffix, tx) => tx.apply(cache, "a", (data) => `${data}${suffix}`),
      run: () => {
        const gate = Promise.withResolvers<void>();
        gates.push(gate);
        return gate.promise;
      },
    });
    const kept = mutation.run("1");
    const dropped = mutation.run("2");
    expect(cache.read("a")).toBe("base12");
    gates[1]?.reject(new Error("no"));
    gates[0]?.resolve();
    await Promise.all([kept, dropped]);
    expect(cache.read("a")).toBe("base1");
  });

  test.each([
    "onSuccess",
    "onError",
  ] as const)("a latest lane keeps working after %s throws", async (callback) => {
    let broken = true;
    const written: string[] = [];
    const explode = () => {
      if (broken) throw new Error("callback");
    };
    const mutation = createMutation<string>({
      mode: "latest",
      [callback]: explode,
      run: async (value) => {
        written.push(value);
        if (callback === "onError" && broken) await Promise.reject(new Error("write"));
      },
    });
    await expect(mutation.run("one")).rejects.toThrow("callback");
    broken = false;
    expect(await mutation.run("two")).toBe(true);
    expect(written).toEqual(["one", "two"]);
  });

  test("a value queued behind a throwing callback is still written", async () => {
    const written: string[] = [];
    const mutation = createMutation<string>({
      mode: "latest",
      onSuccess: (_, value) => {
        if (value === "one") throw new Error("callback");
      },
      run: async (value) => void written.push(value),
    });
    const first = mutation.run("one");
    void mutation.run("two");
    await expect(first).rejects.toThrow("callback");
    await settleMicrotasks(20);
    expect(written).toEqual(["one", "two"]);
    expect(mutation.pending()).toBe(false);
  });

  test("a superseded value takes its optimistic data with it", async () => {
    const { cache } = harness();
    cache.set("a", "base");
    const gate = Promise.withResolvers<void>();
    const mutation = createMutation<string>({
      mode: "latest",
      optimistic: (value, tx) => tx.apply(cache, "a", () => value),
      run: () => gate.promise,
    });
    void mutation.run("one");
    void mutation.run("two");
    void mutation.run("three");
    expect(cache.read("a")).toBe("three");
    gate.reject(new Error("no"));
    await settleMicrotasks(20);
    expect(cache.read("a")).toBe("base");
  });
});
