import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { createRoot } from "solid-js";
import { createDebouncedRequest } from "../src/debouncedRequest";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function harness(delay?: number) {
  const events: string[] = [];
  const pending: PromiseWithResolvers<string>[] = [];
  const requested: string[] = [];
  const request = (query: string) => {
    requested.push(query);
    const deferred = Promise.withResolvers<string>();
    pending.push(deferred);
    return deferred.promise;
  };
  const { run, dispose } = createRoot((dispose) => ({
    dispose,
    ...createDebouncedRequest(request, {
      delay,
      onError: (error, query) => events.push(`error:${query}:${(error as Error).message}`),
      onPendingChange: (state) => events.push(`pending:${state}`),
      onReset: () => events.push("reset"),
      onResult: (result, query) => events.push(`result:${query}:${result}`),
    }),
  }));
  return { dispose, events, pending, requested, run };
}

describe("createDebouncedRequest", () => {
  test("waits for the delay and only sends the latest query", () => {
    const h = harness(100);
    h.run("a");
    jest.advanceTimersByTime(60);
    h.run("ab");
    jest.advanceTimersByTime(99);
    expect(h.requested).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(h.requested).toEqual(["ab"]);
  });

  test("defaults to 250 ms", () => {
    const h = harness();
    h.run("a");
    jest.advanceTimersByTime(249);
    expect(h.requested).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(h.requested).toEqual(["a"]);
  });

  test("immediate skips the wait and trims the query", () => {
    const h = harness(100);
    h.run("  hello  ", { immediate: true });
    expect(h.requested).toEqual(["hello"]);
  });

  test("an empty query cancels the wait and clears pending", () => {
    const h = harness(100);
    h.run("a");
    h.run("   ");
    jest.advanceTimersByTime(500);
    expect(h.requested).toEqual([]);
    expect(h.events).toEqual(["reset", "pending:true", "reset", "pending:false"]);
  });

  test("reports result then pending false", async () => {
    const h = harness(0);
    h.run("a");
    jest.advanceTimersByTime(0);
    h.pending[0]?.resolve("hit");
    await flush();
    expect(h.events).toEqual(["reset", "pending:true", "result:a:hit", "pending:false"]);
  });

  test("an older response arriving late is dropped", async () => {
    const h = harness(0);
    h.run("a", { immediate: true });
    h.run("ab", { immediate: true });
    h.pending[1]?.resolve("new");
    await flush();
    h.pending[0]?.resolve("old");
    await flush();
    expect(h.events.filter((event) => event.startsWith("result"))).toEqual(["result:ab:new"]);
    expect(h.events.filter((event) => event === "pending:false")).toHaveLength(1);
  });

  test("routes a rejection to onError for the current query only", async () => {
    const h = harness(0);
    h.run("a", { immediate: true });
    h.run("b", { immediate: true });
    h.pending[0]?.reject(new Error("stale"));
    h.pending[1]?.reject(new Error("429"));
    await flush();
    expect(h.events.filter((event) => event.startsWith("error"))).toEqual(["error:b:429"]);
  });

  test("dispose cancels the timer and silences in-flight results", async () => {
    const h = harness(100);
    h.run("a");
    h.dispose();
    jest.advanceTimersByTime(500);
    expect(h.requested).toEqual([]);
    const fresh = harness(0);
    fresh.run("b", { immediate: true });
    fresh.dispose();
    fresh.pending[0]?.resolve("late");
    await flush();
    expect(fresh.events).toEqual(["reset", "pending:true"]);
    fresh.run("c", { immediate: true });
    expect(fresh.requested).toEqual(["b"]);
  });
});
