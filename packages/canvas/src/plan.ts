import type { CanvasEdit, CanvasTable } from "@slock/types";
import { applyEdit } from "./applyEdit.ts";
import { assignPositions } from "./assignPositions.ts";
import {
  layoutChanged,
  newLayoutWrite,
  newListWrite,
  updatedContainerWrite,
} from "./containerWrites.ts";
import {
  changedLineWrite,
  controlWrite,
  deleteWrite,
  movedAtomWrite,
  newFileWrite,
  newImageWrite,
  newLineWrite,
  type Placement,
  titleWrite,
} from "./entryWrites.ts";
import { type FlowEntry, ownPosition } from "./flow.ts";
import { isLineNode } from "./frames.ts";
import { positionBetween } from "./positions.ts";
import type { Bytes } from "./protobufWrite.ts";
import { buildFlow } from "./read.ts";
import { type CanvasMeta, type DecodedCanvas, newSectionId } from "./sections.ts";
import { encodeDocumentData, type SectionWrite } from "./sectionWrite.ts";
import { flatten, isLayout, layoutSpec, type Slot, slotPosition } from "./slots.ts";
import { cellWrites, newTableWrite, tableChanged, updatedTableWrite } from "./tableWrites.ts";
import { buildTree, type PlannedContainer } from "./tree.ts";
import { validate } from "./validate.ts";

export type PlanResult =
  | { data: Bytes; meta: CanvasMeta; ok: true; title: string | null; writes: number }
  | { error: string; ok: false };

