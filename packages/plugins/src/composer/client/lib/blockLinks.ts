import { parseUserProfileLink } from "@slock/blockkit";
import { narrowByType } from "@slock/core";
import { isRichTextSubBlock, messageMentionUrl } from "@slock/slack";
import { getCachedWorkspaceDomain } from "@slock/slack/client";
import type { Block, RichTextBlock, RichTextInlineElement, RichTextSubBlock } from "@slock/types";

function elementLinks(elements: readonly (RichTextInlineElement | RichTextSubBlock)[]): string[] {
  return elements.flatMap((el) => {
    if (isRichTextSubBlock(el)) return "elements" in el ? elementLinks(el.elements) : [];
    if (el.type === "message_mention") return [messageMentionUrl(el, getCachedWorkspaceDomain())];
    return el.type === "link" ? [el.url] : [];
  });
}

export function previewableLinks(blocks: readonly Block[] | undefined): string[] {
  const urls = (blocks ?? []).flatMap((block) => {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    return richText ? elementLinks(richText.elements) : [];
  });
  return [...new Set(urls)].filter((url) => !parseUserProfileLink(url));
}
