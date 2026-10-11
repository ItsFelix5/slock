import type { Block, BroadcastRange, RichTextBlock, RichTextBroadcastElement } from "@slock/types";

function isRichTextBroadcast(value: unknown): value is RichTextBroadcastElement {
  if (!(value && typeof value === "object" && "type" in value && "range" in value)) return false;
  return (
    value.type === "broadcast" &&
    (value.range === "here" || value.range === "channel" || value.range === "everyone")
  );
}

function broadcastRangeFromElements(elements: readonly unknown[]): BroadcastRange | undefined {
  for (const element of elements) {
    if (isRichTextBroadcast(element)) return element.range;
    if (
      element &&
      typeof element === "object" &&
      "elements" in element &&
      Array.isArray(element.elements)
    ) {
      const range = broadcastRangeFromElements(element.elements);
      if (range) return range;
    }
  }
}

function broadcastRangeFromRichTextBlocks(
  blocks: readonly RichTextBlock[],
): BroadcastRange | undefined {
  for (const block of blocks) {
    const range = broadcastRangeFromElements(block.elements);
    if (range) return range;
  }
}

export function broadcastRangeFromBlocks(blocks: readonly Block[] | undefined) {
  return broadcastRangeFromRichTextBlocks(
    (blocks ?? []).filter((block): block is RichTextBlock => block.type === "rich_text"),
  );
}
