import { narrowByType } from "@slock/core";
import { INVISIBLE_LABEL } from "@slock/plugins/message-links/client/api/replyLink";
import { isRichTextSubBlock } from "@slock/slack";
import type { Block, RichTextBlock, RichTextSubBlock } from "@slock/types";

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
