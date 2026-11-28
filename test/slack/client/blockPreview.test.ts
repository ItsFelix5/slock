import { describe, expect, test } from "bun:test";
import type { Block } from "@slock/types";
import { blockPreviewText } from "../../../packages/slack/src/client/blockPreview";

describe("blockPreviewText", () => {
  test("combines rich text and headers and skips other blocks", () => {
    const blocks: Block[] = [
      { text: { text: "Title", type: "plain_text" }, type: "header" },
      { type: "divider" },
      {
        elements: [{ elements: [{ text: "body", type: "text" }], type: "rich_text_section" }],
        type: "rich_text",
      },
    ];
    expect(blockPreviewText(blocks)).toBe("Title\nbody");
  });

  test("returns an empty string without blocks", () => {
    expect(blockPreviewText(undefined)).toBe("");
    expect(blockPreviewText([])).toBe("");
  });
});
