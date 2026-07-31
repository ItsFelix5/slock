// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import { createLatestValueSync } from "./latestValueSync";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

type Cursor = { channelId: string; ts: number };

describe("createLatestValueSync", () => {
  test("coalesces an in-flight cursor to the newest requested value", async () => {
    const firstWrite = deferred<void>();
    const writes: number[] = [];
    const sync = createLatestValueSync<Cursor>({
      key: (cursor) => cursor.channelId,
      version: (cursor) => cursor.ts,
      write: (cursor) => {
        writes.push(cursor.ts);
        return writes.length === 1 ? firstWrite.promise : Promise.resolve();
      },
    });

    const first = sync.requestLatest({ channelId: "C1", ts: 1 });
    const second = sync.requestLatest({ channelId: "C1", ts: 2 });
    expect(writes).toEqual([1]);

    firstWrite.resolve();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(writes).toEqual([1, 2]);
  });

  test("force writes an older cursor after a newer one", async () => {
    const writes: number[] = [];
    const sync = createLatestValueSync<Cursor>({
      key: (cursor) => cursor.channelId,
      version: (cursor) => cursor.ts,
      write: (cursor) => {
        writes.push(cursor.ts);
        return Promise.resolve();
      },
    });

    await sync.requestLatest({ channelId: "C1", ts: 10 });
    await sync.force({ channelId: "C1", ts: 4 });
    expect(writes).toEqual([10, 4]);
  });

  test("a new visible cursor can supersede an in-flight forced older cursor", async () => {
    const forcedWrite = deferred<void>();
    const writes: number[] = [];
    const sync = createLatestValueSync<Cursor>({
      key: (cursor) => cursor.channelId,
      version: (cursor) => cursor.ts,
      write: (cursor) => {
        writes.push(cursor.ts);
        return writes.length === 2 ? forcedWrite.promise : Promise.resolve();
      },
    });

    await sync.requestLatest({ channelId: "C1", ts: 10 });
    const forced = sync.force({ channelId: "C1", ts: 4 });
    const visible = sync.requestLatest({ channelId: "C1", ts: 10 });
    expect(writes).toEqual([10, 4]);

    forcedWrite.resolve();
    expect(await forced).toBe(true);
    expect(await visible).toBe(true);
    expect(writes).toEqual([10, 4, 10]);
  });

  test("retries the same cursor after a failure", async () => {
    let calls = 0;
    const sync = createLatestValueSync<Cursor>({
      key: (cursor) => cursor.channelId,
      version: (cursor) => cursor.ts,
      write: () => {
        calls++;
        return calls === 1 ? Promise.reject(new Error("offline")) : Promise.resolve();
      },
    });

    expect(await sync.requestLatest({ channelId: "C1", ts: 3 })).toBe(false);
    expect(await sync.requestLatest({ channelId: "C1", ts: 3 })).toBe(true);
    expect(calls).toBe(2);
  });

  test("does not report a stale failure when a newer cursor succeeds", async () => {
    const firstWrite = deferred<void>();
    const errors: unknown[] = [];
    const writes: number[] = [];
    const sync = createLatestValueSync<Cursor>({
      key: (cursor) => cursor.channelId,
      onError: (_cursor, error) => errors.push(error),
      version: (cursor) => cursor.ts,
      write: (cursor) => {
        writes.push(cursor.ts);
        return writes.length === 1 ? firstWrite.promise : Promise.resolve();
      },
    });

    const result = sync.requestLatest({ channelId: "C1", ts: 1 });
    sync.requestLatest({ channelId: "C1", ts: 2 });
    firstWrite.reject(new Error("stale"));

    expect(await result).toBe(true);
    expect(writes).toEqual([1, 2]);
    expect(errors).toEqual([]);
  });
});
