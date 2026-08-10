import type {
  ActionsBlock,
  Block,
  BlockElement,
  ButtonElement,
  ContextBlock,
  InputBlock,
  Message,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
  SectionBlock,
  TextObject,
} from "@slock/slack-api";
import { type MessageSize, messageSizeMetrics } from "@slock/ui";
import {
  estimateAttachmentHeight,
  estimateFilesHeight,
  estimateLineCount,
  estimateMrkdwnHeight,
} from "./media/estimateMediaHeight";
import {
  isRichTextSubBlock,
  type MessageRenderContext,
  resolveMessageRenderState,
} from "./messageRenderState";

const LINE_HEIGHT = 22;
const META_HEIGHT = 20;
const DIVIDER_HEIGHT = 15;
const REPLY_REFERENCE_HEIGHT = 18;
const EMOJI_ONLY_LINE_HEIGHT = 39;
const ENLARGED_EMOJI_WIDTH = 40;
const COMPACT_SPACER_HEIGHT = 16;
const AVG_CHAR_WIDTH = 7.2;
const GUTTER_WIDTH = 84;
const DEFAULT_CONTAINER_WIDTH = 640;

const BLOCK_GAP = 8;
const HEADER_BLOCK_HEIGHT = 24;
const DIVIDER_BLOCK_HEIGHT = 9;
const CONTEXT_BLOCK_HEIGHT = 24;
const ACTIONS_ROW_HEIGHT = 32;
const SECTION_FIELD_LINE_HEIGHT = 20;
const IMAGE_BLOCK_HEIGHT = 240;

export interface MessageHeightContext extends MessageRenderContext {
  messageSize: MessageSize;
}

function inlineText(elements: RichTextInlineElement[]): string {
  return elements
    .map((element) => {
      switch (element.type) {
        case "text":
          return element.text;
        case "link":
          return element.text ?? element.url;
        case "emoji":
          return "    ";
        case "broadcast":
          return `@${element.range}`;
        case "color":
          return `  ${element.value}`;
        case "date":
          return element.fallback ?? "date";
        default:
          return "@someone";
      }
    })
    .join("");
}

function textObjectLines(text: TextObject | undefined, wrapWidth: number): number {
  return text ? estimateLineCount(text.text, wrapWidth) : 0;
}

// Mirrors QuoteContent in blockkit's RichText.tsx: a quote's elements are
// usually plain inline content, but Slack nests a full sub-block (most often
// a rich_text_list) directly inside when e.g. a bullet list is started while
// the caret is inside a blockquote. Measure each inline run and nested block
// on its own rather than feeding the whole mixed array through inlineText,
// which doesn't know what a nested block is and would collapse it to a
// single fallback line.
function quoteContentHeight(
  elements: (RichTextInlineElement | RichTextSubBlock)[],
  wrapWidth: number,
): number {
  let height = 0;
  let run: RichTextInlineElement[] = [];
  const flushRun = () => {
    if (!run.length) return;
    height += Math.max(1, estimateLineCount(inlineText(run), wrapWidth)) * LINE_HEIGHT;
    run = [];
  };
  for (const element of elements) {
    if (isRichTextSubBlock(element)) {
      flushRun();
      height += richTextSubBlockHeight(element, wrapWidth);
    } else {
      run.push(element);
    }
  }
  flushRun();
  return height;
}

function richTextSubBlockHeight(subBlock: RichTextSubBlock, wrapWidth: number): number {
  switch (subBlock.type) {
    case "rich_text_section":
      return estimateLineCount(inlineText(subBlock.elements), wrapWidth) * LINE_HEIGHT;
    case "rich_text_quote":
      return quoteContentHeight(subBlock.elements, wrapWidth - 15) + 8;
    case "rich_text_preformatted":
      return (
        Math.max(1, estimateLineCount(inlineText(subBlock.elements), wrapWidth - 20)) * 18 + 18
      );
    case "rich_text_list": {
      const indent = 16 + (subBlock.indent ?? 0) * 20;
      return (
        4 +
        subBlock.elements.reduce(
          (sum, item) =>
            sum +
            Math.max(1, estimateLineCount(inlineText(item.elements), wrapWidth - indent)) *
              LINE_HEIGHT +
            2,
          0,
        )
      );
    }
  }
}

