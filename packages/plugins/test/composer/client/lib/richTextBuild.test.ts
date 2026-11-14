import { describe, expect, test } from "bun:test";
import { narrowByType } from "@slock/core";
import { forAll, int, type Random, text } from "@slock/core/testing";
import type { Block, HeaderBlock, RichTextBlock } from "@slock/types";
import type { DeltaOp } from "../../../../src/composer/client/lib/deltaLines";
import { HEADER_MAX_LENGTH } from "../../../../src/composer/client/lib/headerLimit";
import { buildRichTextBlocks } from "../../../../src/composer/client/lib/richTextBuild";
import { INVISIBLE_LABEL } from "../../../../src/message-links/client/api/replyLink";

const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const isWellFormed = (value: string) => !LONE_SURROGATE_RE.test(value);
const block = (attributes?: Record<string, unknown>): DeltaOp => ({ attributes, insert: "\n" });
const mention = (kind: string, id: string, name = id): DeltaOp => ({
  insert: { mention: { id, kind, name } },
});

function richText(blocks: Block[]): RichTextBlock {
  const [first] = blocks;
  const found = first && narrowByType<Block, RichTextBlock>(first, "rich_text");
  if (!found) throw new Error(`expected rich_text, got ${first?.type}`);
  return found;
}

describe("buildRichTextBlocks", () => {
  test("empty editor still sends one empty section", () => {
    expect(buildRichTextBlocks([{ insert: "\n" }])).toEqual([
      {
        elements: [{ elements: [{ text: "", type: "text" }], type: "rich_text_section" }],
        type: "rich_text",
      },
    ]);
  });

  test("lines become one section joined by newline elements", () => {
    const [section] = richText(buildRichTextBlocks([{ insert: "a\nb\n" }])).elements;
    expect(section).toEqual({
      elements: [
        { style: undefined, text: "a", type: "text" },
        { text: "\n", type: "text" },
        { style: undefined, text: "b", type: "text" },
      ],
      type: "rich_text_section",
    });
  });

  test("marks and links map to styles and link elements", () => {
    const ops: DeltaOp[] = [
      { attributes: { bold: true, code: true }, insert: "x" },
      { attributes: { link: "https://a.b", strike: true }, insert: "go" },
      { insert: "\n" },
    ];
    const [section] = richText(buildRichTextBlocks(ops)).elements;
    expect(section).toMatchObject({
      elements: [
        { style: { bold: true, code: true }, text: "x", type: "text" },
        { style: { strike: true }, text: "go", type: "link", url: "https://a.b" },
      ],
    });
  });

  test("embeds map to slack elements", () => {
    const ops: DeltaOp[] = [
      mention("user", "U1"),
      mention("channel", "C1", "dev"),
      mention("special", "here"),
      mention("special", "everyone"),
      mention("usergroup", "S1"),
      { insert: { emoji: { name: "tada" } } },
      { insert: { date: { fallback: "", format: "{date}", ts: 9 } } },
      { insert: "\n" },
    ];
    const [section] = richText(buildRichTextBlocks(ops)).elements;
    expect(section).toEqual({
      elements: [
        { type: "user", user_id: "U1" },
        { channel_id: "C1", type: "channel" },
        { range: "here", type: "broadcast" },
        { type: "usergroup", usergroup_id: "S1" },
        { name: "tada", type: "emoji" },
        { fallback: undefined, format: "{date}", timestamp: 9, type: "date" },
      ],
      type: "rich_text_section",
    });
  });

  test("message links with a permalink become message mentions, others plain links", () => {
    const url = "https://one.slack.com/archives/C1/p1700000000123456?thread_ts=1699999999.000100";
    const [section] = richText(
      buildRichTextBlocks([
        mention("messagelink", url),
        mention("messagelink", "https://x.y"),
        block(),
      ]),
    ).elements;
    expect(section).toMatchObject({
      elements: [
        {
          channel_id: "C1",
          message_ts: "1700000000.123456",
          thread_ts: "1699999999.000100",
          type: "message_mention",
        },
        { type: "link", url: "https://x.y" },
      ],
    });
  });

  test("a leading message mention gets the invisible label", () => {
    const url = "https://one.slack.com/archives/C1/p1700000000123456";
    const [section] = richText(
      buildRichTextBlocks([mention("messagelink", url), { insert: " hi" }, block()]),
    ).elements;
    expect(section).toMatchObject({
      elements: [{ text: INVISIBLE_LABEL, type: "message_mention" }, { text: " hi" }],
    });
  });

  test("consecutive code lines merge into one preformatted block", () => {
    const code = { "code-block": true };
    const ops: DeltaOp[] = [
      { insert: "a" },
      block(code),
      { insert: "b" },
      block(code),
      { insert: "after\n" },
    ];
    expect(richText(buildRichTextBlocks(ops)).elements).toMatchObject([
      { elements: [{ text: "a\nb", type: "text" }], type: "rich_text_preformatted" },
      { type: "rich_text_section" },
    ]);
  });

  test("lists split on style change and keep the offset", () => {
    const ops: DeltaOp[] = [
      { insert: "a" },
      block({ list: "ordered", listOffset: 3 }),
      { insert: "b" },
      block({ list: "ordered" }),
      { insert: "c" },
      block({ list: "bullet" }),
    ];
    expect(richText(buildRichTextBlocks(ops)).elements).toMatchObject([
      { offset: 3, style: "ordered", type: "rich_text_list" },
      { style: "bullet", type: "rich_text_list" },
    ]);
    const [ordered] = richText(buildRichTextBlocks(ops)).elements;
    expect(ordered).toMatchObject({
      elements: [{ type: "rich_text_section" }, { type: "rich_text_section" }],
    });
  });

  test("quote lines merge and an empty quote keeps an empty text element", () => {
    const quote = { blockquote: true };
    expect(
      richText(buildRichTextBlocks([{ insert: "a" }, block(quote), { insert: "b" }, block(quote)]))
        .elements,
    ).toMatchObject([
      { elements: [{ text: "a" }, { text: "\n" }, { text: "b" }], type: "rich_text_quote" },
    ]);
    expect(richText(buildRichTextBlocks([block(quote)])).elements).toMatchObject([
      { elements: [{ text: "", type: "text" }], type: "rich_text_quote" },
    ]);
  });

  test("headers, context and dividers split the rich text block", () => {
    const ops: DeltaOp[] = [
      { insert: "before" },
      block(),
      { insert: "Title " },
      mention("user", "U1", "ada"),
      { insert: { emoji: { name: "tada" } } },
      block({ header: 2 }),
      { insert: "small" },
      block({ context: true }),
      { insert: { divider: true } },
      block(),
      { insert: "after\n" },
    ];
    const blocks = buildRichTextBlocks(ops);
    expect(blocks.map((b) => b.type)).toEqual([
      "rich_text",
      "header",
      "context",
      "divider",
      "rich_text",
    ]);
    expect(blocks[1]).toEqual({
      level: 2,
      text: { emoji: true, text: "Title @ada:tada:", type: "plain_text" },
      type: "header",
    });
  });

  test("a divider inline in a line splits it", () => {
    const ops: DeltaOp[] = [{ insert: "a" }, { insert: { divider: true } }, { insert: "b\n" }];
    expect(buildRichTextBlocks(ops).map((b) => b.type)).toEqual([
      "rich_text",
      "divider",
      "rich_text",
    ]);
  });

  test("header text is cut at the limit without splitting a surrogate pair", () => {
    const title = `${"a".repeat(HEADER_MAX_LENGTH - 1)}😀tail`;
    const [first] = buildRichTextBlocks([{ insert: title }, block({ header: 1 })]);
    const header = first && narrowByType<Block, HeaderBlock>(first, "header");
    if (!header) throw new Error("expected header");
    const sent = header.text.text;
    expect(sent.length).toBeLessThanOrEqual(HEADER_MAX_LENGTH);
    expect(isWellFormed(sent)).toBe(true);
  });
});

