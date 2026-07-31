// biome-ignore lint/correctness/noUnresolvedImports: Bun provides this built-in module to its test runner.
import { describe, expect, test } from "bun:test";
import type { Channel } from "@slock/slack-api";
import { buildCategories } from "../sidebarCategories";

describe("buildCategories section fallback", () => {
  test("keeps channels usable while custom sections are unavailable", () => {
    const channels = [
      { id: "C1", name: "general", private: false, topic: "", unread: false },
      { id: "C2", name: "project", private: false, topic: "", unread: false },
    ] satisfies Channel[];

    const categories = buildCategories(
      channels,
      () => undefined,
      () => false,
      () => new Set(),
      {},
      () => false,
      () => false,
      () => false,
      () => false,
    );

    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Channels");
    expect(categories[0]?.channels.map((channel) => channel.id)).toEqual(["C1", "C2"]);
  });
});
