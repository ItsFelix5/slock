import { expect, test } from "bun:test";
import { parseUserId } from "@slock/slack";
import { createHydrationQueue } from "../../../src/presence/client/hydrationQueue";

const A = parseUserId("UA");
const B = parseUserId("UB");

function start(load: (id: typeof A) => Promise<unknown> = () => Promise.resolve()) {
  const loaded: string[] = [];
  const pending: (() => void)[] = [];
  const cancelled: number[] = [];
  const queue = createHydrationQueue({
    load: (id) => {
      loaded.push(id);
      return load(id);
    },
    schedule: (run) => {
      pending.push(run);
      const slot = pending.length;
      return () => cancelled.push(slot);
    },
  });
  return { cancelled, loaded, pending, queue };
}

test("ids requested before the flush are loaded together once", () => {
  const { loaded, pending, queue } = start();
  queue.request([A]);
  queue.request([A, B]);
  expect(pending).toHaveLength(1);
  pending[0]?.();
  expect(loaded).toEqual([A, B]);
});

test("an id that already loaded is not loaded again", () => {
  const { loaded, pending, queue } = start();
  queue.request([A]);
  pending[0]?.();
  queue.request([A]);
  expect(pending).toHaveLength(1);
  expect(loaded).toEqual([A]);
});

test("a failed load is retried on the next request", async () => {
  let fail = true;
  const { loaded, pending, queue } = start(() =>
    fail ? Promise.reject(new Error("x")) : Promise.resolve(),
  );
  queue.request([A]);
  pending[0]?.();
  await Promise.resolve();
  await Promise.resolve();
  fail = false;
  queue.request([A]);
  pending[1]?.();
  expect(loaded).toEqual([A, A]);
});

test("disposing cancels the scheduled flush", () => {
  const { cancelled, pending, queue } = start();
  queue.request([A]);
  queue.dispose();
  expect(pending).toHaveLength(1);
  expect(cancelled).toEqual([1]);
});