function elementHeight(element: BlockElement): number {
  if (element.type === "image") return 120;
  if (element.type === "button" || element.type === "overflow") return 32;
  return 30;
}

function elementWidth(element: BlockElement): number {
  if (element.type === "image") return 240;
  if (element.type === "overflow") return 32;
  if (element.type === "button") {
    const button = element as ButtonElement;
    return Math.max(48, Math.min(240, button.text.text.length * AVG_CHAR_WIDTH + 18));
  }
  return 80;
}

function blockHeight(block: Block, wrapWidth: number): number {
  switch (block.type) {
    case "section": {
      const section = block as SectionBlock;
      const accessoryWidth = section.accessory ? elementWidth(section.accessory) + 12 : 0;
      const mainWidth = Math.max(80, wrapWidth - accessoryWidth);
      let height = textObjectLines(section.text, mainWidth) * LINE_HEIGHT;
      if (section.fields?.length) {
        const fieldWidth = Math.max(40, (mainWidth - 12) / 2);
        let fieldsHeight = 6;
        for (let index = 0; index < section.fields.length; index += 2) {
          fieldsHeight +=
            Math.max(
              textObjectLines(section.fields[index], fieldWidth),
              textObjectLines(section.fields[index + 1], fieldWidth),
            ) * SECTION_FIELD_LINE_HEIGHT;
          if (index + 2 < section.fields.length) fieldsHeight += 4;
        }
        height += fieldsHeight;
      }
      if (section.accessory) height = Math.max(height, elementHeight(section.accessory));
      return height;
    }
    case "divider":
      return DIVIDER_BLOCK_HEIGHT;
    case "header":
      return HEADER_BLOCK_HEIGHT;
    case "context": {
      const context = block as ContextBlock;
      const approximateWidth = context.elements.reduce(
        (sum, element) =>
          sum +
          (element.type === "image"
            ? 20
            : Math.max(12, Math.min(wrapWidth, element.text.length * AVG_CHAR_WIDTH))) +
          6,
        0,
      );
      return Math.max(1, Math.ceil(approximateWidth / wrapWidth)) * CONTEXT_BLOCK_HEIGHT;
    }
    case "image": {
      const image = block as Extract<Block, { type: "image" }>;
      return IMAGE_BLOCK_HEIGHT + (image.title ? 23 : 0);
    }
    case "actions": {
      const actions = block as ActionsBlock;
      let rows = 1;
      let rowWidth = 0;
      for (const element of actions.elements) {
        const width = elementWidth(element);
        if (rowWidth && rowWidth + 8 + width > wrapWidth) {
          rows += 1;
          rowWidth = width;
        } else rowWidth += (rowWidth ? 8 : 0) + width;
      }
      return rows * ACTIONS_ROW_HEIGHT + Math.max(0, rows - 1) * 8;
    }
    case "input": {
      const input = block as InputBlock;
      return 18 + 6 + elementHeight(input.element) + (input.hint ? 20 : 0);
    }
    case "rich_text":
      return (block as RichTextBlock).elements.reduce(
        (sum, subBlock) => sum + richTextSubBlockHeight(subBlock, wrapWidth),
        0,
      );
    default:
      return 18;
  }
}

function estimateBlocksHeight(blocks: Block[], wrapWidth: number): number {
  if (!blocks.length) return 0;
  return (
    2 +
    blocks.reduce((sum, block) => sum + blockHeight(block, wrapWidth), 0) +
    BLOCK_GAP * Math.max(0, blocks.length - 1)
  );
}

