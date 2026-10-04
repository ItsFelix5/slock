import type { CanvasNode, CanvasTable, LayoutFrame } from "@slock/types";
import { tableGrid } from "./canvasTable.ts";
import { readFile, readImage } from "./fileContent.ts";
import {
  type ContainerKind,
  type ExistingContainer,
  type Flow,
  type FlowEntry,
  ownPosition,
  sectionText,
} from "./flow.ts";
import { type LayoutRead, layoutKindOf, layoutMemberIds, readLayout } from "./layoutContent.ts";
import {
  lineShapeForStyle,
  listKindForStyle,
  STYLE_DIVIDER,
  STYLE_FILE,
  STYLE_IMAGE,
  STYLE_TABLE,
  TYPE_DIVIDER,
  TYPE_FILE,
  TYPE_IMAGE,
  TYPE_LIST,
  TYPE_TABLE,
  TYPE_TEXT,
  TYPE_TITLE,
} from "./lineStyles.ts";
import { asMessage, field } from "./protobufRaw.ts";
import type { DecodedCanvas, SectionRecord } from "./sections.ts";

interface Trail {
  frames: LayoutFrame[];
  layoutIds: string[];
  wrapper: { id: string; weight: number } | null;
}

function descendantIds(record: SectionRecord): string[] {
  const content = asMessage(field(record.msg, 12));
  if (!content) return [];
  return [...layoutMemberIds(record), ...(tableGrid(content)?.cellContentIds.values() ?? [])];
}

function compare(a: SectionRecord, b: SectionRecord): number {
  return a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : 0;
}

function attributes(record: SectionRecord) {
  const attrs = asMessage(field(record.msg, 16));
  return {
    checked: Number(attrs ? (field(attrs, 2)?.varint ?? 0n) : 0n) !== 0,
    indent: Number(attrs ? (field(attrs, 1)?.varint ?? 0n) : 0n),
  };
}

function isListContainer(record: SectionRecord): boolean {
  return record.type === TYPE_LIST && listKindForStyle(record.style) !== null;
}

function tableNode(
  record: SectionRecord,
  records: Map<string, SectionRecord>,
  frames: LayoutFrame[],
): CanvasTable | null {
  const content = asMessage(field(record.msg, 12));
  const grid = content && tableGrid(content);
  if (!(grid && record.id)) return null;
  const columns = grid.colIds.map((id, index) => ({ id, width: grid.colWidths[index] ?? 0 }));
  const rows = grid.rowIds.map((rowId) => ({
    cells: grid.colIds.map((colId) => {
      const contentId = grid.cellContentIds.get(`${rowId} ${colId}`) ?? "";
      const cell = records.get(contentId);
      return { contentId, html: cell ? sectionText(cell) : "" };
    }),
    id: rowId,
  }));
  return { columns, frames, id: record.id, kind: "table", rows };
}

function atomNode(
  record: SectionRecord,
  records: Map<string, SectionRecord>,
  frames: LayoutFrame[],
  weight: number,
): CanvasNode | null {
  const { id } = record;
  if (!id) return null;
  if (record.type === TYPE_DIVIDER && record.style === STYLE_DIVIDER)
    return { checked: false, frames, html: "", id, indent: 0, kind: "divider", level: 0 };
  if (record.type === TYPE_FILE && record.style === STYLE_FILE) return readFile(record, frames);
  if (record.type === TYPE_IMAGE && record.style === STYLE_IMAGE)
    return readImage(record, frames, weight);
  if (record.type === TYPE_TABLE && record.style === STYLE_TABLE)
    return tableNode(record, records, frames);
  return null;
}

