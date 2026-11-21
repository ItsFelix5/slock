import { firstTruthy } from "@slock/core";
import type { Block, BroadcastRange, RichTextBlock, RichTextBroadcastElement } from "@slock/types";

function isRichTextBroadcast(value: unknown): value is RichTextBroadcastElement {
  if (!(value && typeof value === "object" && "type" in value && "range" in value)) return false;
  return (
    value.type === "broadcast" &&
    (value.range === "here" || value.range === "channel" || value.range === "everyone")
  );
}

function nestedRange(element: unknown): BroadcastRange | undefined {
  return element &&
    typeof element === "object" &&
    "elements" in element &&
    Array.isArray(element.elements)
    ? broadcastRangeFromElements(element.elements)
    : undefined;
}

function broadcastRangeFromElements(elements: readonly unknown[]): BroadcastRange | undefined {
  return firstTruthy(elements, (element) =>
    isRichTextBroadcast(element) ? element.range : nestedRange(element),
  );
}

function broadcastRangeFromRichTextBlocks(
  blocks: readonly RichTextBlock[],
): BroadcastRange | undefined {
  return firstTruthy(blocks, (block) => broadcastRangeFromElements(block.elements));
}

const TEXT_BROADCAST_RE = /<!(here|channel|everyone)(?:\|[^>]*)?>/;

function broadcastRangeFromText(text: string | undefined): BroadcastRange | undefined {
  const range = TEXT_BROADCAST_RE.exec(text ?? "")?.[1];
  return range === "here" || range === "channel" || range === "everyone" ? range : undefined;
}

export function broadcastRangeOf(content: {
  blocks?: readonly Block[];
  text?: string;
}): BroadcastRange | undefined {
  return (
    broadcastRangeFromRichTextBlocks(
      (content.blocks ?? []).filter((block): block is RichTextBlock => block.type === "rich_text"),
    ) ?? broadcastRangeFromText(content.text)
  );
}