export function planEdit(decoded: DecodedCanvas, edit: CanvasEdit): PlanResult {
  const invalid = validate(edit);
  if (invalid) return { error: invalid, ok: false };
  const { meta } = decoded;
  if (!meta) return { error: "no_document", ok: false };
  const flow = buildFlow(decoded);
  const applied = applyEdit(flow.entries, edit);
  if (!applied.ok) return applied;
  const makeId = () => newSectionId(meta.shardChars);
  const makeColumnId = () => makeId().slice("temp:C:".length + 3);
  const tree = buildTree(applied.entries, flow.containers, makeId);
  if ("error" in tree) return { error: tree.error, ok: false };

  const slots: Slot[] = [];
  flatten(tree.root, null, slots);
  const floor = flow.title ? ownPosition(flow.title) : null;
  const positions = assignPositions(
    slots.map((slot) => slotPosition(slot, flow)),
    { floor },
    flow.usedPositions,
  );

  const writes: SectionWrite[] = edit.controls.map(controlWrite);
  if (edit.title !== null) {
    const first = positions[0] ?? null;
    const position = flow.title ? "" : positionBetween(null, first, flow.usedPositions);
    writes.push(titleWrite(flow.title, makeId(), edit.title, position));
  }

  function tableWrite(
    entry: FlowEntry,
    node: CanvasTable,
    placement: Placement,
  ): SectionWrite | null {
    const { existing } = entry;
    if (!existing) return newTableWrite(node, placement);
    const moved = movedAtomWrite(entry, placement);
    if (!tableChanged(existing.record, node)) return moved;
    const updated = updatedTableWrite(existing, node);
    if (!moved) return updated;
    moved.content = updated.content;
    return moved;
  }

  function entryWrite(entry: FlowEntry, placement: Placement): SectionWrite | null {
    const { node } = entry;
    if (!node) return movedAtomWrite(entry, placement);
    if (!isLineNode(node)) {
      if (node.kind === "table") return tableWrite(entry, node, placement);
      if (entry.existing) return movedAtomWrite(entry, placement);
      return node.kind === "file" ? newFileWrite(node, placement) : newImageWrite(node, placement);
    }
    return entry.existing
      ? changedLineWrite(entry, node, placement)
      : newLineWrite(node, placement);
  }

  function listWrites(container: PlannedContainer, placement: Placement, moved: boolean) {
    const items = (container.columns[0]?.children ?? []).flatMap((child) =>
      child.kind === "entry" ? [child.entry] : [],
    );
    const style = container.spec.kind === "list" ? container.spec.style : 0;
    const itemPositions = assignPositions(
      items.map((item) =>
        item.existing && item.existing.listId === container.id ? item.existing.position : null,
      ),
      { floor: null },
      flow.usedPositions,
    );
    items.forEach((item, index) => {
      const position = itemPositions[index];
      if (!position) return;
      const write = entryWrite(item, {
        forcePath: moved,
        layoutParent: false,
        list: { id: container.id, style },
        path: `${placement.path}-${position}`,
        position,
      });
      if (write) writes.push(write);
    });
  }

  function containerWrites(container: PlannedContainer, position: string) {
    const existing = flow.containers.get(container.id);
    const parentIsLayout = isLayout(container.parent);
    const placement: Placement = {
      forcePath: false,
      layoutParent: parentIsLayout,
      list: null,
      path: position,
      position,
    };
    const moved = !existing || existing.position !== position;
    const parentFlag =
      existing && existing.record.layoutParent !== parentIsLayout ? parentIsLayout : null;
    if (container.kind === "list") {
      if (!existing)
        writes.push(
          newListWrite(
            container.id,
            container.spec.kind === "list" ? container.spec.style : 0,
            parentIsLayout,
            placement,
          ),
        );
      else if (moved || parentFlag !== null)
        writes.push(
          updatedContainerWrite(existing, {
            layout: null,
            layoutParent: parentFlag,
            makeColumnId,
            placement: moved ? placement : null,
          }),
        );
      listWrites(container, placement, moved);
      return;
    }
    const spec = layoutSpec(container);
    if (!existing) {
      writes.push(newLayoutWrite(container.id, spec, parentIsLayout, placement, makeColumnId));
      return;
    }
    const contentChanged = layoutChanged(existing, spec);
    if (moved || parentFlag !== null || contentChanged)
      writes.push(
        updatedContainerWrite(existing, {
          layout: contentChanged ? spec : null,
          layoutParent: parentFlag,
          makeColumnId,
          placement: moved ? placement : null,
        }),
      );
  }

  slots.forEach((slot, index) => {
    const position = positions[index];
    if (!position) return;
    if (slot.kind === "container") {
      containerWrites(slot.container, position);
      return;
    }
    const write = entryWrite(slot.entry, {
      forcePath: false,
      layoutParent: isLayout(slot.parent),
      list: null,
      path: position,
      position,
    });
    if (write) writes.push(write);
    const { node } = slot.entry;
    if (node?.kind === "table")
      writes.push(
        ...cellWrites(
          node,
          slot.entry.existing?.record ?? null,
          flow.records,
          { ceiling: positions[index + 1] ?? null, floor: position },
          flow.usedPositions,
        ),
      );
  });

  for (const entry of applied.removed) {
    if (entry.existing) {
      writes.push(deleteWrite(entry.existing.record));
      const wrapper = entry.existing.wrapperId ? flow.records.get(entry.existing.wrapperId) : null;
      if (wrapper) writes.push(deleteWrite(wrapper));
    }
    for (const id of entry.descendants) {
      const record = flow.records.get(id);
      if (record) writes.push(deleteWrite(record));
    }
  }
  const hadMembers = new Set(
    flow.entries.flatMap((entry) => {
      const { existing } = entry;
      if (!existing) return [];
      return [
        ...existing.layoutIds,
        ...(existing.listId ? [existing.listId] : []),
        ...(existing.wrapperId ? [existing.wrapperId] : []),
      ];
    }),
  );
  const deleted = new Set(writes.filter((write) => write.deleted).map((write) => write.id));
  for (const [id, container] of flow.containers) {
    if (!tree.claimed.has(id) && hadMembers.has(id) && !deleted.has(id))
      writes.push(deleteWrite(container.record));
  }

  return {
    data: encodeDocumentData(writes),
    meta,
    ok: true,
    title: edit.title,
    writes: writes.length,
  };
}
