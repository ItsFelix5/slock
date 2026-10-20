import { getCachedWorkspaceDomain, userProfileUrl } from "@slock/slack";
import type { Block, RichTextInlineElement, RichTextStyle, RichTextSubBlock } from "@slock/types";
import { INLINE_MARKS } from "@slock/ui/editor/markdownAutoformat";
import type Quill from "@slock/ui/editor/quill";
import { parseSlackPermalink } from "../../../message-links/client/api/slackPermalink";
import { HEADER_MAX_LENGTH } from "./headerLimit";
import { type DeltaLine, type DeltaSegment, deltaLines, MENTION_PREFIX } from "./quillMentions";
import { collapseLeadingMessageLink } from "./replyLinkBlocks";

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
  const { embed } = segment;
  if (embed?.mention) {
    if (embed.mention.kind === "special") {
      const range = embed.mention.id;
      return range === "channel" || range === "here" ? [{ range, type: "broadcast" }] : [];
    }
    if (embed.mention.kind === "usergroup") {
      return [{ type: "usergroup", usergroup_id: embed.mention.id }];
    }
    if (embed.mention.kind === "userlink") {
      const url = userProfileUrl(getCachedWorkspaceDomain() ?? "", embed.mention.id);
      return [{ text: embed.mention.name, type: "link", url }];
    }
    if (embed.mention.kind === "messagelink") {
      const target = parseSlackPermalink(embed.mention.id);
      return [
        target
          ? {
              channel_id: target.channelId,
              message_ts: target.messageTs,
              text: embed.mention.id,
              thread_ts: target.threadTs,
              type: "message_mention",
              url: embed.mention.id,
            }
          : { type: "link", url: embed.mention.id },
      ];
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
      const { embed } = segment;
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

export function buildRichTextBlocks(quill: Quill): Block[] {
  const blocks: Block[] = [];
  const elements: RichTextSubBlock[] = [];
  let plainRun: RichTextInlineElement[] = [];
  let codeLines: string[] | null = null;
  let quoteRun: RichTextInlineElement[] | null = null;
  let list: {
    offset: number;
    style: "bullet" | "ordered";
    items: RichTextInlineElement[][];
  } | null = null;

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
      ...(list.offset ? { offset: list.offset } : {}),
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
        text: {
          emoji: true,
          text: headerPlainText(line).slice(0, HEADER_MAX_LENGTH),
          type: "plain_text",
        },
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
      codeLines.push(line.segments.map((s) => s.text).join(""));
      continue;
    }
    flushCode();

    if (attrs?.list === "bullet" || attrs?.list === "ordered") {
      flushPlain();
      flushQuote();
      if (list && list.style !== attrs.list) flushList();
      list ??= { items: [], offset: Number(attrs.listOffset ?? 0), style: attrs.list };
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

  return collapseLeadingMessageLink(blocks);
}
