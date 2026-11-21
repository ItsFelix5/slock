import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { createDebouncedSearch } from "../src/debouncedQuery";
import { startFakeEnv } from "./fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => fake.stop());

async function settle() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  flush();
}

function harness(delay = 100) {
  const requested: string[] = [];
  const pending: PromiseWithResolvers<string>[] = [];
  const view = createRoot((dispose) => ({
    dispose,
    ...createDebouncedSearch<string>({
      delay,
      empty: "",
      search: (query) => {
        requested.push(query);
        const deferred = Promise.withResolvers<string>();
        pending.push(deferred);
        return deferred.promise;
      },
    }),
  }));
  const set = (query: string, immediate = false) => {
    view.set(query, immediate);
    flush();
  };
  const advance = (ms: number) => {
    fake.env.advance(ms);
    flush();
  };
  return { advance, pending, requested, set, view };
}

describe("createDebouncedSearch", () => {
  test("waits for the delay and only searches the latest query", () => {
    const h = harness(100);
    h.set("a");
    h.advance(60);
    h.set("ab");
    h.advance(99);
    expect(h.requested).toEqual([]);
    h.advance(1);
    expect(h.requested).toEqual(["ab"]);
  });

  test("searching covers the wait and the request", async () => {
    const h = harness(100);
    expect(h.view.searching()).toBe(false);
    h.set("a");
    expect(h.view.searching()).toBe(true);
    h.advance(100);
    expect(h.view.searching()).toBe(true);
    h.pending[0]?.resolve("hit");
    await settle();
    expect(h.view.searching()).toBe(false);
    expect(h.view.value()).toBe("hit");
  });

  test("immediate skips the wait and trims the query", () => {
    const h = harness(100);
    h.set("  hello  ", true);
    expect(h.requested).toEqual(["hello"]);
  });

  test("keeps the previous value visible while the next query is in flight", async () => {
    const h = harness();
    h.set("a", true);
    h.pending[0]?.resolve("first");
    await settle();
    h.set("ab", true);
    expect(h.view.value()).toBe("first");
    expect(h.view.searching()).toBe(true);
  });

  test("an empty query cancels the wait, clears the value and never requests", async () => {
    const h = harness(100);
    h.set("a", true);
    h.pending[0]?.resolve("first");
    await settle();
    h.set("b");
    h.set("   ");
    h.advance(500);
    expect(h.requested).toEqual(["a"]);
    expect(h.view.value()).toBe("");
    expect(h.view.searching()).toBe(false);
  });

  test("an older response arriving late is dropped", async () => {
    const h = harness();
    h.set("a", true);
    h.set("ab", true);
    h.pending[1]?.resolve("new");
    await settle();
    h.pending[0]?.resolve("old");
    await settle();
    expect(h.view.value()).toBe("new");
    expect(h.view.searching()).toBe(false);
  });

  test("a rejection reports failed with the empty value, the next query recovers", async () => {
    const h = harness();
    h.set("a", true);
    h.pending[0]?.reject(new Error("429"));
    await settle();
    expect(h.view.failed()).toBe(true);
    expect(h.view.value()).toBe("");
    h.set("b", true);
    h.pending[1]?.resolve("ok");
    await settle();
    expect(h.view.failed()).toBe(false);
    expect(h.view.value()).toBe("ok");
  });

  test("refresh asks again and reports searching", async () => {
    const h = harness();
    h.set("a", true);
    h.pending[0]?.resolve("first");
    await settle();
    h.view.refresh();
    flush();
    expect(h.requested).toEqual(["a", "a"]);
    expect(h.view.searching()).toBe(true);
    h.pending[1]?.resolve("second");
    await settle();
    expect(h.view.value()).toBe("second");
  });

  test("dispose cancels the timer", () => {
    const h = harness(100);
    h.set("a");
    h.view.dispose();
    h.advance(500);
    expect(h.requested).toEqual([]);
  });
});
