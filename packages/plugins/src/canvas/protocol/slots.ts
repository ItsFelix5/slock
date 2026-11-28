import { assignPositions } from "./assignPositions.ts";
import type { LayoutSpec } from "./containerWrites.ts";
import type { Flow, FlowEntry } from "./flow.ts";
import {
  DEFAULT_COLUMN_WEIGHT,
  FULL_WIDTH_WEIGHT,
  type LayoutColumn,
  type LayoutKind,
} from "./layoutContent.ts";
import { positionBetween } from "./positions.ts";
import type { PlannedChild, PlannedContainer } from "./tree.ts";

export type Slot =
  | { entry: FlowEntry; kind: "entry"; parent: PlannedContainer | null }
  | { container: PlannedContainer; kind: "container" };

export function flatten(children: PlannedChild[], parent: PlannedContainer | null, out: Slot[]) {
  for (const child of children) {
    if (child.kind === "entry") {
      out.push({ entry: child.entry, kind: "entry", parent });
      continue;
    }
    out.push({ container: child.container, kind: "container" });
    if (child.container.kind === "list") continue;
    for (const column of child.container.columns) flatten(column.children, child.container, out);
  }
}

function isMember(slot: Slot): boolean {
  return (slot.kind === "container" ? slot.container.parent : slot.parent) !== null;
}

export function placeSlots(slots: Slot[], flow: Flow, floor: string | null) {
  const roots = slots.filter((slot) => !isMember(slot));
  const rootPositions = assignPositions(
    roots.map((slot) => slotPosition(slot, flow)),
    { floor },
    flow.usedPositions,
  );
  const placed = new Map(roots.map((slot, index) => [slot, rootPositions[index]]));
  let previous = floor;
  return slots.map((slot) => {
    previous =
      placed.get(slot) ??
      slotPosition(slot, flow) ??
      positionBetween(previous, null, flow.usedPositions);
    return { position: previous, slot };
  });
}

function slotPosition(slot: Slot, flow: Flow): string | null {
  if (slot.kind === "container")
    return slot.container.isNew ? null : (flow.containers.get(slot.container.id)?.position ?? null);
  const { existing } = slot.entry;
  return existing && existing.listId === null ? existing.position : null;
}

function idOf(child: PlannedChild): string {
  return child.kind === "entry" ? child.entry.id : child.container.id;
}

function wrapWeight(container: PlannedContainer): number {
  const child = container.columns[0]?.children[0];
  return child?.kind === "entry" && child.entry.node.kind === "image" && child.entry.node.weight
    ? child.entry.node.weight
    : FULL_WIDTH_WEIGHT;
}

export function layoutSpec(container: PlannedContainer): LayoutSpec {
  const kind: LayoutKind =
    container.kind === "wrap" ? "columns" : container.kind === "list" ? "quote" : container.kind;
  const columns: LayoutColumn[] = container.columns.map((column) => ({
    memberIds: column.children.map(idOf),
    weight:
      container.kind === "wrap"
        ? wrapWeight(container)
        : kind === "columns"
          ? (container.weights[column.index] ?? DEFAULT_COLUMN_WEIGHT)
          : 0,
  }));
  return { color: container.color, columns, kind };
}

export function isLayout(container: PlannedContainer | null): boolean {
  return container !== null && container.kind !== "list";
}
