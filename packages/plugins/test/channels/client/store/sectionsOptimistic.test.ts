import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { flush } from "solid-js";
import { reject, section, settle, startChannels, succeed } from "./channelsHarness";

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

const sections = [section("a"), section("b"), section("c")];

async function start() {
  const h = await startChannels({ sections });
  const order = h.observe(() =>
    h.store
      .sections()
      ?.map((s) => s.id)
      .join(""),
  );
  flush();
  return { ...h, order };
}

describe("reorder", () => {
  test("the new order shows at once and survives the refresh", async () => {
    const h = await start();
    const moved = h.store.reorderChannelSection("c", "a");
    await settle();
    expect(h.store.sections()?.map((s) => s.id)).toEqual(["c", "a", "b"]);
    expect(h.store.sectionStructurePending()).toBe(true);
    h.server.sections = [section("c"), section("a"), section("b")];
    h.answer("/sections/c/order", succeed());
    expect(await moved).toBe(true);
    await settle();
    expect(h.order).toEqual(["abc", "cab"]);
    expect(h.store.sectionStructurePending()).toBe(false);
    h.stop();
  });

  test("a failed reorder snaps back by itself and flashes", async () => {
    const h = await start();
    const moved = h.store.reorderChannelSection("c", "a");
    await settle();
    h.answer("/sections/c/order", reject());
    expect(await moved).toBe(false);
    await settle();
    expect(h.order).toEqual(["abc", "cab", "abc"]);
    expect(h.store.sectionStructurePending()).toBe(false);
    expect(h.flashes).toEqual(["Failed to reorder section."]);
    h.stop();
  });

  test("a reorder while another section edit is in flight is refused", async () => {
    const h = await start();
    const renamed = h.store.renameChannelSection("a", "alpha");
    await settle();
    expect(await h.store.reorderChannelSection("c", "a")).toBe(false);
    expect(h.requests("/sections/c/order")).toBe(0);
    expect(h.store.sections()?.map((s) => s.id)).toEqual(["a", "b", "c"]);
    h.answer("/sections/a", succeed());
    expect(await renamed).toBe(true);
    await settle();
    expect(h.store.sectionStructurePending()).toBe(false);
    h.stop();
  });

  test("a no-op reorder sends nothing", async () => {
    const h = await start();
    expect(await h.store.reorderChannelSection("a", "b")).toBe(false);
    expect(await h.store.reorderChannelSection("a", "a")).toBe(false);
    expect(h.requests("/sections/")).toBe(0);
    h.stop();
  });

  test("a failed rename clears the pending lock so the next edit runs", async () => {
    const h = await start();
    const renamed = h.store.renameChannelSection("a", "alpha");
    await settle();
    h.answer("/sections/a", reject());
    expect(await renamed).toBe(false);
    await settle();
    expect(h.store.sectionStructurePending()).toBe(false);
    expect(h.flashes).toEqual(["Failed to rename section."]);
    const again = h.store.reorderChannelSection("c", "a");
    await settle();
    expect(h.requests("/sections/c/order")).toBe(1);
    h.answer("/sections/c/order", succeed());
    expect(await again).toBe(true);
    h.stop();
  });
});

describe("section preferences", () => {
  test("the filter shows at once and the saved preference replaces it", async () => {
    const h = await start();
    const seen = h.observe(() => h.store.sections()?.[0]?.sidebar);
    flush();
    const changed = h.store.setChannelSectionSidebar("a", "hid");
    await settle();
    expect(h.store.isSectionSidebarPending("a")).toBe(true);
    h.answer("/preferences/channel-sections", succeed());
    expect(await changed).toBe(true);
    await settle();
    expect(seen).toEqual(["all", "hid"]);
    expect(h.prefs()?.sectionSidebar).toEqual({ a: "hid" });
    expect(h.store.isSectionSidebarPending("a")).toBe(false);
    h.stop();
  });

  test("a failed filter change reverts by itself and flashes", async () => {
    const h = await start();
    const seen = h.observe(() => h.store.sections()?.[0]?.sidebar);
    flush();
    const changed = h.store.setChannelSectionSidebar("a", "hid");
    await settle();
    h.answer("/preferences/channel-sections", reject());
    expect(await changed).toBe(false);
    await settle();
    expect(seen).toEqual(["all", "hid", "all"]);
    expect(h.prefs()?.sectionSidebar).toEqual({});
    expect(h.store.isSectionSidebarPending("a")).toBe(false);
    expect(h.flashes).toEqual(["Failed to update section filter."]);
    h.stop();
  });

  test("collapsing shows at once and a failure expands it again", async () => {
    const h = await start();
    const collapsed = h.observe(() => h.store.collapsedIds().has("a"));
    flush();
    const failed = h.store.toggleCategoryCollapsed("a");
    await settle();
    expect(h.store.collapsedIds().has("a")).toBe(true);
    h.answer("/preferences/channel-sections", reject());
    expect(await failed).toBe(false);
    await settle();
    expect(collapsed).toEqual([false, true, false]);
    const worked = h.store.toggleCategoryCollapsed("a");
    await settle();
    h.answer("/preferences/channel-sections", succeed());
    expect(await worked).toBe(true);
    await settle();
    expect(h.store.collapsedIds().has("a")).toBe(true);
    expect(h.prefs()?.sectionCollapsed).toEqual({ a: true });
    h.stop();
  });

  test("two collapses in flight both reach the server", async () => {
    const h = await start();
    const first = h.store.toggleCategoryCollapsed("a");
    await settle();
    const second = h.store.toggleCategoryCollapsed("b");
    await settle();
    const bodies = h.requestBodies("/preferences/channel-sections");
    expect(Object.keys(JSON.parse(bodies[1] ?? "{}").sections)).toEqual(["a", "b"]);
    h.answer("/preferences/channel-sections", succeed());
    h.answer("/preferences/channel-sections", succeed());
    expect(await Promise.all([first, second])).toEqual([true, true]);
    await settle();
    expect(h.prefs()?.sectionCollapsed).toEqual({ a: true, b: true });
    h.stop();
  });
});
