import { describe, expect, test } from "bun:test";
import { forAllAsync, int, pick, type Random, seededRandom } from "../support/core";
import { harness } from "./harness";

describe("latest wins", () => {
  test("a slower older fetch never overwrites a newer result", async () => {
    const { cache, calls, flush } = harness();
    const older = cache.refresh("a");
    const newer = cache.refresh("a");
    calls[1]?.resolve("new");
    await flush();
    calls[0]?.resolve("old");
    await flush();
    expect(cache.read("a")).toBe("new");
    expect(await Promise.all([older, newer])).toEqual(["new", "new"]);
  });

  test("a set while fetching drops the fetch result and resolves waiters with the set value", async () => {
    const { cache, calls, flush } = harness();
    const waiting = cache.ensure("a");
    cache.set("a", "manual");
    calls[0]?.resolve("fetched");
    await flush();
    expect(cache.read("a")).toBe("manual");
    expect(await waiting).toBe("manual");
  });

  test("invalidate while fetching drops the old result and refetches", async () => {
    const { cache, calls, flush } = harness();
    const waiting = cache.ensure("a");
    cache.invalidate("a");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.signal.aborted).toBe(true);
    calls[0]?.resolve("old");
    await flush();
    expect(cache.read("a")).toBeUndefined();
    calls[1]?.resolve("fresh");
    expect(await waiting).toBe("fresh");
  });

  test("a fetch started after a set wins over that set", async () => {
    const { cache, calls } = harness();
    cache.set("a", "manual");
    const refreshed = cache.refresh("a");
    calls[0]?.resolve("server");
    expect(await refreshed).toBe("server");
    expect(cache.read("a")).toBe("server");
  });

  test("a failed older fetch never overwrites a newer success", async () => {
    const { cache, calls, flush } = harness({ retry: { retries: 0 } });
    const older = cache.refresh("a").catch(() => "failed");
    const newer = cache.refresh("a");
    calls[1]?.resolve("new");
    await flush();
    calls[0]?.reject(new Error("late"));
    await flush();
    expect(cache.state("a").status).toBe("ready");
    expect(await newer).toBe("new");
    expect(await older).toBe("new");
  });

  test("fuzz: any completion order ends in the outcome of the last operation", async () => {
    type Op = { kind: "refresh" | "invalidate" } | { kind: "set"; value: string };
    const generate = (random: Random) => ({
      completionSeed: int(random, 1, 1_000_000),
      ops: Array.from({ length: int(random, 1, 8) }, (): Op => {
        const kind = pick(random, ["refresh", "invalidate", "set"] as const);
        return kind === "set" ? { kind, value: `set${int(random, 0, 99)}` } : { kind };
      }),
    });
    await forAllAsync(generate, async ({ completionSeed, ops }) => {
      const { cache, calls, flush } = harness();
      const stop = cache.subscribe("k", () => {});
      let expected = "r0";
      for (const op of ops) {
        if (op.kind === "set") {
          cache.set("k", op.value);
          expected = op.value;
        } else {
          if (op.kind === "refresh") void cache.refresh("k");
          else cache.invalidate("k");
          expected = `r${calls.length - 1}`;
        }
      }
      const order = calls.map((_, index) => index);
      const random = seededRandom(completionSeed);
      for (let index = order.length - 1; index > 0; index--) {
        const swap = int(random, 0, index);
        [order[index], order[swap]] = [order[swap] ?? 0, order[index] ?? 0];
      }
      for (const index of order) {
        calls[index]?.resolve(`r${index}`);
        await flush();
      }
      expect(cache.read("k")).toBe(expected);
      expect(cache.state("k").refreshing).toBe(false);
      stop();
    });
  });
});