export function buildFlow(decoded: DecodedCanvas): Flow {
  const records = new Map<string, SectionRecord>();
  const usedPositions = new Set<string>();
  const containers = new Map<string, ExistingContainer>();
  let title: SectionRecord | null = null;
  for (const record of decoded.records) {
    usedPositions.add(ownPosition(record));
    if (!record.id) continue;
    records.set(record.id, record);
    if (record.type === TYPE_TITLE) title = record;
    const kind: ContainerKind | null = isListContainer(record) ? "list" : layoutKindOf(record);
    if (kind)
      containers.set(record.id, {
        kind,
        position: ownPosition(record),
        record,
        style: record.style,
      });
  }

  const entries: FlowEntry[] = [];
  const visited = new Set<string>();

  function push(
    record: SectionRecord,
    node: CanvasNode | null,
    trail: Trail,
    listId: string | null,
  ) {
    if (!record.id) return;
    entries.push({
      descendants: node && node.kind !== "table" ? [] : descendantIds(record),
      existing: {
        layoutIds: trail.layoutIds,
        listId,
        position: ownPosition(record),
        record,
        wrapperId: trail.wrapper?.id ?? null,
      },
      frames: trail.frames,
      id: record.id,
      node,
      touched: false,
    });
  }

  function listItems(container: SectionRecord): SectionRecord[] {
    const prefix = `${container.anchor}-`;
    return decoded.records
      .filter(
        (candidate) =>
          candidate.id !== null &&
          !isListContainer(candidate) &&
          (candidate.parentIds.includes(container.id ?? "") || candidate.anchor.startsWith(prefix)),
      )
      .sort(compare);
  }

  function walkList(container: SectionRecord, trail: Trail) {
    const containerKind = listKindForStyle(container.style) ?? "bullet";
    for (const item of listItems(container)) {
      if (!item.id || visited.has(item.id)) continue;
      visited.add(item.id);
      const ownerId = item.parentIds[0] ?? container.id;
      const owner = ownerId ? containers.get(ownerId) : undefined;
      const kind = (owner && listKindForStyle(owner.style)) ?? containerKind;
      const { checked, indent } = attributes(item);
      const node: CanvasNode = {
        checked: kind === "checklist" && checked,
        frames: trail.frames,
        html: sectionText(item),
        id: item.id,
        indent,
        kind,
        level: 0,
      };
      push(item, node, trail, ownerId ?? null);
    }
  }

  function walkLayout(record: SectionRecord, layout: LayoutRead, trail: Trail) {
    if (layout.kind === "columns" && trail.frames.some((frame) => frame.kind !== "columns")) {
      push(record, null, trail, null);
      return;
    }
    const weights = layout.columns.map((column) => column.weight);
    const only = layout.columns.length === 1 ? layout.columns[0] : undefined;
    const sole = only?.memberIds.length === 1 ? records.get(only.memberIds[0] ?? "") : undefined;
    if (layout.kind === "columns" && only && sole?.type === TYPE_IMAGE && record.id) {
      visited.add(record.id);
      walkRecord(sole, { ...trail, wrapper: { id: record.id, weight: only.weight } });
      return;
    }
    layout.columns.forEach((column, index) => {
      const frame: LayoutFrame =
        layout.kind === "callout"
          ? { color: layout.color, kind: "callout" }
          : layout.kind === "columns"
            ? { id: record.id ?? "", index, kind: "columns", weights }
            : { kind: "quote" };
      const inner: Trail = {
        frames: [...trail.frames, frame],
        layoutIds: [...trail.layoutIds, record.id ?? ""],
        wrapper: null,
      };
      for (const memberId of column.memberIds) {
        const member = records.get(memberId);
        if (member) walkRecord(member, inner);
      }
    });
  }

  function walkRecord(record: SectionRecord, trail: Trail) {
    if (!record.id || visited.has(record.id)) return;
    visited.add(record.id);
    const layout = readLayout(record);
    if (layout) {
      walkLayout(record, layout, trail);
      return;
    }
    if (isListContainer(record)) {
      walkList(record, trail);
      return;
    }
    if (record.type === TYPE_TEXT && field(record.msg, 12)) {
      const content = asMessage(field(record.msg, 12));
      if (content && field(content, 1)) {
        const shape = lineShapeForStyle(record.style);
        const node: CanvasNode = {
          checked: false,
          frames: trail.frames,
          html: sectionText(record),
          id: record.id,
          indent: 0,
          kind: shape.kind,
          level: shape.level,
        };
        push(record, node, trail, null);
        return;
      }
    }
    const node = atomNode(record, records, trail.frames, trail.wrapper?.weight ?? 0);
    push(record, node, trail, null);
  }

  const roots = decoded.records
    .filter(
      (record) =>
        record.id !== null &&
        record.sectionClass === 0 &&
        record.type !== TYPE_TITLE &&
        !record.layoutParent &&
        record.parentIds.length === 0,
    )
    .sort(compare);
  const rootTrail: Trail = { frames: [], layoutIds: [], wrapper: null };
  for (const record of roots) walkRecord(record, rootTrail);
  return { containers, entries, records, title, usedPositions };
}
