import {
  type Block,
  isRichTextSubBlock,
  narrowByType,
  type RichTextBlock,
  type RichTextInlineElement,
  type RichTextSubBlock,
  type TextObject,
} from "@slock/types";

const EMOJI_SHORTCODE_RE = /:([a-z0-9_+'-]+):/gi;

export const MAX_ENLARGED_EMOJI = 25;

export function emojiShortcodeCount(text: string): number | undefined {
  const emoji = text.match(EMOJI_SHORTCODE_RE);
  return text.replace(EMOJI_SHORTCODE_RE, "").trim() ? undefined : (emoji?.length ?? 0);
}

function emojiOnlyRichTextCount(block: RichTextBlock): number | undefined {
  let count = 0;
  const addElements = (elements: RichTextInlineElement[]) => {
    for (const element of elements) {
      if (element.type === "emoji") count += 1;
      else if (element.type === "text") {
        const textCount = emojiShortcodeCount(element.text);
        if (textCount === undefined) return false;
        count += textCount;
      } else return false;
    }
    return true;
  };
  const isInlineElement = (
    el: RichTextInlineElement | RichTextSubBlock,
  ): el is RichTextInlineElement => !isRichTextSubBlock(el);

  const addSubBlock = (subBlock: RichTextSubBlock) => {
    if (subBlock.type === "rich_text_list")
      return subBlock.elements.every((section) => addElements(section.elements));
    if (subBlock.type === "rich_text_quote") {
      if (!subBlock.elements.every(isInlineElement)) return false;
      return addElements(subBlock.elements);
    }
    return addElements(subBlock.elements);
  };

  return block.elements.every(addSubBlock) ? count : undefined;
}

export function emojiOnlyBlockMessage(blocks: Block[]): number {
  let count = 0;
  const addText = (text: TextObject | undefined) => {
    if (!text) return false;
    const textCount = emojiShortcodeCount(text.text);
    if (textCount === undefined) return false;
    count += textCount;
    return true;
  };

  for (const block of blocks) {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (richText) {
      const richTextCount = emojiOnlyRichTextCount(richText);
      if (richTextCount === undefined) return 0;
      count += richTextCount;
      continue;
    }
    const section = narrowByType<Block, Extract<Block, { type: "section" }>>(block, "section");
    if (section) {
      if (section.accessory || section.fields?.length || !addText(section.text)) return 0;
      continue;
    }
    const header = narrowByType<Block, Extract<Block, { type: "header" }>>(block, "header");
    if (header) {
      if (!addText(header.text)) return 0;
      continue;
    }
    return 0;
  }

  return count > 0 && count < MAX_ENLARGED_EMOJI ? count : 0;
}