function estimateReactionHeight(message: Message, wrapWidth: number): number {
  if (!message.reactions?.length) return 0;
  let rows = 1;
  let rowWidth = 0;
  for (const reaction of message.reactions) {
    const avatars = Math.min(3, reaction.users.length);
    const avatarWidth = avatars > 0 ? 20 + Math.max(0, avatars - 1) * 14 : 0;
    const width = 48 + String(reaction.count).length * 7 + avatarWidth;
    if (rowWidth && rowWidth + 6 + width > wrapWidth) {
      rows += 1;
      rowWidth = width;
    } else rowWidth += (rowWidth ? 6 : 0) + width;
  }
  return 6 + rows * 26 + Math.max(0, rows - 1) * 6;
}

export function estimateMessageHeight(
  message: Message,
  prev: Message | undefined,
  containerWidth = DEFAULT_CONTAINER_WIDTH,
  context?: MessageHeightContext,
): number {
  const renderContext: MessageHeightContext = context ?? {
    channelId: "",
    hasOpenThread: true,
    isPinned: false,
    messageSize: 1,
    messages: [message],
    showDeleted: true,
  };
  const state = resolveMessageRenderState(message, prev, renderContext);
  if (!state.showMessage) return 0;

  const wrapWidth = Math.max(120, containerWidth - GUTTER_WIDTH);
  // Mirrors MessageRow.tsx's renderBlocks() exactly (not a re-derived
  // message.blocks/replyRef check) — a block-based reply reference
  // (blockReplyRef in messageRenderState.ts, e.g. a pasted permalink quote)
  // still renders its blocks even though state.replyRef is also set, so
  // gating on replyRef alone silently underestimated every such row to its
  // near-empty message.text fallback instead of its real block content.
  const usesBlocks = !!state.renderBlocks?.length;
  let contentHeight = usesBlocks
    ? estimateBlocksHeight(state.renderBlocks ?? [], wrapWidth)
    : state.enlargedEmojiCount
      ? Math.ceil(
          state.enlargedEmojiCount / Math.max(1, Math.floor(wrapWidth / ENLARGED_EMOJI_WIDTH)),
        ) * EMOJI_ONLY_LINE_HEIGHT
      : estimateMrkdwnHeight(`${state.messageText}${message.edited ? " (edited)" : ""}`, wrapWidth);
  contentHeight += estimateFilesHeight(message.files, wrapWidth);
  if (state.visibleAttachments?.length)
    contentHeight += state.visibleAttachments.reduce(
      (sum, attachment) =>
        sum + estimateAttachmentHeight(attachment, wrapWidth, estimateBlocksHeight),
      0,
    );
  contentHeight += estimateReactionHeight(message, wrapWidth);
  if (renderContext.hasOpenThread && (message.replyCount ?? 0) > 0) contentHeight += 32;

  // mirrors the CSS: a lead row's total vertical padding is rowPaddingY applied
  // both above and below, and its minimum height is the avatar plus its own top margin.
  const sizeMetrics = messageSizeMetrics(renderContext.messageSize);
  const bodyHeight = contentHeight + (state.sameAuthorAsPrev ? 0 : META_HEIGHT);
  const minimumContentHeight = state.sameAuthorAsPrev
    ? COMPACT_SPACER_HEIGHT
    : sizeMetrics.avatarSize + sizeMetrics.avatarMarginTop;
  const rowHeight =
    Math.max(bodyHeight, minimumContentHeight) +
    (state.sameAuthorAsPrev ? 0 : sizeMetrics.rowPaddingY * 2);

  let height = rowHeight;
  if (state.dayChanged || state.showUnreadDivider) height += DIVIDER_HEIGHT;
  if (state.replyRef) height += REPLY_REFERENCE_HEIGHT;
  if (state.showThreadContext) height += REPLY_REFERENCE_HEIGHT;
  if (state.showRepliesDivider) height += DIVIDER_HEIGHT;
  return Math.max(0, Math.round(height));
}
