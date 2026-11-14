import type { CanvasControl, CanvasEdit, CanvasUpsert } from "@slock/types";
import { longestIncreasing, sameNode } from "../../protocol/api";
import type { LineEntry } from "./canvasLineIds";

export interface CanvasSnapshot {
  entries: LineEntry[];
  title: string;
}

export function diffSnapshots(
  base: CanvasSnapshot,
  next: CanvasSnapshot,
  controls: CanvasControl[],
): CanvasEdit | null {
  const baseIndex = new Map(base.entries.map((entry, index) => [entry.id, index]));
  const baseNodes = new Map(base.entries.map((entry) => [entry.id, entry.node]));
  const nextIds = new Set(next.entries.map((entry) => entry.id));
  const deleted = base.entries.filter((entry) => !nextIds.has(entry.id)).map((entry) => entry.id);
  const orderOf = next.entries.map((entry) => baseIndex.get(entry.id) ?? null);
  const kept = longestIncreasing(orderOf, (a, b) => a < b);

  const upserts: CanvasUpsert[] = [];
  next.entries.forEach((entry, index) => {
    const { node } = entry;
    const existing = baseNodes.get(entry.id);
    const moved = existing !== undefined && !kept.has(index);
    if (existing && !moved && sameNode(existing, node)) return;
    upserts.push({ after: next.entries[index - 1]?.id ?? null, node });
  });

  const title = next.title === base.title ? null : next.title;
  if (upserts.length === 0 && deleted.length === 0 && title === null) return null;
  return { controls, deleted, title, upserts };
}
