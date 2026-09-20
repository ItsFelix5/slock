import { parseUserProfileLink } from "@slock/blockkit";
import { INLINE_MARKS } from "@slock/ui";
import type Quill from "quill";
import { Delta } from "quill";
import type {
  Block,
  ContextBlock,
  HeaderBlock,
  RichTextBlock,
  RichTextInlineElement,
  RichTextStyle,
  RichTextSubBlock,
} from "../../../lib/api";
import { narrowByType } from "../../../lib/api";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { isRichTextSubBlock } from "../../messages/parts/messageRenderState";
import {
  type DeltaLine,
  type DeltaSegment,
  deltaLines,
  MENTION_PREFIX,
  rawLineText,
} from "./quillMentions";

const LEADING_AT_RE = /^@/;

function styleFromAttrs(
  attrs: Record<string, unknown> | undefined,
  forceBold: boolean,
): RichTextStyle | undefined {
  const style: RichTextStyle = {};
  for (const [, key] of INLINE_MARKS) if (attrs?.[key]) style[key] = true;
  if (forceBold) style.bold = true;
  return Object.keys(style).length ? style : undefined;
}

function segmentElements(segment: DeltaSegment, forceBold: boolean): RichTextInlineElement[] {
  const embed = segment.embed;
  if (embed?.mention) {
    if (embed.mention.kind === "special") {
      const range = embed.mention.id;
      return range === "channel" || range === "here" ? [{ range, type: "broadcast" }] : [];
    }
    if (embed.mention.kind === "usergroup") {
      return [{ type: "usergroup", usergroup_id: embed.mention.id }];
    }
    return [
      embed.mention.kind === "user"
        ? { type: "user", user_id: embed.mention.id }
        : { channel_id: embed.mention.id, type: "channel" },
    ];
  }
  if (embed?.emoji) return [{ name: embed.emoji, type: "emoji" }];
  if (embed?.date) {
    return [
      {
        fallback: embed.date.fallback || undefined,
        format: embed.date.format,
        timestamp: embed.date.ts,
        type: "date",
      },
    ];
  }

  const style = styleFromAttrs(segment.attributes, forceBold);
  const link = segment.attributes?.link;
  if (typeof link === "string") return [{ style, text: segment.text, type: "link", url: link }];
  return [{ style, text: segment.text, type: "text" }];
}

function lineElements(line: DeltaLine, forceBold = false): RichTextInlineElement[] {
  return line.segments.flatMap((segment) => segmentElements(segment, forceBold));
}

function headerPlainText(line: DeltaLine): string {
  return line.segments
    .map((segment) => {
      const embed = segment.embed;
      if (embed?.mention) {
        const { kind, id, name } = embed.mention;
        if (kind !== "special") return `${MENTION_PREFIX[kind]}${name}`;
        return id === "channel" || id === "here" ? `@${id}` : "";
      }
      if (embed?.emoji) return `:${embed.emoji}:`;
      if (embed?.date) return embed.date.fallback ?? "";
      return segment.text;
    })
    .join("");
}

const NEWLINE: RichTextInlineElement = { text: "\n", type: "text" };

function splitLineOnDividers(line: DeltaLine): DeltaLine[] {
  if (!line.segments.some((segment) => segment.embed?.divider)) return [line];
  const lines: DeltaLine[] = [];
  let run: DeltaSegment[] = [];
  const flushRun = () => {
    if (run.length) lines.push({ blockAttributes: line.blockAttributes, segments: run });
    run = [];
  };
  for (const segment of line.segments) {
    if (segment.embed?.divider) {
      flushRun();
      lines.push({ blockAttributes: undefined, segments: [segment] });
    } else {
      run.push(segment);
    }
  }
  flushRun();
  return lines;
}

function elementsHaveProfileLink(
  elements: readonly (RichTextInlineElement | RichTextSubBlock)[],
): boolean {
  return elements.some((el) =>
    isRichTextSubBlock(el)
      ? elementsHaveProfileLink(el.elements)
      : el.type === "link" && !!parseUserProfileLink(el.url),
  );
}