const ALPHABET = "ab \u{1F600}א <>&*";

function randomDoc(random: Random): DeltaOp[] {
  const ops: DeltaOp[] = [];
  const attributesList = [
    undefined,
    { blockquote: true },
    { list: "bullet" },
    { list: "ordered" },
    { "code-block": true },
    { header: 1 },
    { context: true },
  ];
  for (let i = int(random, 0, 8); i > 0; i--) {
    ops.push({ insert: text(random, ALPHABET, 20) });
    if (random() < 0.3) ops.push(mention("user", `U${int(random, 1, 5)}`));
    ops.push(block(attributesList[int(random, 0, attributesList.length - 1)]));
  }
  return ops;
}

describe("properties", () => {
  test("always returns at least one block and never an empty rich_text", () => {
    forAll(randomDoc, (ops) => {
      const blocks = buildRichTextBlocks(ops);
      expect(blocks.length).toBeGreaterThan(0);
      for (const current of blocks) {
        const richBlock = narrowByType<Block, RichTextBlock>(current, "rich_text");
        if (richBlock) expect(richBlock.elements.length).toBeGreaterThan(0);
        const headerBlock = narrowByType<Block, HeaderBlock>(current, "header");
        if (headerBlock) expect(isWellFormed(headerBlock.text.text)).toBe(true);
      }
    });
  });

  test("is deterministic", () => {
    forAll(randomDoc, (ops) => {
      expect(buildRichTextBlocks(ops)).toEqual(buildRichTextBlocks(ops));
    });
  });
});
