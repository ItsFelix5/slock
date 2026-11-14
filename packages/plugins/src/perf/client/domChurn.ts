import { describe } from "./describe";

type ChurnBatch = {
  at: number;
  where: string;
  added: number;
  removed: number;
};

const MAX_BATCHES = 600;
const TOP_TARGETS = 2;

function elementCount(nodes: NodeList): number {
  let count = 0;
  for (const node of nodes) {
    if (!(node instanceof Element)) continue;
    count += 1 + node.getElementsByTagName("*").length;
  }
  return count;
}

export function startDomChurn() {
  const batches: ChurnBatch[] = [];

  const observer = new MutationObserver((records) => {
    const at = performance.now();
    const byTarget = new Map<Node, ChurnBatch>();
    for (const record of records) {
      const batch = byTarget.get(record.target) ?? {
        at,
        where: describe(record.target),
        added: 0,
        removed: 0,
      };
      batch.added += elementCount(record.addedNodes);
      batch.removed += elementCount(record.removedNodes);
      byTarget.set(record.target, batch);
    }
    batches.push(...byTarget.values());
    if (batches.length > MAX_BATCHES) batches.splice(0, batches.length - MAX_BATCHES);
  });
  observer.observe(document, { childList: true, subtree: true });

  return {
    summarize(from: number, to: number): string[] {
      const totals = new Map<string, { added: number; removed: number }>();
      for (const batch of batches) {
        if (batch.at < from || batch.at > to) continue;
        const total = totals.get(batch.where) ?? { added: 0, removed: 0 };
        total.added += batch.added;
        total.removed += batch.removed;
        totals.set(batch.where, total);
      }
      return [...totals]
        .sort(([, a], [, b]) => b.added + b.removed - (a.added + a.removed))
        .slice(0, TOP_TARGETS)
        .map(([where, total]) => `+${total.added} -${total.removed} elements in ${where}`);
    },
    stop: () => observer.disconnect(),
  };
}
