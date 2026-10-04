import { longestIncreasing } from "@slock/canvas";
import type { CanvasControl, CanvasEdit, CanvasLine, CanvasLineUpsert } from "@slock/types";
import type { LineEntry } from "./canvasLines";

export interface CanvasSnapshot {
  entries: LineEntry[];
  title: string;
}

function sameLine(a: CanvasLine, b: CanvasLine): boolean {
  return (
    a.kind === b.kind &&
    a.level === b.level &&
    a.html === b.html &&
    a.indent === b.indent &&
    a.checked === b.checked
  );
}

export function diffSnapshots(
  base: CanvasSnapshot,
  next: CanvasSnapshot,
  controls: CanvasControl[],
): CanvasEdit | null {
  const baseIndex = new Map(base.entries.map((entry, index) => [entry.id, index]));
  const baseLines = new Map(base.entries.map((entry) => [entry.id, entry.line]));
  const nextIds = new Set(next.entries.map((entry) => entry.id));
  const deleted = base.entries.filter((entry) => !nextIds.has(entry.id)).map((entry) => entry.id);
  const orderOf = next.entries.map((entry) => baseIndex.get(entry.id) ?? null);
  const kept = longestIncreasing(orderOf, (a, b) => a < b);

  const upserts: CanvasLineUpsert[] = [];
  next.entries.forEach((entry, index) => {
    const { line } = entry;
    if (!line) return;
    const existing = baseLines.get(entry.id);
    const moved = existing !== undefined && !kept.has(index);
    if (existing && !moved && sameLine(existing, line)) return;
    upserts.push({ after: next.entries[index - 1]?.id ?? null, line });
  });

  const title = next.title === base.title ? null : next.title;
  if (upserts.length === 0 && deleted.length === 0 && title === null) return null;
  return { controls, deleted, title, upserts };
}
