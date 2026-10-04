import type { CanvasEdit } from "@slock/types";
import { applyEdit } from "./applyEdit.ts";
import { assignPositions } from "./assignPositions.ts";
import {
  changedLineWrite,
  controlWrite,
  deleteWrite,
  movedContainerWrite,
  newContainerWrite,
  newLineWrite,
  type Placement,
  titleWrite,
} from "./entryWrites.ts";
import { buildFlow, type Flow, type FlowEntry, ownPosition } from "./flow.ts";
import { groupLists, type PlannedGroup } from "./groups.ts";
import { positionBetween } from "./positions.ts";
import type { Bytes } from "./protobufWrite.ts";
import { type CanvasMeta, type DecodedCanvas, isSectionId, newSectionId } from "./sections.ts";
import { encodeDocumentData, type SectionWrite } from "./sectionWrite.ts";

export type PlanResult =
  | { data: Bytes; meta: CanvasMeta; ok: true; title: string | null; writes: number }
  | { error: string; ok: false };

type Slot = { entry: FlowEntry; kind: "entry" } | { group: PlannedGroup; kind: "group" };

const MAX_HTML_LENGTH = 200_000;
const MAX_INDENT = 8;

function validate(edit: CanvasEdit): string | null {
  for (const control of edit.controls) if (!isSectionId(control.id)) return "invalid_id";
  for (const { line } of edit.upserts) {
    if (!isSectionId(line.id)) return "invalid_id";
    if (line.html.length > MAX_HTML_LENGTH) return "line_too_long";
    if (line.indent < 0 || line.indent > MAX_INDENT) return "invalid_indent";
    if (line.level < 0 || line.level > 6) return "invalid_level";
  }
  return null;
}

function buildSlots(entries: FlowEntry[], groupOf: Map<string, PlannedGroup>): Slot[] {
  const slots: Slot[] = [];
  const seen = new Set<PlannedGroup>();
  for (const entry of entries) {
    const group = groupOf.get(entry.id);
    if (!group) slots.push({ entry, kind: "entry" });
    else if (!seen.has(group)) {
      seen.add(group);
      slots.push({ group, kind: "group" });
    }
  }
  return slots;
}

function slotPosition(slot: Slot, flow: Flow): string | null {
  if (slot.kind === "group")
    return slot.group.isNew ? null : (flow.containers.get(slot.group.id)?.position ?? null);
  const { existing } = slot.entry;
  return existing && existing.containerId === null ? existing.position : null;
}

function memberWrites(
  group: PlannedGroup,
  containerPlacement: Placement,
  moved: boolean,
  flow: Flow,
): SectionWrite[] {
  const positions = assignPositions(
    group.members.map((member) =>
      member.existing?.containerId === group.id ? member.existing.position : null,
    ),
    null,
    flow.usedPositions,
  );
  const writes: SectionWrite[] = [];
  group.members.forEach((member, index) => {
    const { line } = member;
    const position = positions[index];
    if (!(line && position)) return;
    const placement: Placement = {
      forcePath: moved,
      parent: { id: group.id, style: group.style },
      path: `${containerPlacement.path}-${position}`,
      position,
    };
    const write = member.existing
      ? changedLineWrite(member, line, placement)
      : newLineWrite(line, placement);
    if (write) writes.push(write);
  });
  return writes;
}

export function planEdit(decoded: DecodedCanvas, edit: CanvasEdit): PlanResult {
  const invalid = validate(edit);
  if (invalid) return { error: invalid, ok: false };
  const { meta } = decoded;
  if (!meta) return { error: "no_document", ok: false };
  const flow = buildFlow(decoded);
  const applied = applyEdit(flow.entries, edit);
  if (!applied.ok) return applied;
  const makeId = () => newSectionId(meta.shardChars);
  const grouping = groupLists(applied.entries, flow.containers, makeId);
  const slots = buildSlots(applied.entries, grouping.groupOf);
  const floor = flow.title ? ownPosition(flow.title) : null;
  const positions = assignPositions(
    slots.map((slot) => slotPosition(slot, flow)),
    floor,
    flow.usedPositions,
  );

  const writes: SectionWrite[] = edit.controls.map(controlWrite);
  if (edit.title !== null) {
    const first = positions[0] ?? null;
    const position = flow.title ? "" : positionBetween(null, first, flow.usedPositions);
    writes.push(titleWrite(flow.title, makeId(), edit.title, position));
  }

  slots.forEach((slot, index) => {
    const position = positions[index];
    if (!position) return;
    const placement: Placement = { forcePath: false, parent: null, path: position, position };
    if (slot.kind === "entry") {
      const { entry } = slot;
      if (!entry.line) return;
      const write = entry.existing
        ? changedLineWrite(entry, entry.line, placement)
        : newLineWrite(entry.line, placement);
      if (write) writes.push(write);
      return;
    }
    const { group } = slot;
    const existing = flow.containers.get(group.id);
    const moved = !existing || existing.position !== position;
    if (group.isNew) writes.push(newContainerWrite(group.id, group.style, placement));
    else if (existing && moved) writes.push(movedContainerWrite(existing, placement));
    writes.push(...memberWrites(group, placement, moved, flow));
  });

  for (const entry of applied.removed) {
    if (entry.existing) writes.push(deleteWrite(entry.existing.record));
    for (const id of entry.descendants) {
      const record = flow.records.get(id);
      if (record) writes.push(deleteWrite(record));
    }
  }
  const hadMembers = new Set(
    flow.entries.flatMap((entry) =>
      entry.existing?.containerId ? [entry.existing.containerId] : [],
    ),
  );
  for (const [id, container] of flow.containers) {
    if (!grouping.claimed.has(id) && hadMembers.has(id)) writes.push(deleteWrite(container.record));
  }

  return {
    data: encodeDocumentData(writes),
    meta,
    ok: true,
    title: edit.title,
    writes: writes.length,
  };
}
