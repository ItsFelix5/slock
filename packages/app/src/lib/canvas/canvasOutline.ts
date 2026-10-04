import { encodeTextEntities } from "@slock/blockkit";
import type { Op } from "quill";

export interface OutlineItem {
  index: number;
  level: number;
  text: string;
}

export interface OutlineSource {
  element(index: number): HTMLElement | null;
  items(): OutlineItem[];
}

export function titleItem(title: string): OutlineItem {
  return { index: 0, level: 0, text: encodeTextEntities(title.trim()) };
}

export function outlineFromOps(ops: Op[]): OutlineItem[] {
  const items: OutlineItem[] = [];
  let line = "";
  for (const op of ops) {
    if (typeof op.insert !== "string") {
      line += " ";
      continue;
    }
    const parts = op.insert.split("\n");
    parts.forEach((part, partIndex) => {
      line += part;
      if (partIndex === parts.length - 1) return;
      const level = op.attributes?.header;
      if (typeof level === "number")
        items.push({ index: items.length + 1, level, text: encodeTextEntities(line.trim()) });
      line = "";
    });
  }
  return items;
}
