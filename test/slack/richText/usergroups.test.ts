import { describe, expect, test } from "bun:test";
import type { Block, RichTextInlineElement } from "@slock/types";
import { usergroupIdsOf } from "../../../packages/plugins/src/ping-warning/client/ThreadPingNotice";

const block = (elements: RichTextInlineElement[]): Block => ({
  elements: [{ elements, type: "rich_text_section" }],
  type: "rich_text",
});

describe("usergroupIdsOf", () => {
  test("collects unique ids from rich text in order", () => {
    const blocks = [
      block([
        { type: "usergroup", usergroup_id: "S2" },
        { text: "x", type: "text" },
        { type: "usergroup", usergroup_id: "S1" },
        { type: "usergroup", usergroup_id: "S2" },
      ]),
    ];
    expect(usergroupIdsOf({ blocks })).toEqual(["S2", "S1"]);
  });

  test("reaches into nested lists and quotes", () => {
    const nested: Block = {
      elements: [
        {
          elements: [
            { elements: [{ type: "usergroup", usergroup_id: "S9" }], type: "rich_text_section" },
          ],
          style: "bullet",
          type: "rich_text_list",
        },
      ],
      type: "rich_text",
    };
    expect(usergroupIdsOf({ blocks: [nested] })).toEqual(["S9"]);
  });

  test("falls back to text mentions only when blocks have none", () => {
    expect(usergroupIdsOf({ text: "<!subteam^S1|@team> and <!subteam^S2>" })).toEqual(["S1", "S2"]);
    expect(usergroupIdsOf({ blocks: [block([])], text: "<!subteam^S1>" })).toEqual(["S1"]);
    expect(
      usergroupIdsOf({
        blocks: [block([{ type: "usergroup", usergroup_id: "S5" }])],
        text: "<!subteam^S1>",
      }),
    ).toEqual(["S5"]);
  });

  test("handles empty content", () => {
    expect(usergroupIdsOf({})).toEqual([]);
    expect(usergroupIdsOf({ text: "<!subteam^lower>" })).toEqual([]);
  });
});
