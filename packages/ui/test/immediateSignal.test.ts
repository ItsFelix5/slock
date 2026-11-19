import { expect, test } from "bun:test";
import { createEffect, createRoot, flush } from "solid-js";
import { createImmediateSignal } from "../src/immediateSignal";

test("reads see the latest write at once and still notify subscribers", () => {
  const seen: number[] = [];
  const dispose = createRoot((disposeRoot) => {
    const [value, setValue] = createImmediateSignal(1);
    createEffect(value, (next) => {
      seen.push(next);
    });
    flush();
    setValue(2);
    setValue(value() + 1);
    expect(value()).toBe(3);
    flush();
    return disposeRoot;
  });
  expect(seen).toEqual([1, 3]);
  dispose();
});
