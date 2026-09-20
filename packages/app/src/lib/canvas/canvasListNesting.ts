import type { PositionedRecord, RawListItem } from "./canvasParse.ts";

export function compareAnchors(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type ListContainer = Extract<
  PositionedRecord,
  { kind: "bulletList" } | { kind: "orderedList" } | { kind: "checklist" }
>;

export interface ListItemRecord extends RawListItem {
  anchor: string;
}

export interface NestedListResult {
  itemsByRoot: Map<string, ListItemRecord[]>;
  nestedContainerAnchors: Set<string>;
}

export function groupListItems(
  positioned: PositionedRecord[],
  consumedIds: Set<string>,
): NestedListResult {
  const listContainers = positioned.filter(
    (record): record is ListContainer =>
      record.kind === "bulletList" || record.kind === "orderedList" || record.kind === "checklist",
  );

  function nearestContainer(anchor: string): ListContainer | null {
    let best: ListContainer | null = null;
    for (const container of listContainers) {
      const prefix = `${container.anchor}-`;
      if (anchor.startsWith(prefix) && (!best || container.anchor.length > best.anchor.length)) {
        best = container;
      }
    }
    return best;
  }

  const rootByContainer = new Map<string, string>();
  for (const container of listContainers) {
    let root = container.anchor;
    let current = container.anchor;
    for (let parent = nearestContainer(current); parent; parent = nearestContainer(current)) {
      root = parent.anchor;
      current = parent.anchor;
    }
    rootByContainer.set(container.anchor, root);
  }
  const nestedContainerAnchors = new Set(
    listContainers.filter((c) => rootByContainer.get(c.anchor) !== c.anchor).map((c) => c.anchor),
  );

  const itemsByRoot = new Map<string, ListItemRecord[]>();
  for (const record of positioned) {
    if (record.kind !== "paragraph") continue;
    const owner = nearestContainer(record.anchor);
    if (!owner) continue;
    if (record.id) consumedIds.add(record.id);
    const root = rootByContainer.get(owner.anchor) ?? owner.anchor;
    const items = itemsByRoot.get(root) ?? [];
    items.push({
      anchor: record.anchor,
      checked: owner.kind === "checklist" ? record.checked : undefined,
      indent: record.indent,
      text: record.text,
    });
    itemsByRoot.set(root, items);
  }
  for (const items of itemsByRoot.values()) {
    items.sort((a, b) => compareAnchors(a.anchor, b.anchor));
  }

  return { itemsByRoot, nestedContainerAnchors };
}
