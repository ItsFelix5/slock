import { describe, expect, test } from "bun:test";
import type { RichTextBlock } from "@slock/types";
import { emojiOnlyBlockMessage } from "../../../../../packages/plugins/src/messages/client/lib/emojiOnlyMessage";

describe("emojiOnlyBlockMessage", () => {
  const emoji: RichTextBlock["elements"][number] = {
    elements: [{ name: "wave", type: "emoji" }],
    type: "rich_text_section",
  };

  test("counts emoji", () => {
    expect(emojiOnlyBlockMessage([{ elements: [emoji], type: "rich_text" }])).toBe(1);
  });

  test("a divider means the message is more than emoji", () => {
    const elements: RichTextBlock["elements"] = [emoji, { type: "rich_text_divider" }];
    expect(emojiOnlyBlockMessage([{ elements, type: "rich_text" }])).toBe(0);
  });
});
