import { describe, expect, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import { build, channel, ids, section, type World } from "./categoriesFixtures";

describe("buildCategories properties", () => {
  const singletonTypes = ["channels", "stars", "direct_messages", "recent_apps"];
  const sidebars = ["hid", "active", "all"] as const;

  function randomWorld(random: () => number): World {
    const channelIds = Array.from({ length: int(random, 0, 12) }, (_, i) => `C${i}`);
    const dmIds = Array.from({ length: int(random, 0, 4) }, (_, i) => `D${i}`);
    const everything = [...channelIds, ...dmIds, "GHOST"];
    const subset = () => everything.filter(() => random() < 0.3);
    return {
      channels: channelIds.map((id) => channel(id, { lastActivity: int(random, 0, 5) })),
      dms: dmIds,
      hasDms: random() < 0.5,
      left: subset(),
      muted: subset(),
      open: subset(),
      sections: [
        ...Array.from({ length: int(random, 0, 3) }, (_, i) =>
          section(`S${i}`, pick(random, ["standard", "usergroup"]), subset(), {
            sidebar: pick(random, sidebars),
            sort: random() < 0.3 ? "recent" : undefined,
          }),
        ),
        ...singletonTypes
          .filter(() => random() < 0.4)
          .map((type) => section(type, type, subset(), { sidebar: pick(random, sidebars) })),
      ],
      starred: subset(),
      unread: subset(),
      unreadsOnly: random() < 0.4,
    };
  }

  test("no channel appears twice and category ids are unique", () => {
    forAll(randomWorld, (world) => {
      const result = build(world);
      const shown = result.flatMap((c) => [...ids(c.channels), ...c.dmIds]);
      expect(new Set(shown).size).toBe(shown.length);
      expect(new Set(result.map((c) => c.id)).size).toBe(result.length);
    });
  });

  test("left channels never show", () => {
    forAll(randomWorld, (world) => {
      const shown = build(world).flatMap((c) => ids(c.channels));
      for (const id of world.left ?? []) expect(shown).not.toContain(id);
    });
  });

  test("unreads only shows only open or unread unmuted channels", () => {
    forAll(randomWorld, (world) => {
      const onlyUnreads = { ...world, unreadsOnly: true };
      const allowed = new Set([
        ...(world.open ?? []),
        ...(world.unread ?? []).filter((id) => !world.muted?.includes(id)),
      ]);
      for (const category of build(onlyUnreads))
        for (const shown of [...ids(category.channels), ...category.dmIds])
          expect(allowed.has(shown)).toBe(true);
    });
  });
});
