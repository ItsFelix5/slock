import { narrowByType } from "@slock/core";
import { isRichTextSubBlock } from "@slock/slack";
import type { Block, RichTextBlock, RichTextInlineElement, RichTextSubBlock } from "@slock/types";
import { INVISIBLE_LABEL } from "../../../message-links/client/api/replyLink";

export function collapseLeadingMessageLink(blocks: Block[]): Block[] {
  const richText = narrowByType<Block, RichTextBlock>(blocks[0], "rich_text");
  if (!richText) return blocks;
  const [sub] = richText.elements;
  if (sub?.type !== "rich_text_section" && sub?.type !== "rich_text_quote") return blocks;
  const [first] = sub.elements;
  if (!first || isRichTextSubBlock(first) || first.type !== "message_mention") return blocks;

  const label = { ...first, text: INVISIBLE_LABEL };
  const updatedSub: RichTextSubBlock =
    sub.type === "rich_text_section"
      ? { ...sub, elements: [label, ...sub.elements.slice(1)] }
      : { ...sub, elements: [label, ...sub.elements.slice(1)] };
  return [
    { ...richText, elements: [updatedSub, ...richText.elements.slice(1)] },
    ...blocks.slice(1),
  ];
}

export function withReplyLink(blocks: Block[], permalink: string): Block[] {
  const link: RichTextInlineElement = { text: INVISIBLE_LABEL, type: "link", url: permalink };
  const richText = narrowByType<Block, RichTextBlock>(blocks[0], "rich_text");
  if (!richText) return blocks;
  const [sub, ...restSubs] = richText.elements;
  const elements: RichTextSubBlock[] =
    sub?.type === "rich_text_section"
      ? [{ ...sub, elements: [link, { text: " ", type: "text" }, ...sub.elements] }, ...restSubs]
      : [{ elements: [link], type: "rich_text_section" }, ...richText.elements];
  return [{ ...richText, elements }, ...blocks.slice(1)];
}
