import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { createTypeahead, defineQuery } from "../../../../packages/plugins/src/query/client/api";
import { createFakeEnv, type FakeEnv } from "../../../support/core";
import { startQueryHost } from "../../../support/queryHost";

let env: FakeEnv;
let host: Awaited<ReturnType<typeof startQueryHost>>;

beforeEach(async () => {
  env = createFakeEnv();
  host = await startQueryHost(env);
});
afterEach(() => host.stop());

async function settle() {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
}

function harness() {
  const requested: string[] = [];
  const pending: PromiseWithResolvers<string>[] = [];
  const matches = defineQuery<string, string>({
    load: (term) => {
      requested.push(term);
      const deferred = Promise.withResolvers<string>();
      pending.push(deferred);
      return deferred.promise;
    },
    name: "matches",
    retry: { retries: 0 },
  });
  const view = createRoot((dispose) => ({
    dispose,
    ...createTypeahead(matches, { arg: (term) => term, delay: 100, empty: "" }),
  }));
  const set = async (raw: string, wait = 100) => {
    view.set(raw);
    flush();
    env.advance(wait);
    await settle();
  };
  return { pending, requested, set, view };
}

describe("createTypeahead", () => {
  test("waits for the delay and only loads the latest term, trimmed", async () => {
    const h = harness();
    await h.set("a", 60);
    await h.set("  ab ", 99);
    expect(h.requested).toEqual([]);
    await h.set("  ab ", 100);
    expect(h.requested).toEqual(["ab"]);
  });

  test("searching covers the wait and the load", async () => {
    const h = harness();
    expect(h.view.searching()).toBe(false);
    await h.set("a", 0);
    expect(h.view.searching()).toBe(true);
    await h.set("a");
    expect(h.view.searching()).toBe(true);
    h.pending[0]?.resolve("hit");
    await settle();
    expect(h.view.searching()).toBe(false);
    expect(h.view.value()).toBe("hit");
  });

  test("keeps the previous results while the next term loads", async () => {
    const h = harness();
    await h.set("a");
    h.pending[0]?.resolve("first");
    await settle();
    await h.set("ab");
    expect(h.view.value()).toBe("first");
    expect(h.view.searching()).toBe(true);
  });

  test("an empty term cancels the wait, clears the results and never loads", async () => {
    const h = harness();
    await h.set("a");
    h.pending[0]?.resolve("first");
    await settle();
    await h.set("b", 0);
    await h.set("   ", 500);
    expect(h.requested).toEqual(["a"]);
    expect(h.view.value()).toBe("");
    expect(h.view.searching()).toBe(false);
  });

  test("an older answer arriving late is dropped", async () => {
    const h = harness();
    await h.set("a");
    await h.set("ab");
    h.pending[1]?.resolve("new");
    await settle();
    h.pending[0]?.resolve("old");
    await settle();
    expect(h.view.value()).toBe("new");
  });

  test("a failure reports failed, and the next term recovers", async () => {
    const h = harness();
    await h.set("a");
    h.pending[0]?.reject(new Error("429"));
    await settle();
    expect(h.view.failed()).toBe(true);
    expect(h.view.value()).toBe("");
    await h.set("b");
    h.pending[1]?.resolve("ok");
    await settle();
    expect(h.view.failed()).toBe(false);
    expect(h.view.value()).toBe("ok");
  });

  test("retry loads the failed term again", async () => {
    const h = harness();
    await h.set("a");
    h.pending[0]?.reject(new Error("429"));
    await settle();
    h.view.retry();
    await settle();
    expect(h.view.failed()).toBe(false);
    h.pending[1]?.resolve("hit");
    await settle();
    expect(h.view.value()).toBe("hit");
    expect(h.requested).toEqual(["a", "a"]);
  });

  test("dispose cancels the wait", async () => {
    const h = harness();
    await h.set("a", 0);
    h.view.dispose();
    env.advance(500);
    await settle();
    expect(h.requested).toEqual([]);
  });
});
