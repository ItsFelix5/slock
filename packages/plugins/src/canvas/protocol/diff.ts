import { deepEqual } from "@slock/core";
import type { CanvasNode } from "@slock/types";
import { sameFrames } from "./frames.ts";

type DiffStatus = "added" | "changed" | "removed" | "same";

export interface DiffEntry {
  node: CanvasNode;
  previous: CanvasNode | null;
  status: DiffStatus;
}

export function sameNode(previous: CanvasNode, next: CanvasNode): boolean {
  const { frames, ...content } = previous;
  const { frames: nextFrames, ...nextContent } = next;
  return sameFrames(frames, nextFrames) && deepEqual(content, nextContent);
}

const COMMENT_TAG = /<\/?annotation\b[^>]*>/g;
const SPLIT_FORMAT = /<\/(b|i|u|del|code)><\1>/g;

const uncommented = (html: string) => html.replace(COMMENT_TAG, "").replace(SPLIT_FORMAT, "");

function withoutComments(node: CanvasNode): CanvasNode {
  if (node.kind === "table") {
    const rows = node.rows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => ({ ...cell, html: uncommented(cell.html) })),
    }));
    return { ...node, rows };
  }
  return "html" in node ? { ...node, html: uncommented(node.html) } : node;
}

// Commenting wraps text in a tag, which is not a change to the document.
export function diffNodes(older: CanvasNode[], newer: CanvasNode[]): DiffEntry[] {
  const previous = older.map(withoutComments);
  const next = newer.map(withoutComments);
  const before = new Map(previous.map((node) => [node.id, node]));
  const after = new Set(next.map((node) => node.id));
  const removedAfter = new Map<string | null, CanvasNode[]>();
  let anchor: string | null = null;
  for (const node of previous) {
    if (after.has(node.id)) {
      anchor = node.id;
      continue;
    }
    removedAfter.set(anchor, [...(removedAfter.get(anchor) ?? []), node]);
  }
  const removed = (id: string | null): DiffEntry[] =>
    (removedAfter.get(id) ?? []).map((node) => ({ node, previous: null, status: "removed" }));
  const entries: DiffEntry[] = [...removed(null)];
  for (const node of next) {
    const old = before.get(node.id) ?? null;
    entries.push({
      node,
      previous: old,
      status: old ? (sameNode(old, node) ? "same" : "changed") : "added",
    });
    entries.push(...removed(node.id));
  }
  return entries;
}
