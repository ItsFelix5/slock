import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import { createConcurrencyQueue } from "../src/concurrencyQueue";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function gate() {
  let active = 0;
  let peak = 0;
  const started: number[] = [];
  const releases = new Map<number, () => void>();
  const task = (id: number) => () => {
    started.push(id);
    active++;
    peak = Math.max(peak, active);
    const { promise, resolve } = Promise.withResolvers<number>();
    releases.set(id, () => {
      active--;
      resolve(id);
    });
    return promise;
  };
  return { peak: () => peak, releases, started, task };
}

describe("createConcurrencyQueue", () => {
  test("starts at most `limit` tasks and releases the rest in order", async () => {
    const queue = createConcurrencyQueue(2);
    const g = gate();
    const results = [0, 1, 2, 3].map((id) => queue.run(g.task(id)));
    expect(g.started).toEqual([0, 1]);
    g.releases.get(0)?.();
    await tick();
    expect(g.started).toEqual([0, 1, 2]);
    g.releases.get(1)?.();
    g.releases.get(2)?.();
    await tick();
    g.releases.get(3)?.();
    expect(await Promise.all(results)).toEqual([0, 1, 2, 3]);
  });

  test("a rejection frees its slot and reaches only its caller", async () => {
    const queue = createConcurrencyQueue(1);
    const failing = queue.run(() => Promise.reject(new Error("boom")));
    const after = queue.run(() => Promise.resolve("ok"));
    await expect(failing).rejects.toThrow("boom");
    expect(await after).toBe("ok");
  });

  test("limit 1 runs strictly one after another", async () => {
    const queue = createConcurrencyQueue(1);
    const g = gate();
    const all = [0, 1, 2].map((id) => queue.run(g.task(id)));
    for (const id of [0, 1, 2]) {
      await tick();
      expect(g.started).toEqual([0, 1, 2].slice(0, id + 1));
      g.releases.get(id)?.();
    }
    await Promise.all(all);
    expect(g.peak()).toBe(1);
  });

  test("never exceeds the limit and runs every task exactly once", async () => {
    const tasks: Promise<unknown>[] = [];
    forAll(
      (random) => ({ count: int(random, 0, 25), limit: int(random, 1, 5), order: random() }),
      ({ count, limit, order }) => {
        const queue = createConcurrencyQueue(limit);
        const g = gate();
        const runs = Array.from({ length: count }, (_, id) => queue.run(g.task(id)));
        const ids = Array.from({ length: count }, (_, id) => id);
        const drain = async () => {
          while (g.releases.size > 0) {
            const startedNow = g.started.filter((id) => g.releases.has(id));
            const id = startedNow[Math.floor(order * startedNow.length)];
            if (id === undefined) break;
            g.releases.get(id)?.();
            g.releases.delete(id);
            await tick();
          }
          expect(g.peak()).toBeLessThanOrEqual(limit);
          expect([...g.started].sort((a, b) => a - b)).toEqual(ids);
          await Promise.all(runs);
        };
        tasks.push(drain());
      },
      60,
    );
    await Promise.all(tasks);
  });
});
