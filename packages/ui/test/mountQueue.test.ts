import { expect, test } from "bun:test";
import { createMountQueue } from "../src/mountQueue";

function fakeEnv() {
  let clock = 0;
  const frames: (() => void)[] = [];
  const idles: ((remainingMs: () => number) => void)[] = [];
  return {
    advance: (ms: number) => {
      clock += ms;
    },
    env: {
      frame: (run: () => void) => frames.push(run),
      idle: (run: (remainingMs: () => number) => void) => idles.push(run),
      now: () => clock,
    },
    frames,
    idles,
  };
}

test("background tasks run newest first and stop when idle time runs out", () => {
  const fake = fakeEnv();
  const queue = createMountQueue(fake.env);
  const ran: number[] = [];
  for (const id of [1, 2, 3]) queue.add(() => ran.push(id));
  let remaining = 30;
  fake.idles.shift()?.(() => (remaining -= 15));
  expect(ran).toEqual([3, 2]);
  expect(fake.idles.length).toBe(1);
  fake.idles.shift()?.(() => 50);
  expect(ran).toEqual([3, 2, 1]);
});

test("promoted tasks run in a frame before background ones, bottom of the batch first", () => {
  const fake = fakeEnv();
  const queue = createMountQueue(fake.env);
  const ran: string[] = [];
  const handles = ["a", "b", "c"].map((id) => queue.add(() => ran.push(id)));
  handles[0]?.promote();
  handles[1]?.promote();
  expect(fake.frames.length).toBe(1);
  fake.frames.shift()?.();
  expect(ran).toEqual(["b", "a"]);
});

test("a frame slice always runs one task and yields once the budget is spent", () => {
  const fake = fakeEnv();
  const queue = createMountQueue(fake.env);
  const ran: number[] = [];
  const handles = [1, 2, 3].map((id) =>
    queue.add(() => {
      ran.push(id);
      fake.advance(15);
    }),
  );
  for (const handle of handles) handle.promote();
  fake.frames.shift()?.();
  expect(ran).toEqual([3]);
  expect(fake.frames.length).toBe(1);
  fake.frames.shift()?.();
  fake.frames.shift()?.();
  expect(ran).toEqual([3, 2, 1]);
});

test("cancel drops a task and promote after running does nothing", () => {
  const fake = fakeEnv();
  const queue = createMountQueue(fake.env);
  const ran: string[] = [];
  const dropped = queue.add(() => ran.push("dropped"));
  const kept = queue.add(() => ran.push("kept"));
  dropped.cancel();
  fake.idles.shift()?.(() => 50);
  kept.promote();
  expect(ran).toEqual(["kept"]);
  expect(fake.frames.length).toBe(0);
});
