import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createRoot, createSignal, flush } from "solid-js";
import { createOptionSearch } from "../../../packages/ui/src/form/createOptionSearch";
import { startFakeEnv } from "../fakeEnv";

let fake: Awaited<ReturnType<typeof startFakeEnv>>;

beforeEach(async () => {
  fake = await startFakeEnv();
});
afterEach(() => fake.stop());

async function settle() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
  flush();
}

function harness(search: (query: string) => string[] | Promise<string[]>) {
  const [active, setActive] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const results = createRoot(() => createOptionSearch({ active, delay: 150, query, search }));
  const write =
    <T>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      flush();
    };
  return { results, setActive: write(setActive), setQuery: write(setQuery) };
}

describe("createOptionSearch", () => {
  test("does nothing until active", async () => {
    const asked: string[] = [];
    const h = harness((q) => {
      asked.push(q);
      return [];
    });
    h.setQuery("a");
    fake.env.advance(500);
    await settle();
    expect(asked).toEqual([]);
  });

  test("an empty query searches at once when opened", async () => {
    const h = harness((q) => [`all:${q}`]);
    h.setActive(true);
    await settle();
    expect(h.results()).toEqual(["all:"]);
  });

  test("a typed query waits for the delay and searches only the latest text", async () => {
    const asked: string[] = [];
    const h = harness((q) => {
      asked.push(q);
      return [q];
    });
    h.setActive(true);
    await settle();
    h.setQuery("a");
    fake.env.advance(100);
    h.setQuery("ab");
    fake.env.advance(149);
    expect(asked).toEqual([""]);
    fake.env.advance(1);
    await settle();
    expect(asked).toEqual(["", "ab"]);
    expect(h.results()).toEqual(["ab"]);
  });

  test("a slow answer for an older query never replaces a newer one", async () => {
    const pending = new Map<string, PromiseWithResolvers<string[]>>();
    const h = harness((q) => {
      const request = Promise.withResolvers<string[]>();
      pending.set(q, request);
      return request.promise;
    });
    h.setActive(true);
    pending.get("")?.resolve([]);
    await settle();
    h.setQuery("a");
    fake.env.advance(150);
    h.setQuery("ab");
    fake.env.advance(150);
    pending.get("ab")?.resolve(["new"]);
    await settle();
    pending.get("a")?.resolve(["old"]);
    await settle();
    expect(h.results()).toEqual(["new"]);
  });

  test("a failed search clears the results", async () => {
    let fail = false;
    const h = harness((q) => (fail ? Promise.reject(new Error("down")) : [q]));
    h.setActive(true);
    await settle();
    expect(h.results()).toEqual([""]);
    fail = true;
    h.setQuery("x");
    fake.env.advance(150);
    await settle();
    expect(h.results()).toEqual([]);
  });

  test("closing cancels a pending search", async () => {
    const asked: string[] = [];
    const h = harness((q) => {
      asked.push(q);
      return [q];
    });
    h.setActive(true);
    await settle();
    h.setQuery("a");
    h.setActive(false);
    fake.env.advance(500);
    await settle();
    expect(asked).toEqual([""]);
  });
});
