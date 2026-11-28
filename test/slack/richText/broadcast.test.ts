import { describe, expect, test } from "bun:test";
import type { Block } from "@slock/types";
import { broadcastRangeOf } from "../../../packages/slack/src/richText/broadcast";

function richText(elements: unknown[]): Block {
  return { elements: [{ elements, type: "rich_text_section" }], type: "rich_text" } as Block;
}

describe("broadcastRangeOf", () => {
  test("finds a broadcast element in rich text", () => {
    const block = richText([
      { text: "hey ", type: "text" },
      { range: "channel", type: "broadcast" },
    ]);
    expect(broadcastRangeOf({ blocks: [block] })).toBe("channel");
  });

  test("finds one nested inside a quote", () => {
    const block: Block = {
      elements: [
        {
          elements: [
            { elements: [{ range: "here", type: "broadcast" }], type: "rich_text_section" },
          ],
          type: "rich_text_quote",
        },
      ],
      type: "rich_text",
    };
    expect(broadcastRangeOf({ blocks: [block] })).toBe("here");
  });

  test("ignores unknown ranges and other block types", () => {
    expect(
      broadcastRangeOf({ blocks: [richText([{ range: "nobody", type: "broadcast" }])] }),
    ).toBeUndefined();
    expect(broadcastRangeOf({ blocks: [{ type: "divider" } as Block] })).toBeUndefined();
  });

  test("reads the legacy text form when blocks have none", () => {
    expect(broadcastRangeOf({ text: "ping <!everyone|everyone>" })).toBe("everyone");
    expect(broadcastRangeOf({ text: "<!here>" })).toBe("here");
    expect(broadcastRangeOf({ blocks: [richText([])], text: "<!channel>" })).toBe("channel");
  });

  test("other special mentions are not broadcasts", () => {
    expect(broadcastRangeOf({ text: "<!subteam^S1> <!date^1^x|y>" })).toBeUndefined();
    expect(broadcastRangeOf({})).toBeUndefined();
  });

  test("blocks win over text", () => {
    const block = richText([{ range: "here", type: "broadcast" }]);
    expect(broadcastRangeOf({ blocks: [block], text: "<!channel>" })).toBe("here");
  });
});
