import { describe, expect, test } from "bun:test";
import type { RichTextBlock, RichTextInlineElement, RichTextSection } from "@slock/types";
import {
  isRichTextSubBlock,
  richTextBlocksToPlainText,
} from "../../../packages/slack/src/richText/plainText";
import { forAll, int, pick, text } from "../../support/core";

const section = (...elements: RichTextInlineElement[]): RichTextSection => ({
  elements,
  type: "rich_text_section",
});
const rich = (...elements: RichTextBlock["elements"]): RichTextBlock => ({
  elements,
  type: "rich_text",
});

describe("richTextBlocksToPlainText", () => {
  test.each<[RichTextInlineElement, string]>([
    [{ text: "plain", type: "text" }, "plain"],
    [{ text: "", type: "link", url: "https://a.b" }, "https://a.b"],
    [{ text: "site", type: "link", url: "https://a.b" }, "site"],
    [{ name: "wave", type: "emoji" }, ":wave:"],
    [{ type: "user", user_id: "U1" }, "<@U1>"],
    [{ channel_id: "C1", type: "channel" }, "<#C1>"],
    [{ type: "usergroup", usergroup_id: "S1" }, "<!subteam^S1>"],
    [{ range: "here", type: "broadcast" }, "@here"],
  ])("inline element %#", (element, expected) => {
    expect(richTextBlocksToPlainText([rich(section(element))], null)).toBe(expected);
  });

  test("sections join with newlines and the result is trimmed", () => {
    const block = rich(
      section({ text: "  one", type: "text" }),
      section({ text: "two  ", type: "text" }),
    );
    expect(richTextBlocksToPlainText([block], null)).toBe("one\ntwo");
  });

  test("list items join with spaces", () => {
    const block = rich({
      elements: [section({ text: "a", type: "text" }), section({ text: "b", type: "text" })],
      style: "bullet",
      type: "rich_text_list",
    });
    expect(richTextBlocksToPlainText([block], null)).toBe("a b");
  });

  test("quotes mix inline elements and sub blocks", () => {
    const block = rich({
      elements: [{ text: "q1 ", type: "text" }, section({ text: "q2", type: "text" })],
      type: "rich_text_quote",
    });
    expect(richTextBlocksToPlainText([block], null)).toBe("q1 q2");
  });

  test("text order is preserved for random sections", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 0, 6) }, () => ({
          kind: pick(random, ["text", "emoji", "user"] as const),
          value: text(random, "abc😀 ", 5),
        })),
      (items) => {
        const elements = items.map((item): RichTextInlineElement => {
          if (item.kind === "text") return { text: item.value, type: "text" };
          if (item.kind === "emoji") return { name: item.value, type: "emoji" };
          return { type: "user", user_id: item.value };
        });
        const expected = items
          .map((item) =>
            item.kind === "text"
              ? item.value
              : item.kind === "emoji"
                ? `:${item.value}:`
                : `<@${item.value}>`,
          )
          .join("")
          .trim();
        expect(richTextBlocksToPlainText([rich(section(...elements))], null)).toBe(expected);
      },
    );
  });
});

test("a mention without text links to the given workspace", () => {
  const mention = rich(
    section({ channel_id: "C1", message_ts: "1.000002", type: "message_mention" }),
  );
  expect(richTextBlocksToPlainText([mention], "a.slack.com")).toBe(
    "https://a.slack.com/archives/C1/p1000002",
  );
});

describe("isRichTextSubBlock", () => {
  test("tells sub blocks from inline elements", () => {
    expect(isRichTextSubBlock(section())).toBe(true);
    expect(isRichTextSubBlock({ text: "x", type: "text" })).toBe(false);
  });
});
