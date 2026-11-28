import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { flush } from "solid-js";
import { A, B, reject, section, settle, startChannels, succeed } from "./channelsHarness";

let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
  errors = spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errors.mockRestore());

describe("star toggle", () => {
  test("the star shows at once, stays through success and never flickers", async () => {
    const h = await startChannels({});
    const seen = h.observe(() => h.store.isChannelStarred(A));
    flush();
    const toggled = h.store.toggleChannelStar(A);
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(true);
    expect(h.store.isChannelPlacementPending(A)).toBe(true);
    h.answer("/channels/C1/star", succeed());
    expect(await toggled).toBe("applied");
    await settle();
    expect(seen).toEqual([false, true]);
    expect(h.store.isChannelStarred(A)).toBe(true);
    expect(h.store.isChannelPlacementPending(A)).toBe(false);
    h.stop();
  });

  test("a failed star reverts by itself and flashes once", async () => {
    const h = await startChannels({});
    const seen = h.observe(() => h.store.isChannelStarred(A));
    flush();
    const toggled = h.store.toggleChannelStar(A);
    await settle();
    h.answer("/channels/C1/star", reject());
    expect(await toggled).toBe("failed");
    await settle();
    expect(seen).toEqual([false, true, false]);
    expect(h.store.isChannelPlacementPending(A)).toBe(false);
    expect(h.flashes).toEqual(["Failed to update star."]);
    h.stop();
  });

  test("a failed unstar keeps the star", async () => {
    const h = await startChannels({ starred: [A] });
    const toggled = h.store.toggleChannelStar(A);
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(false);
    h.answer("/channels/C1/star", reject());
    expect(await toggled).toBe("failed");
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(true);
    h.stop();
  });

  test("a second click while the first is in flight is refused", async () => {
    const h = await startChannels({});
    const first = h.store.toggleChannelStar(A);
    await settle();
    expect(await h.store.toggleChannelStar(A)).toBe("failed");
    expect(h.requests("/channels/C1/star")).toBe(1);
    h.answer("/channels/C1/star", succeed());
    expect(await first).toBe("applied");
    await settle();
    const unstar = h.store.toggleChannelStar(A);
    await settle();
    h.answer("/channels/C1/star", succeed());
    expect(await unstar).toBe("applied");
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(false);
    h.stop();
  });

  test("one channel failing does not undo another starring at the same time", async () => {
    const h = await startChannels({});
    const failing = h.store.toggleChannelStar(A);
    await settle();
    expect(h.store.toggleChannelStar(B)).resolves.toBe("failed");
    h.answer("/channels/C1/star", reject());
    expect(await failing).toBe("failed");
    await settle();
    const working = h.store.toggleChannelStar(B);
    await settle();
    h.answer("/channels/C2/star", succeed());
    expect(await working).toBe("applied");
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(false);
    expect(h.store.isChannelStarred(B)).toBe(true);
    h.stop();
  });

  test("starring takes the channel out of its section and holds section edits meanwhile", async () => {
    const h = await startChannels({ sections: [section("S1", [A])] });
    const toggled = h.store.toggleChannelStar(A);
    await settle();
    expect(h.store.isSectionStructurePending()).toBe(true);
    h.answer("/channels/C1/star", succeed());
    await settle();
    h.server.sections = [section("S1")];
    h.answer("/sections/S1/channels", succeed());
    expect(await toggled).toBe("applied");
    await settle();
    expect(h.store.isSectionStructurePending()).toBe(false);
    expect(h.store.sections()?.[0]?.channelIds).toEqual([]);
    expect(h.store.isChannelStarred(A)).toBe(true);
    h.stop();
  });

  test("a section removal that fails after starring keeps the star and warns", async () => {
    const h = await startChannels({ sections: [section("S1", [A])] });
    const toggled = h.store.toggleChannelStar(A);
    await settle();
    h.answer("/channels/C1/star", succeed());
    await settle();
    h.answer("/sections/S1/channels", reject());
    expect(await toggled).toBe("applied-with-warning");
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(true);
    expect(h.store.isSectionStructurePending()).toBe(false);
    h.stop();
  });
});

describe("move to section", () => {
  test("the channel moves at once and moves back when the request fails", async () => {
    const h = await startChannels({ sections: [section("S1", [A]), section("S2")] });
    const moved = h.store.placeChannel(A, { id: "S2", kind: "section" });
    await settle();
    expect(h.store.isChannelPlacedAt(A, { id: "S2", kind: "section" })).toBe(true);
    expect(h.store.isChannelJustPlaced(A)).toBe(true);
    h.answer("/sections/S1/channels", reject());
    expect(await moved).toBe("failed");
    await settle();
    expect(h.store.isChannelJustPlaced(A)).toBe(true);
    expect(h.store.isChannelPlacedAt(A, { id: "S1", kind: "section" })).toBe(true);
    h.stop();
  });

  test("moving a starred channel home only removes the star", async () => {
    const h = await startChannels({ starred: [A] });
    const moved = h.store.placeChannel(A, { kind: "home" });
    await settle();
    h.answer("/channels/C1/star", succeed());
    expect(await moved).toBe("applied");
    await settle();
    expect(h.store.isChannelPlacedAt(A, { kind: "home" })).toBe(true);
    h.stop();
  });

  test("moving a channel where it already is sends nothing", async () => {
    const h = await startChannels({ sections: [section("S1", [A])] });
    expect(await h.store.placeChannel(A, { id: "S1", kind: "section" })).toBe("applied");
    expect(h.requests("/sections/S1/channels")).toBe(0);
    h.stop();
  });

  test("a failed unstar after the move brings the star back", async () => {
    const h = await startChannels({ sections: [section("S1"), section("S2")], starred: [A] });
    const seen = h.observe(() => h.store.isChannelStarred(A));
    flush();
    const moved = h.store.placeChannel(A, { id: "S2", kind: "section" });
    await settle();
    h.answer("/sections/S2/channels", succeed());
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(false);
    h.answer("/channels/C1/star", reject());
    expect(await moved).toBe("applied-with-warning");
    await settle();
    expect(seen).toEqual([true, false, true]);
    expect(h.store.isChannelPlacementPending(A)).toBe(false);
    expect(h.store.isSectionStructurePending()).toBe(false);
    h.stop();
  });

  test("a failed move leaves nothing pending and a second move can run", async () => {
    const h = await startChannels({ sections: [section("S1", [A]), section("S2")] });
    const moved = h.store.placeChannel(A, { id: "S2", kind: "section" });
    await settle();
    h.answer("/sections/S1/channels", reject());
    expect(await moved).toBe("failed");
    await settle();
    expect(h.store.isChannelPlacementPending(A)).toBe(false);
    expect(h.store.isSectionStructurePending()).toBe(false);
    const again = h.store.placeChannel(A, { id: "S2", kind: "section" });
    await settle();
    expect(h.requests("/sections/S1/channels")).toBe(2);
    h.answer("/sections/S1/channels", succeed());
    await settle();
    h.answer("/sections/S2/channels", succeed());
    expect(await again).toBe("applied");
    h.stop();
  });
});

describe("starred list", () => {
  test("a newer list replaces the one shown first", async () => {
    const h = await startChannels({ starred: [A] });
    expect(h.store.isChannelStarred(A)).toBe(true);
    h.server.starred = [B];
    await h.refreshStarred();
    await settle();
    expect(h.store.isChannelStarred(A)).toBe(false);
    expect(h.store.isChannelStarred(B)).toBe(true);
    h.stop();
  });
});
