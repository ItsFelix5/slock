import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import { createLatestValueSync } from "../../../../src/query/client/api/latestValueSync";

type Cursor = { id: string; version: number };

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

function setup(options: { onError?: (value: Cursor, error: unknown) => boolean | undefined } = {}) {
  const written: Cursor[] = [];
  const gates: ReturnType<typeof deferred>[] = [];
  const failNext: unknown[] = [];
  const sync = createLatestValueSync<Cursor>({
    key: (cursor) => cursor.id,
    onError: options.onError,
    version: (cursor) => cursor.version,
    write: async (cursor) => {
      written.push(cursor);
      const gate = deferred();
      gates.push(gate);
      await gate.promise;
      if (failNext.length) throw failNext.shift();
    },
  });
  const release = async () => {
    gates.shift()?.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { failNext, gates, release, sync, written };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createLatestValueSync", () => {
  test("writes once and resolves true", async () => {
    const { release, sync, written } = setup();
    const result = sync.requestLatest({ id: "a", version: 1 });
    await release();
    expect(await result).toBe(true);
    expect(written).toEqual([{ id: "a", version: 1 }]);
  });

  test("skips versions that are not newer than the synced one", async () => {
    const { release, sync, written } = setup();
    const first = sync.requestLatest({ id: "a", version: 5 });
    await release();
    await first;
    expect(await sync.requestLatest({ id: "a", version: 5 })).toBe(true);
    expect(await sync.requestLatest({ id: "a", version: 3 })).toBe(true);
    expect(written).toHaveLength(1);
  });

  test("coalesces versions requested while a write is running", async () => {
    const { release, sync, written } = setup();
    const results = [1, 2, 3, 4].map((version) => sync.requestLatest({ id: "a", version }));
    await release();
    await release();
    expect(await Promise.all(results)).toEqual([true, true, true, true]);
    expect(written.map((cursor) => cursor.version)).toEqual([1, 4]);
  });

  test("keys are independent", async () => {
    const { release, sync, written } = setup();
    const a = sync.requestLatest({ id: "a", version: 1 });
    const b = sync.requestLatest({ id: "b", version: 1 });
    await release();
    await release();
    await Promise.all([a, b]);
    expect(written.map((cursor) => cursor.id).sort()).toEqual(["a", "b"]);
  });

  test("a failed write resolves false and the same version retries", async () => {
    const { failNext, release, sync, written } = setup();
    failNext.push(new Error("boom"));
    const failed = sync.requestLatest({ id: "a", version: 2 });
    await release();
    expect(await failed).toBe(false);
    const retry = sync.requestLatest({ id: "a", version: 2 });
    await release();
    expect(await retry).toBe(true);
    expect(written).toHaveLength(2);
  });

  test("onError returning true counts the value as synced", async () => {
    const { failNext, release, sync, written } = setup({ onError: () => true });
    failNext.push(new Error("channel_not_found"));
    const result = sync.requestLatest({ id: "a", version: 2 });
    await release();
    expect(await result).toBe(true);
    expect(await sync.requestLatest({ id: "a", version: 2 })).toBe(true);
    expect(written).toHaveLength(1);
  });

  test("a failure of an outdated value is ignored when a newer one is waiting", async () => {
    const { failNext, release, sync, written } = setup();
    failNext.push(new Error("boom"));
    const first = sync.requestLatest({ id: "a", version: 1 });
    const second = sync.requestLatest({ id: "a", version: 2 });
    await release();
    await release();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(written.map((cursor) => cursor.version)).toEqual([1, 2]);
  });

  test("force writes even when the version is lower", async () => {
    const { release, sync, written } = setup();
    const first = sync.requestLatest({ id: "a", version: 9 });
    await release();
    await first;
    const forced = sync.force({ id: "a", version: 2 });
    await release();
    expect(await forced).toBe(true);
    expect(written.map((cursor) => cursor.version)).toEqual([9, 2]);
  });

  test("property: the last write is the highest requested version and writes never go backwards", async () => {
    const runs: number[][] = [];
    forAll(
      (random) => Array.from({ length: int(random, 1, 8) }, () => int(random, 1, 20)),
      (versions) => runs.push(versions),
      40,
    );
    for (const versions of runs) {
      const { gates, sync, written } = setup();
      const results = versions.map((version) => sync.requestLatest({ id: "a", version }));
      while (gates.length) {
        gates.shift()?.resolve();
        await flush();
      }
      await Promise.all(results);
      const writtenVersions = written.map((cursor) => cursor.version);
      expect(writtenVersions.at(-1)).toBe(Math.max(...versions));
      expect(writtenVersions).toEqual([...writtenVersions].sort((a, b) => a - b));
      expect(writtenVersions.length).toBeLessThanOrEqual(versions.length);
    }
  });
});
