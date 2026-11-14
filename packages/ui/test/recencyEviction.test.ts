import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import { createRoot, createSignal } from "solid-js";
import { createRecencyEviction } from "../src/recencyEviction";

function watch(keepRecent: number, initial: string[] = []) {
  const [visible, setVisible] = createSignal(initial);
  const [idle, setIdle] = createSignal(false);
  const evicted: string[] = [];
  const dispose = createRoot((dispose) => {
    createRecencyEviction({ evict: (key) => evicted.push(key), idle, keepRecent, visible });
    return dispose;
  });
  return { dispose, evicted, setIdle, setVisible };
}

describe("createRecencyEviction", () => {
  test("keeps the most recently hidden keys and evicts the older ones", () => {
    const w = watch(1, ["a"]);
    w.setVisible(["b"]);
    expect(w.evicted).toEqual([]);
    w.setVisible(["c"]);
    expect(w.evicted).toEqual(["a"]);
    w.setVisible(["d"]);
    expect(w.evicted).toEqual(["a", "b"]);
    w.dispose();
  });

  test("a hidden key that becomes visible again is safe", () => {
    const w = watch(1, ["a"]);
    w.setVisible(["b"]);
    w.setVisible(["a"]);
    w.setVisible(["c"]);
    expect(w.evicted).toEqual(["b"]);
    w.dispose();
  });

  test("keepRecent 0 evicts as soon as a key is hidden", () => {
    const w = watch(0, ["a", "b"]);
    w.setVisible(["b"]);
    expect(w.evicted).toEqual(["a"]);
    w.dispose();
  });

  test("an idle page drops everything that is hidden", () => {
    const w = watch(3, ["a"]);
    w.setVisible(["b"]);
    w.setVisible(["c"]);
    expect(w.evicted).toEqual([]);
    w.setIdle(true);
    expect(w.evicted.sort()).toEqual(["a", "b"]);
    w.setIdle(false);
    w.setVisible(["d"]);
    expect(w.evicted.sort()).toEqual(["a", "b"]);
    w.dispose();
  });

  test("stops reacting after dispose", () => {
    const w = watch(0, ["a"]);
    w.dispose();
    w.setVisible(["b"]);
    expect(w.evicted).toEqual([]);
  });

  test("never evicts a visible key", () => {
    forAll(
      (random) => ({
        keep: int(random, 0, 3),
        steps: Array.from({ length: int(random, 1, 15) }, () =>
          [...new Set(text(random, "abcdef", 4))].filter(() => pick(random, [true, false])),
        ),
      }),
      ({ keep, steps }) => {
        const w = watch(keep);
        let seen = 0;
        for (const step of steps) {
          w.setVisible(step);
          for (const key of w.evicted.slice(seen)) expect(step).not.toContain(key);
          seen = w.evicted.length;
        }
        w.dispose();
      },
    );
  });
});
