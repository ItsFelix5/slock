import type { Placement } from "./entryWrites.ts";
import type { ExistingContainer } from "./flow.ts";
import {
  DEFAULT_COLUMN_WEIGHT,
  type LayoutColumn,
  type LayoutKind,
  layoutContent,
  readLayout,
  styleOfLayout,
} from "./layoutContent.ts";
import { TYPE_LIST } from "./lineStyles.ts";
import { asMessage, field } from "./protobufRaw.ts";
import { encodeRawMessage } from "./rawEncode.ts";
import { blankWrite, rawVarint, type SectionWrite } from "./sectionWrite.ts";

export interface LayoutSpec {
  color: number;
  columns: LayoutColumn[];
  kind: LayoutKind;
}

function assign(write: SectionWrite, placement: Placement) {
  write.position = placement.position;
  write.path = placement.path;
}

export function newListWrite(
  id: string,
  style: number,
  parentIsLayout: boolean,
  placement: Placement,
): SectionWrite {
  const write = blankWrite(id);
  write.type = TYPE_LIST;
  write.style = style;
  write.content = [];
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  write.layoutParent = parentIsLayout;
  assign(write, placement);
  return write;
}

export function newLayoutWrite(
  id: string,
  layout: LayoutSpec,
  parentIsLayout: boolean,
  placement: Placement,
  makeColumnId: () => string,
): SectionWrite {
  const write = blankWrite(id);
  const { style, type } = styleOfLayout(layout.kind);
  write.type = type;
  write.style = style;
  write.content = layoutContent(layout.kind, null, layout, makeColumnId);
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  write.layoutParent = parentIsLayout;
  assign(write, placement);
  return write;
}

export function layoutChanged(existing: ExistingContainer, layout: LayoutSpec): boolean {
  const current = readLayout(existing.record);
  if (!current) return true;
  if (layout.kind === "callout" && current.color !== layout.color) return true;
  if (current.columns.length !== layout.columns.length) return true;
  return layout.columns.some((column, index) => {
    const other = current.columns[index];
    if (!other) return true;
    const weightChanged =
      layout.kind === "columns" && other.weight !== (column.weight || DEFAULT_COLUMN_WEIGHT);
    return weightChanged || other.memberIds.join(",") !== column.memberIds.join(",");
  });
}

export function updatedContainerWrite(
  container: ExistingContainer,
  update: {
    layout: LayoutSpec | null;
    layoutParent: boolean | null;
    makeColumnId: () => string;
    placement: Placement | null;
  },
): SectionWrite {
  const write = blankWrite(container.record.id ?? "");
  write.sequence = container.record.sequence;
  write.type = container.record.type;
  write.style = container.style;
  if (update.placement) assign(write, update.placement);
  if (update.layoutParent !== null) write.layoutParent = update.layoutParent;
  if (update.layout) {
    write.content = layoutContent(
      update.layout.kind,
      asMessage(field(container.record.msg, 12)),
      update.layout,
      update.makeColumnId,
    );
  }
  return write;
}
