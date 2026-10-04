import type { CanvasEdit } from "@slock/types";
import type { FlowEntry } from "./flow.ts";

export type ApplyResult =
  | { entries: FlowEntry[]; ok: true; removed: FlowEntry[] }
  | { error: string; ok: false };

function indexAfter(entries: FlowEntry[], after: string | null): number {
  if (after === null) return 0;
  const index = entries.findIndex((entry) => entry.id === after);
  return index < 0 ? -1 : index + 1;
}

export function applyEdit(flowEntries: FlowEntry[], edit: CanvasEdit): ApplyResult {
  const deleted = new Set(edit.deleted);
  const entries = flowEntries.filter((entry) => !deleted.has(entry.id));
  const removed = flowEntries.filter((entry) => deleted.has(entry.id));
  for (const { after, line } of edit.upserts) {
    const current = entries.findIndex((entry) => entry.id === line.id);
    const entry = current >= 0 ? entries[current] : undefined;
    if (entry && entry.line === null) return { error: "opaque_block", ok: false };
    if (entry) {
      entry.line = line;
      entry.touched = true;
      const predecessor = current > 0 ? (entries[current - 1]?.id ?? null) : null;
      if (predecessor === after) continue;
      entries.splice(current, 1);
      const index = indexAfter(entries, after);
      if (index < 0) return { error: "unknown_anchor", ok: false };
      entries.splice(index, 0, entry);
      continue;
    }
    const index = indexAfter(entries, after);
    if (index < 0) return { error: "unknown_anchor", ok: false };
    entries.splice(index, 0, { descendants: [], existing: null, id: line.id, line, touched: true });
  }
  return { entries, ok: true, removed };
}
