import { narrowByType } from "@slock/core";
import type {
  Block,
  HeaderBlock,
  RichTextBlock,
  RichTextInlineElement,
  RichTextSubBlock,
} from "@slock/types";

export function isRichTextSubBlock(
  el: RichTextInlineElement | RichTextSubBlock,
): el is RichTextSubBlock {
  return "elements" in el;
}

function richTextInlineToPlainText(el: RichTextInlineElement): string {
  switch (el.type) {
    case "text":
      return el.text;
    case "link":
      return el.text || el.url;
    case "emoji":
      return `:${el.name}:`;
    case "user":
      return `<@${el.user_id}>`;
    case "channel":
      return `<#${el.channel_id}>`;
    case "usergroup":
      return `<!subteam^${el.usergroup_id}>`;
    case "broadcast":
      return `@${el.range}`;
    case "message_mention":
      return el.text ?? "";
    case "date":
      return el.fallback ?? "";
    case "canvas":
      return el.text || "canvas";
    default:
      return "";
  }
}

function richTextSubBlockToPlainText(sub: RichTextSubBlock): string {
  switch (sub.type) {
    case "rich_text_section":
    case "rich_text_preformatted":
      return sub.elements.map(richTextInlineToPlainText).join("");
    case "rich_text_list":
      return sub.elements
        .map((item) => item.elements.map(richTextInlineToPlainText).join(""))
        .join(" ");
    case "rich_text_quote":
      return sub.elements
        .map((el) =>
          "elements" in el ? richTextSubBlockToPlainText(el) : richTextInlineToPlainText(el),
        )
        .join("");
    default:
      return "";
  }
}

export function richTextBlocksToPlainText(blocks: readonly RichTextBlock[]): string {
  return blocks
    .map((block) => block.elements.map(richTextSubBlockToPlainText).join("\n"))
    .join("\n")
    .trim();
}

export function blockPreviewText(blocks: readonly Block[] | undefined): string {
  const parts = (blocks ?? []).flatMap((block) => {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (richText) return [richTextBlocksToPlainText([richText])];
    const header = narrowByType<Block, HeaderBlock>(block, "header");
    if (header) return [header.text.text];
    return [];
  });
  return parts.join("\n").trim();
}