export function blocksHaveProfileLink(blocks: readonly Block[]): boolean {
  return blocks.some((block) => {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    return !!richText && elementsHaveProfileLink(richText.elements);
  });
}

export function buildRichTextBlocks(quill: Quill): Block[] {
  const blocks: Block[] = [];
  const elements: RichTextSubBlock[] = [];
  let plainRun: RichTextInlineElement[] = [];
  let codeLines: string[] | null = null;
  let quoteRun: RichTextInlineElement[] | null = null;
  let list: { style: "bullet" | "ordered"; items: RichTextInlineElement[][] } | null = null;

  const flushPlain = () => {
    if (!plainRun.length) return;
    elements.push({ elements: plainRun, type: "rich_text_section" });
    plainRun = [];
  };
  const flushCode = () => {
    if (codeLines === null) return;
    elements.push({
      elements: [{ text: codeLines.join("\n"), type: "text" }],
      type: "rich_text_preformatted",
    });
    codeLines = null;
  };
  const flushQuote = () => {
    if (quoteRun === null) return;
    elements.push({
      elements: quoteRun.length ? quoteRun : [{ text: "", type: "text" }],
      type: "rich_text_quote",
    });
    quoteRun = null;
  };
  const flushList = () => {
    if (!list) return;
    elements.push({
      elements: list.items.map((item) => ({ elements: item, type: "rich_text_section" })),
      style: list.style,
      type: "rich_text_list",
    });
    list = null;
  };
  const flushRichText = () => {
    if (!elements.length) return;
    blocks.push({ elements: elements.splice(0), type: "rich_text" });
  };

  for (const line of deltaLines(quill).flatMap(splitLineOnDividers)) {
    const attrs = line.blockAttributes;

    if (line.segments.length === 1 && line.segments[0]?.embed?.divider) {
      flushPlain();
      flushQuote();
      flushList();
      flushCode();
      flushRichText();
      blocks.push({ type: "divider" });
      continue;
    }

    if (attrs?.header) {
      flushPlain();
      flushQuote();
      flushList();
      flushCode();
      flushRichText();
      blocks.push({
        level: attrs.header,
        text: { emoji: true, text: headerPlainText(line), type: "plain_text" },
        type: "header",
      });
      continue;
    }

    if (attrs?.context) {
      flushPlain();
      flushQuote();
      flushList();
      flushCode();
      flushRichText();
      blocks.push({
        elements: [{ text: headerPlainText(line), type: "plain_text" }],
        type: "context",
      });
      continue;
    }

    if (attrs?.["code-block"]) {
      flushPlain();
      flushQuote();
      flushList();
      codeLines ??= [];
      codeLines.push(rawLineText(line));
      continue;
    }
    flushCode();

    if (attrs?.list === "bullet" || attrs?.list === "ordered") {
      flushPlain();
      flushQuote();
      if (list && list.style !== attrs.list) flushList();
      list ??= { items: [], style: attrs.list };
      list.items.push(lineElements(line));
      continue;
    }
    flushList();

    if (attrs?.blockquote) {
      flushPlain();
      if (quoteRun) quoteRun.push(NEWLINE);
      quoteRun ??= [];
      quoteRun.push(...lineElements(line));
      continue;
    }
    flushQuote();

    if (plainRun.length) plainRun.push(NEWLINE);
    plainRun.push(...lineElements(line));
  }
  flushCode();
  flushQuote();
  flushList();
  flushPlain();
  flushRichText();

  if (!blocks.length) {
    blocks.push({
      elements: [{ elements: [{ text: "", type: "text" }], type: "rich_text_section" }],
      type: "rich_text",
    });
  }

  return blocks;
}

type DeltaOp = { insert: string | Record<string, unknown>; attributes?: Record<string, unknown> };

function styleToFormat(style: RichTextStyle | undefined): Record<string, true> {
  const format: Record<string, true> = {};
  for (const [, key] of INLINE_MARKS) if (style?.[key]) format[key] = true;
  return format;
}

