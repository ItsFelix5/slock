import { narrowByType } from "@slock/core";
import type { Block, HeaderBlock, RichTextBlock } from "@slock/types";
import { richTextBlocksToPlainText } from "../richText/plainText";
import { getCachedWorkspaceDomain } from "./account";

export function blockPreviewText(blocks: readonly Block[] | undefined): string {
  const domain = getCachedWorkspaceDomain();
  const parts = (blocks ?? []).flatMap((block) => {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (richText) return [richTextBlocksToPlainText([richText], domain)];
    const header = narrowByType<Block, HeaderBlock>(block, "header");
    if (header) return [header.text.text];
    return [];
  });
  return parts.join("\n").trim();
}
