import { describe, expect, test } from "bun:test";
import { harness } from "./harness";

describe("patch", () => {
  test("patch changes the value at once and notifies subscribers", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const seen: (string | undefined)[] = [];
    cache.subscribe("a", (state) => seen.push(state.data));
    cache.patch("a", (current) => `${current}+`);
    expect(seen).toEqual(["base+"]);
  });

  test("a fetch that started before the patch cannot overwrite it", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "base");
    void cache.refresh("a");
    cache.patch("a", () => "patched");
    calls[0]?.resolve("server");
    await flush();
    expect(cache.read("a")).toBe("patched");
  });

  test("a patch during a revalidation restarts it", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "base");
    cache.subscribe("a", () => {});
    cache.invalidate("a");
    cache.patch("a", () => "patched");
    expect(calls).toHaveLength(2);
    calls[1]?.resolve("server");
    await flush();
    expect(cache.state("a")).toMatchObject({ data: "server", stale: false });
  });

  test("a patch during an age refetch does not make old data fresh", async () => {
    const { cache, calls, clock, flush } = harness({ maxAgeMs: 1_000 });
    cache.set("a", "base");
    clock.advance(5_000);
    cache.subscribe("a", () => {});
    cache.patch("a", () => "patched");
    expect(calls).toHaveLength(2);
    calls[1]?.resolve("server");
    await flush();
    expect(cache.read("a")).toBe("server");
  });

  test("a patch does not make old data fresh", () => {
    const { cache, clock } = harness({ maxAgeMs: 1_000 });
    cache.set("a", "base");
    clock.advance(5_000);
    cache.patch("a", () => "patched");
    expect(cache.outdated("a")).toBe(true);
  });

  test("modify leaves a pending layer out of the data underneath", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const layer = cache.overlay("a", (data) => `${data}?`);
    cache.modify("a", (data) => `${data}!`);
    expect(cache.read("a")).toBe("base!?");
    layer.discard();
    expect(cache.read("a")).toBe("base!");
  });

  test.each([
    "modify",
    "commit",
  ] as const)("%s during a first load drops the older response", async (write) => {
    const { cache, calls, flush } = harness();
    const waiting = cache.ensure("a");
    if (write === "modify") cache.modify("a", (data) => data);
    else cache.overlay("a", (data) => data).commit();
    calls[0]?.resolve("before the write");
    await flush();
    expect(cache.read("a")).toBeUndefined();
    calls[1]?.resolve("after the write");
    expect(await waiting).toBe("after the write");
  });

  test("modify reloads a failed key that someone is reading", async () => {
    const { cache, calls, flush } = harness({ retry: { retries: 0 } });
    cache.subscribe("a", () => {});
    calls[0]?.reject(new Error("offline"));
    await flush();
    cache.modify("a", (data) => data);
    expect(calls).toHaveLength(2);
  });

  test("modify ignores a key without data", () => {
    const { cache } = harness();
    cache.modify("a", () => "new");
    expect(cache.entries()).toEqual([]);
  });
});

describe("overlay", () => {
  test("shows at once and discard returns to the data underneath", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const layer = cache.overlay("a", (data) => `${data}+`);
    expect(cache.read("a")).toBe("base+");
    layer.discard();
    expect(cache.read("a")).toBe("base");
  });

  test("discard keeps data that arrived while it was showing", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "base");
    const layer = cache.overlay("a", (data) => `${data}+`);
    void cache.refresh("a");
    calls[0]?.resolve("server");
    await flush();
    expect(cache.read("a")).toBe("server+");
    layer.discard();
    expect(cache.read("a")).toBe("server");
  });

  test("discarding one layer keeps the others", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const first = cache.overlay("a", (data) => `${data}1`);
    cache.overlay("a", (data) => `${data}2`);
    first.discard();
    expect(cache.read("a")).toBe("base2");
  });

  test("commit writes the change into the data, once", () => {
    const { cache } = harness();
    cache.set("a", "base");
    const layer = cache.overlay("a", (data) => `${data}+`);
    layer.commit();
    layer.commit();
    layer.discard();
    expect(cache.read("a")).toBe("base+");
  });

  test("commit restarts a fetch that may predate the write", async () => {
    const { cache, calls, flush } = harness();
    cache.set("a", "base");
    const layer = cache.overlay("a", () => "mine");
    void cache.refresh("a");
    layer.commit();
    expect(calls).toHaveLength(2);
    calls[0]?.resolve("stale");
    await flush();
    expect(cache.read("a")).toBe("mine");
  });

  test("waits for data before it applies", async () => {
    const { cache, calls, flush } = harness();
    cache.overlay("a", (data) => `${data}+`);
    expect(cache.read("a")).toBeUndefined();
    void cache.ensure("a");
    calls[0]?.resolve("server");
    await flush();
    expect(cache.read("a")).toBe("server+");
  });

  test("an entry with a layer is not collected", () => {
    const { cache, clock } = harness({ gcMs: 1_000 });
    cache.set("a", "base");
    cache.overlay("a", () => "mine");
    clock.advance(10_000);
    expect(cache.read("a")).toBe("mine");
  });
});

describe("structural sharing", () => {
  type Row = { id: string; name: string };

  test("an identical refetch keeps the same data", async () => {
    const { cache, calls, flush } = harness<Row[]>();
    cache.set("a", [{ id: "1", name: "x" }]);
    const before = cache.read("a");
    void cache.refresh("a");
    calls[0]?.resolve([{ id: "1", name: "x" }]);
    await flush();
    expect(cache.read("a")).toBe(before);
  });

  test("unchanged rows survive by id, even when rows are added in front", async () => {
    const { cache, calls, flush } = harness<Row[]>();
    cache.set("a", [{ id: "1", name: "x" }]);
    const row = cache.read("a")?.[0];
    void cache.refresh("a");
    calls[0]?.resolve([
      { id: "2", name: "new" },
      { id: "1", name: "x" },
    ]);
    await flush();
    expect(cache.read("a")?.[1]).toBe(row);
  });
});

describe("abort", () => {
  test("a fetch that read its signal is aborted when the last subscriber leaves", async () => {
    const { cache, calls, flush } = harness();
    cache.subscribe("a", () => {})();
    await flush();
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(cache.state("a").status).toBe("idle");
  });

  test("a caller awaiting ensure keeps the fetch alive", async () => {
    const { cache, calls, flush } = harness();
    const waiting = cache.ensure("a");
    cache.subscribe("a", () => {})();
    await flush();
    calls[0]?.resolve("v");
    expect(await waiting).toBe("v");
  });
});
