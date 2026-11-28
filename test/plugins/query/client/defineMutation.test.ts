import { describe, expect, spyOn, test } from "bun:test";
import { createEffect, createRoot, flush } from "solid-js";
import {
  defineMutation,
  definePagedQuery,
  defineQuery,
} from "../../../../packages/plugins/src/query/client/api";
import { startQueryHost } from "../../../support/queryHost";

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
    flush();
  }
};

function watch<T>(read: () => T) {
  const seen: T[] = [];
  const dispose = createRoot((stop) => {
    createEffect(read, (value) => void seen.push(value));
    return stop;
  });
  return { dispose, seen };
}

describe("defineMutation", () => {
  test("optimistic data and pending are reactive, and a failure restores the data", async () => {
    await startQueryHost();
    const flag = defineQuery<string, boolean>({
      load: () => Promise.resolve(false),
      name: "flag",
    });
    await flag.ensure("a");
    const gate = Promise.withResolvers<void>();
    const toggle = defineMutation<string>({
      mode: "single",
      optimistic: (id, transaction) => transaction.apply(flag, id, () => true),
      run: () => gate.promise,
    });
    const shown = watch(() => `${flag.peek("a")} ${toggle.pending("")}`);
    await settle();
    const done = toggle.run("a");
    await settle();
    gate.reject(new Error("no"));
    expect(await done).toBe(false);
    await settle();
    expect(shown.seen).toEqual(["false false", "true true", "false false"]);
    shown.dispose();
  });
});

describe("definePagedQuery", () => {
  const numbers = (fails = (_cursor?: number) => false) => {
    const calls: (number | undefined)[] = [];
    let offset = 0;
    const query = definePagedQuery<null, { id: string }, number>({
      itemKey: (item) => item.id,
      load: (_arg, cursor) => {
        calls.push(cursor);
        if (fails(cursor)) return Promise.reject(new Error("down"));
        const page = cursor ?? 0;
        return Promise.resolve({
          items: [{ id: `${page + offset}` }],
          next: page < 2 ? page + 1 : undefined,
        });
      },
      name: `numbers${Math.random()}`,
      retry: { retries: 0 },
    });
    const ids = () => query.read(null)?.items.map((item) => item.id);
    const shift = (by: number) => {
      offset = by;
    };
    return { calls, ids, query, shift };
  };

  test("loads the first page, then appends until there is no next", async () => {
    await startQueryHost();
    const { calls, ids, query } = numbers();
    await query.ensure(null);
    await query.more(null);
    await query.more(null);
    expect(ids()).toEqual(["0", "1", "2"]);
    await query.more(null);
    expect(calls).toEqual([undefined, 1, 2]);
  });

  test("a refresh reloads every page already shown", async () => {
    await startQueryHost();
    const { ids, query, shift } = numbers();
    await query.ensure(null);
    await query.more(null);
    shift(10);
    await query.refresh(null);
    expect(ids()).toEqual(["10", "11"]);
  });

  test("two calls for more load one page", async () => {
    await startQueryHost();
    const { calls, query } = numbers();
    await query.ensure(null);
    await Promise.all([query.more(null), query.more(null)]);
    expect(calls).toEqual([undefined, 1]);
  });

  test("a reload clears an earlier failed next page", async () => {
    await startQueryHost();
    const errors = spyOn(console, "error").mockImplementation(() => {});
    let broken = true;
    const { ids, query } = numbers((cursor) => cursor !== undefined && broken);
    await query.ensure(null);
    expect(await query.more(null)).toBe(false);
    expect(query.moreFailed(null)).toBe(true);
    broken = false;
    await query.refresh(null);
    expect(query.moreFailed(null)).toBe(false);
    expect(await query.more(null)).toBe(true);
    expect(ids()).toEqual(["0", "1"]);
    errors.mockRestore();
  });
});
