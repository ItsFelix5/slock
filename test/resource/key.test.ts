import { describe, expect, test } from "bun:test";
import { createResourceCache } from "../../packages/resource/src/cache";
import { stableKey } from "../../packages/resource/src/key";
import { createFakeClock, manualLoader } from "../support/resource";

describe("stableKey", () => {
  test("object property order does not change the key", () => {
    expect(stableKey({ a: 1, b: { c: 2, d: 3 } })).toBe(stableKey({ b: { d: 3, c: 2 }, a: 1 }));
  });

  test("array order and values do change the key", () => {
    expect(stableKey(["a", 1])).not.toBe(stableKey([1, "a"]));
    expect(stableKey(["a", 1])).not.toBe(stableKey(["a", "1"]));
  });

  test("equal object keys share one entry and one request", () => {
    const loader = manualLoader<{ id: string; page: number }, string>();
    const cache = createResourceCache({ env: createFakeClock(), load: loader.load });
    cache.subscribe({ id: "a", page: 1 }, () => {});
    cache.subscribe({ page: 1, id: "a" }, () => {});
    expect(loader.calls).toHaveLength(1);
  });
});
