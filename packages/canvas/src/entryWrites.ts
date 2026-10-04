import type { CanvasControl, CanvasLine } from "@slock/types";
import type { ExistingContainer, FlowEntry } from "./flow.ts";
import { sectionText } from "./flow.ts";
import {
  lineShapeForStyle,
  listStyleForKind,
  STYLE_DIVIDER,
  STYLE_TITLE,
  styleForLine,
  TYPE_DIVIDER,
  TYPE_LIST,
  TYPE_TEXT,
  TYPE_TITLE,
} from "./lineStyles.ts";
import { asMessage, field, type RawMessage } from "./protobufRaw.ts";
import { encodeRawMessage, withFields } from "./rawEncode.ts";
import type { SectionRecord } from "./sections.ts";
import {
  blankWrite,
  rawMessage,
  rawString,
  rawVarint,
  type SectionWrite,
  textContent,
} from "./sectionWrite.ts";

export interface Placement {
  forcePath: boolean;
  parent: { id: string; style: number } | null;
  path: string;
  position: string;
}

const CONTROL_CLASS = 1;
const CONTROL_TYPES = { channel: 49, date: 68, emoji: 54, user: 50 } as const;

function contentOf(record: SectionRecord): RawMessage | null {
  return asMessage(field(record.msg, 12));
}

function attributesFor(
  existing: RawMessage | null,
  line: CanvasLine,
  listStyle: number | null,
): number[] {
  const base = withFields(existing, new Map([[4, [rawVarint(0)]]]));
  if (listStyle === null)
    return encodeRawMessage(
      withFields(
        base,
        new Map([
          [1, []],
          [2, []],
        ]),
      ),
    );
  return encodeRawMessage(
    withFields(
      base,
      new Map([
        [1, [rawVarint(line.indent)]],
        [2, line.kind === "checklist" && line.checked ? [rawVarint(1)] : []],
      ]),
    ),
  );
}

function attrsDiffer(existing: RawMessage | null, line: CanvasLine): boolean {
  const indent = Number(existing ? (field(existing, 1)?.varint ?? 0n) : 0n);
  const checked = Number(existing ? (field(existing, 2)?.varint ?? 0n) : 0n) !== 0;
  return indent !== line.indent || checked !== (line.kind === "checklist" && line.checked);
}

function assignPlacement(write: SectionWrite, placement: Placement) {
  write.position = placement.position;
  write.path = placement.path;
}

export function newLineWrite(line: CanvasLine, placement: Placement): SectionWrite {
  const write = blankWrite(line.id);
  const listStyle = listStyleForKind(line.kind);
  if (line.kind === "divider") {
    write.type = TYPE_DIVIDER;
    write.style = STYLE_DIVIDER;
    write.content = [];
  } else {
    write.type = TYPE_TEXT;
    write.style = listStyle === null ? styleForLine(line) : 0;
    write.content = textContent(null, null, line.html);
  }
  write.attrs = attributesFor(null, line, listStyle);
  write.parents = placement.parent
    ? { containerStyle: placement.parent.style, id: placement.parent.id }
    : "none";
  assignPlacement(write, placement);
  return write;
}

export function changedLineWrite(
  entry: FlowEntry,
  line: CanvasLine,
  placement: Placement,
): SectionWrite | null {
  const { existing } = entry;
  if (!existing) return null;
  const { record } = existing;
  const write = blankWrite(entry.id);
  write.sequence = record.sequence;
  write.type = record.type;
  let changed = false;
  const listStyle = listStyleForKind(line.kind);
  const wasList = existing.containerId !== null;
  const shape = lineShapeForStyle(record.style);
  const shapeChanged =
    wasList !== (listStyle !== null) ||
    (listStyle === null && (shape.kind !== line.kind || shape.level !== line.level));
  if (shapeChanged) {
    write.style = listStyle === null ? styleForLine(line) : 0;
    changed = true;
  }
  if (line.kind !== "divider" && line.html !== sectionText(record)) {
    const content = contentOf(record);
    write.content = textContent(content, content && asMessage(field(content, 1)), line.html);
    changed = true;
  }
  const attrs = asMessage(field(record.msg, 16));
  if (shapeChanged || (listStyle !== null && attrsDiffer(attrs, line))) {
    write.attrs = attributesFor(attrs, line, listStyle);
    changed = true;
  }
  const parentChanged = (placement.parent?.id ?? null) !== existing.containerId;
  if (parentChanged) {
    write.parents = placement.parent
      ? { containerStyle: placement.parent.style, id: placement.parent.id }
      : "none";
    changed = true;
  }
  if (parentChanged || placement.forcePath || placement.position !== existing.position) {
    assignPlacement(write, placement);
    changed = true;
  }
  return changed ? write : null;
}

export function newContainerWrite(id: string, style: number, placement: Placement): SectionWrite {
  const write = blankWrite(id);
  write.type = TYPE_LIST;
  write.style = style;
  write.content = [];
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  assignPlacement(write, placement);
  return write;
}

export function movedContainerWrite(
  container: ExistingContainer,
  placement: Placement,
): SectionWrite {
  const write = blankWrite(container.record.id ?? "");
  write.sequence = container.record.sequence;
  write.type = TYPE_LIST;
  write.style = container.style;
  assignPlacement(write, placement);
  return write;
}

export function deleteWrite(record: SectionRecord): SectionWrite {
  const write = blankWrite(record.id ?? "");
  write.deleted = true;
  write.sequence = record.sequence;
  write.type = record.type;
  write.style = record.style;
  write.content = encodeRawMessage(contentOf(record) ?? new Map());
  return write;
}

function controlContent(control: CanvasControl): RawMessage {
  const message = (num: number, fields: Map<number, ReturnType<typeof rawString>[]>) =>
    new Map([[num, [rawMessage(fields)]]]);
  if (control.kind === "user")
    return message(44, new Map([[1, [rawString(`su:${control.userId}`)]]]));
  if (control.kind === "channel")
    return message(42, new Map([[1, [rawString(`sc:${control.channelId}`)]]]));
  if (control.kind === "emoji")
    return message(48, new Map([[3, [rawString(`se:${control.name}/${control.teamId}`)]]]));
  return message(62, new Map([[1, [rawVarint(control.ms)]]]));
}

export function controlWrite(control: CanvasControl): SectionWrite {
  const write = blankWrite(control.id);
  write.sectionClass = CONTROL_CLASS;
  write.type = CONTROL_TYPES[control.kind];
  write.content = encodeRawMessage(controlContent(control));
  return write;
}

export function titleWrite(
  existing: SectionRecord | null,
  id: string,
  text: string,
  position: string,
): SectionWrite {
  const write = blankWrite(existing?.id ?? id);
  write.type = TYPE_TITLE;
  const content = existing ? contentOf(existing) : null;
  const titleMessage = content && asMessage(field(content, 58));
  write.content = encodeRawMessage(
    withFields(
      content,
      new Map([[58, [rawMessage(withFields(titleMessage, new Map([[1, [rawString(text)]]])))]]]),
    ),
  );
  if (existing) {
    write.sequence = existing.sequence;
    return write;
  }
  write.style = STYLE_TITLE;
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  write.position = position;
  write.path = position;
  return write;
}