function inlineOps(elements: (RichTextInlineElement | RichTextSubBlock)[]): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (const el of elements) {
    if (isRichTextSubBlock(el)) continue;
    if (el.type === "text") {
      if (!el.text) continue;
      const attributes = styleToFormat(el.style);
      ops.push(
        Object.keys(attributes).length ? { attributes, insert: el.text } : { insert: el.text },
      );
    } else if (el.type === "user") {
      ops.push({
        insert: {
          mention: {
            id: el.user_id,
            kind: "user",
            name: store.users.userById(el.user_id)?.name ?? el.user_id,
          },
        },
      });
    } else if (el.type === "channel") {
      ops.push({
        insert: {
          mention: {
            id: el.channel_id,
            kind: "channel",
            name: channelDisplayName(store.channels.channelById(el.channel_id), el.channel_id),
          },
        },
      });
    } else if (el.type === "usergroup") {
      ops.push({
        insert: {
          mention: {
            id: el.usergroup_id,
            kind: "usergroup",
            name: (
              store.usergroups.usergroupById(el.usergroup_id)?.name ?? el.usergroup_id
            ).replace(LEADING_AT_RE, ""),
          },
        },
      });
    } else if (el.type === "emoji") {
      ops.push({ insert: { emoji: { name: el.name } } });
    } else if (el.type === "date") {
      ops.push({
        insert: { date: { fallback: el.fallback ?? "", format: el.format, ts: el.timestamp } },
      });
    } else if (el.type === "broadcast") {
      ops.push(
        el.range === "channel" || el.range === "here"
          ? { insert: { mention: { id: el.range, kind: "special", name: el.range } } }
          : { insert: `@${el.range}` },
      );
    } else if (el.type === "link") {
      const attributes = { ...styleToFormat(el.style), link: el.url };
      ops.push({ attributes, insert: el.text || el.url });
    } else if ("text" in el && typeof el.text === "string" && el.text) {
      ops.push({ insert: el.text });
    }
  }
  return ops;
}

function pushLine(
  ops: DeltaOp[],
  elements: (RichTextInlineElement | RichTextSubBlock)[],
  blockAttrs?: Record<string, unknown>,
) {
  ops.push(...inlineOps(elements));
  ops.push(blockAttrs ? { attributes: blockAttrs, insert: "\n" } : { insert: "\n" });
}

function richTextDeltaOps(blocks: readonly Block[]): DeltaOp[] {
  const ops: DeltaOp[] = [];
  for (const block of blocks) {
    const header = narrowByType<Block, HeaderBlock>(block, "header");
    if (header) {
      ops.push({ insert: header.text.text });
      ops.push({ attributes: { header: header.level ?? 1 }, insert: "\n" });
      continue;
    }
    const context = narrowByType<Block, ContextBlock>(block, "context");
    if (context) {
      const text = context.elements.map((el) => ("text" in el ? el.text : "")).join(" ");
      ops.push({ insert: text });
      ops.push({ attributes: { context: true }, insert: "\n" });
      continue;
    }
    if (block.type === "divider") {
      ops.push({ insert: { divider: true } });
      ops.push({ insert: "\n" });
      continue;
    }
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (!richText) continue;
    for (const sub of richText.elements) {
      if (sub.type === "rich_text_section") pushLine(ops, sub.elements);
      else if (sub.type === "rich_text_preformatted")
        pushLine(ops, sub.elements, { "code-block": true });
      else if (sub.type === "rich_text_quote") pushLine(ops, sub.elements, { blockquote: true });
      else if (sub.type === "rich_text_list") {
        for (const item of sub.elements) pushLine(ops, item.elements, { list: sub.style });
      }
    }
  }
  return ops;
}

export function loadRichTextIntoQuill(quill: Quill, blocks: readonly Block[]): void {
  const ops = richTextDeltaOps(blocks);
  quill.setContents(new Delta(ops.length ? ops : [{ insert: "\n" }]));
}
