import { parseUserProfileLink } from "@slock/blockkit";
import { narrowByType } from "@slock/core";
import { isRichTextSubBlock } from "@slock/slack";
import type { Block, RichTextBlock, RichTextInlineElement, RichTextSubBlock } from "@slock/types";

function elementLinks(elements: readonly (RichTextInlineElement | RichTextSubBlock)[]): string[] {
  return elements.flatMap((el) => {
    if (isRichTextSubBlock(el)) return elementLinks(el.elements);
    return (el.type === "link" || el.type === "message_mention") && el.url ? [el.url] : [];
  });
}

export function previewableLinks(blocks: readonly Block[] | undefined): string[] {
  const urls = (blocks ?? []).flatMap((block) => {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    return richText ? elementLinks(richText.elements) : [];
  });
  return [...new Set(urls)].filter((url) => !parseUserProfileLink(url));
}
