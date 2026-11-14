import { describe, expect, test } from "bun:test";
import { normalizeChannelName } from "../../../src/sidebar-create/client/channelName";

describe("normalizeChannelName", () => {
  test("lowercases and turns spaces into hyphens", () => {
    expect(normalizeChannelName("Project Alpha")).toBe("project-alpha");
  });

  test("drops characters Slack rejects", () => {
    expect(normalizeChannelName("ship it!#now")).toBe("ship-itnow");
  });

  test("keeps letters, digits, hyphens and underscores in any script", () => {
    expect(normalizeChannelName("Café_2")).toBe("café_2");
  });

  test("caps the name at 80 characters", () => {
    expect(normalizeChannelName("a".repeat(100))).toHaveLength(80);
  });
});
