import { defined, narrowByType } from "@slock/core";
import type { Block, RichTextBlock } from "@slock/types";

function collectUsergroupIds(elements: readonly unknown[], ids: Set<string>) {
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    if ("usergroup_id" in element && typeof element.usergroup_id === "string") {
      ids.add(element.usergroup_id);
    }
    if ("elements" in element && Array.isArray(element.elements)) {
      collectUsergroupIds(element.elements, ids);
    }
  }
}

const TEXT_USERGROUP_RE = /<!subteam\^([A-Z0-9]+)/g;

export function usergroupIdsOf(content: { blocks?: readonly Block[]; text?: string }): string[] {
  const ids = new Set<string>();
  for (const block of content.blocks ?? []) {
    const richText = narrowByType<Block, RichTextBlock>(block, "rich_text");
    if (richText) collectUsergroupIds(richText.elements, ids);
  }
  if (ids.size === 0) {
    for (const match of (content.text ?? "").matchAll(TEXT_USERGROUP_RE))
      ids.add(defined(match[1]));
  }
  return [...ids];
}
