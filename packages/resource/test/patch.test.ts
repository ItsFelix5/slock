import { describe, expect, test } from "bun:test";
import { harness } from "./harness";

describe("patch", () => {
  test("patch changes the value at once and undo restores the value from before it", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const undo = cache.patch("a", (current) => `${current}+`);
    expect(cache.read("a")).toBe("base+");
    undo();
    expect(cache.read("a")).toBe("base");
  });

  test("rollback restores the value from before the patch even if a refetch landed in between", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "base");
    const undo = cache.patch("a", () => "optimistic");
    void cache.refresh("a");
    calls[0]?.resolve("server");
    await flush();
    expect(cache.read("a")).toBe("server");
    undo();
    expect(cache.read("a")).toBe("base");
  });

  test("a fetch that started before the patch cannot overwrite it", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "base");
    void cache.refresh("a");
    cache.patch("a", () => "optimistic");
    calls[0]?.resolve("server");
    await flush();
    expect(cache.read("a")).toBe("optimistic");
  });

  test("undo on an entry that had no data removes the data", () => {
    const { cache } = harness();
    const undo = cache.patch("a", () => "made up");
    expect(cache.read("a")).toBe("made up");
    undo();
    expect(cache.read("a")).toBeUndefined();
    expect(cache.state("a").status).toBe("idle");
  });

  test("undo runs once and later calls do nothing", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const undo = cache.patch("a", () => "patched");
    undo();
    cache.set("a", "newer");
    undo();
    expect(cache.read("a")).toBe("newer");
  });

  test("patch notifies subscribers synchronously", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const seen: (string | undefined)[] = [];
    cache.subscribe("a", (state) => seen.push(state.data));
    cache.patch("a", () => "patched");
    expect(seen).toEqual(["patched"]);
  });
});
