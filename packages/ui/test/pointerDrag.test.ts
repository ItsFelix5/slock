import { afterEach, expect, test } from "bun:test";
import { startFrameCoalescedPointerDrag } from "../src/pointerDrag";

const pending: FrameRequestCallback[] = [];
const realRaf = window.requestAnimationFrame;
const realCancel = window.cancelAnimationFrame;

function installFrames() {
  pending.length = 0;
  window.requestAnimationFrame = (callback) => pending.push(callback);
  window.cancelAnimationFrame = (id) => {
    pending[id - 1] = () => {};
  };
}

function runFrames() {
  for (const callback of pending.splice(0)) callback(0);
}

afterEach(() => {
  window.requestAnimationFrame = realRaf;
  window.cancelAnimationFrame = realCancel;
});

const move = (id: number) => {
  window.dispatchEvent(new MessageEvent("pointermove", { data: id }));
};

test("coalesces moves within a frame into the latest one", () => {
  installFrames();
  const seen: number[] = [];
  const stop = startFrameCoalescedPointerDrag((event) =>
    seen.push((event as unknown as MessageEvent<number>).data),
  );
  move(1);
  move(2);
  move(3);
  expect(seen).toEqual([]);
  runFrames();
  expect(seen).toEqual([3]);
  move(4);
  runFrames();
  expect(seen).toEqual([3, 4]);
  stop();
});

test.each([
  "pointerup",
  "pointercancel",
  "blur",
])("%s ends the drag and removes listeners", (type) => {
  installFrames();
  let moves = 0;
  let ends = 0;
  startFrameCoalescedPointerDrag(
    () => {
      moves += 1;
    },
    () => {
      ends += 1;
    },
  );
  window.dispatchEvent(new MessageEvent(type));
  expect(ends).toBe(1);
  move(1);
  runFrames();
  for (const again of ["pointerup", "pointercancel", "blur"])
    window.dispatchEvent(new MessageEvent(again));
  expect(moves).toBe(0);
  expect(ends).toBe(1);
});

test("stopping cancels a pending frame", () => {
  installFrames();
  let moves = 0;
  const stop = startFrameCoalescedPointerDrag(() => {
    moves += 1;
  });
  move(1);
  stop();
  runFrames();
  expect(moves).toBe(0);
});
