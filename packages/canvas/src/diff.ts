import type { CanvasNode } from "@slock/types";
import { sameFrames } from "./frames.ts";

export type DiffStatus = "added" | "changed" | "removed" | "same";

export interface DiffEntry {
  node: CanvasNode;
  previous: CanvasNode | null;
  status: DiffStatus;
}

function signature(node: CanvasNode): string {
  return JSON.stringify(node, (key, value) => (key === "frames" ? undefined : value));
}

function unchanged(previous: CanvasNode, next: CanvasNode): boolean {
  return sameFrames(previous.frames, next.frames) && signature(previous) === signature(next);
}

export function diffNodes(previous: CanvasNode[], next: CanvasNode[]): DiffEntry[] {
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
      status: old ? (unchanged(old, node) ? "same" : "changed") : "added",
    });
    entries.push(...removed(node.id));
  }
  return entries;
}
