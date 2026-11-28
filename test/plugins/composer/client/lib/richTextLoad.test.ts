import { describe, expect, test } from "bun:test";
import type { Block } from "@slock/types";
import { INLINE_STYLE_FORMATS } from "@slock/ui/editor/inlineFormats";
import type { DeltaOp } from "../../../../../packages/plugins/src/composer/client/lib/deltaLines";
import { buildRichTextBlocks } from "../../../../../packages/plugins/src/composer/client/lib/richTextBuild";
import { richTextDeltaOps } from "../../../../../packages/plugins/src/composer/client/lib/richTextLoad";
import { forAll, int, pick, type Random, text } from "../../../../support/core";

const MARKS = INLINE_STYLE_FORMATS;
const BLOCKS = [
  undefined,
  { blockquote: true },
  { list: "bullet" },
  { list: "ordered" },
  { "code-block": true },
  { header: 2 },
  { context: true },
] as const;

function lineOps(random: Random): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (let i = int(random, 0, 4); i > 0; i--) {
    const kind = int(random, 0, 5);
    if (kind === 0) ops.push({ insert: { emoji: { name: pick(random, ["tada", "+1", "wave"]) } } });
    else if (kind === 1)
      ops.push({ insert: { mention: { id: "here", kind: "special", name: "here" } } });
    else if (kind === 2)
      ops.push({ insert: { date: { fallback: "d", format: "{date}", ts: int(random, 1, 99) } } });
    else {
      const attributes =
        kind === 3
          ? { [pick(random, MARKS)]: true }
          : kind === 4
            ? { link: "https://a.b/c" }
            : undefined;
      ops.push({ attributes, insert: text(random, "ab \u{1F600}א&<>", 10) || "x" });
    }
  }
  return ops;
}

function randomDoc(random: Random): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (let i = int(random, 0, 8); i > 0; i--) {
    if (random() < 0.1) {
      ops.push({ insert: { divider: true } }, { insert: "\n" });
      continue;
    }
    ops.push(...lineOps(random));
    ops.push({ attributes: BLOCKS[int(random, 0, BLOCKS.length - 1)], insert: "\n" });
  }
  return ops;
}

function roundTrip(blocks: Block[]): Block[] {
  return buildRichTextBlocks(richTextDeltaOps(blocks));
}

describe("richTextDeltaOps", () => {
  test("loads a slack message into editable lines", () => {
    const blocks: Block[] = [
      {
        elements: [
          {
            elements: [
              { style: { bold: true }, text: "hi", type: "text" },
              { name: "tada", type: "emoji" },
            ],
            type: "rich_text_section",
          },
          { elements: [{ text: "code", type: "text" }], type: "rich_text_preformatted" },
          {
            elements: [{ elements: [{ text: "a", type: "text" }], type: "rich_text_section" }],
            offset: 2,
            style: "ordered",
            type: "rich_text_list",
          },
        ],
        type: "rich_text",
      },
    ];
    expect(richTextDeltaOps(blocks)).toEqual([
      { attributes: { bold: true }, insert: "hi" },
      { insert: { emoji: { name: "tada" } } },
      { insert: "\n" },
      { insert: "code" },
      { attributes: { "code-block": true }, insert: "\n" },
      { insert: "a" },
      { attributes: { list: "ordered", listOffset: 2 }, insert: "\n" },
    ]);
  });

  test("a tag element becomes a tag attribute and defaults to gray", () => {
    const blocks: Block[] = [
      {
        elements: [
          {
            elements: [
              { color: "red", style: { bold: true }, text: "a", type: "tag" },
              { text: "b", type: "tag" },
            ],
            type: "rich_text_section",
          },
        ],
        type: "rich_text",
      },
    ];
    expect(richTextDeltaOps(blocks)).toEqual([
      { attributes: { bold: true, tag: "red" }, insert: "a" },
      { attributes: { tag: "gray" }, insert: "b" },
      { insert: "\n" },
    ]);
  });

  test("every line of a multi line code block or quote keeps its block format", () => {
    const blocks: Block[] = [
      {
        elements: [
          { elements: [{ text: "a\nb", type: "text" }], type: "rich_text_preformatted" },
          {
            elements: [{ style: { bold: true }, text: "q1\nq2", type: "text" }],
            type: "rich_text_quote",
          },
        ],
        type: "rich_text",
      },
    ];
    expect(richTextDeltaOps(blocks)).toEqual([
      { insert: "a" },
      { attributes: { "code-block": true }, insert: "\n" },
      { insert: "b" },
      { attributes: { "code-block": true }, insert: "\n" },
      { attributes: { bold: true }, insert: "q1" },
      { attributes: { blockquote: true }, insert: "\n" },
      { attributes: { bold: true }, insert: "q2" },
      { attributes: { blockquote: true }, insert: "\n" },
    ]);
  });

  test("turns header emoji tokens into emoji embeds", () => {
    const header: Block = {
      level: 1,
      text: { emoji: true, text: "go :tada: now", type: "plain_text" },
      type: "header",
    };
    expect(richTextDeltaOps([header])).toEqual([
      { insert: "go " },
      { insert: { emoji: { name: "tada" } } },
      { insert: " now" },
      { attributes: { header: 1 }, insert: "\n" },
    ]);
  });

  test("keeps unknown broadcast ranges as plain text", () => {
    const blocks: Block[] = [
      {
        elements: [
          { elements: [{ range: "everyone", type: "broadcast" }], type: "rich_text_section" },
        ],
        type: "rich_text",
      },
    ];
    expect(richTextDeltaOps(blocks)[0]).toEqual({ insert: "@everyone" });
  });

  test("empty text elements are skipped", () => {
    const blocks: Block[] = [
      {
        elements: [{ elements: [{ text: "", type: "text" }], type: "rich_text_section" }],
        type: "rich_text",
      },
    ];
    expect(richTextDeltaOps(blocks)).toEqual([{ insert: "\n" }]);
  });
});

describe("editor to slack and back", () => {
  test("blocks survive a load and rebuild", () => {
    forAll(randomDoc, (ops) => {
      const blocks = buildRichTextBlocks(ops);
      expect(roundTrip(blocks)).toEqual(blocks);
    });
  });

  test("a second round trip changes nothing", () => {
    forAll(randomDoc, (ops) => {
      const once = roundTrip(buildRichTextBlocks(ops));
      expect(roundTrip(once)).toEqual(once);
    });
  });
});
