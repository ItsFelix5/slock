import type { CanvasControl, CanvasFile, CanvasImage, CanvasLine } from "@slock/types";
import { fileContent, imageContent } from "./fileContent.ts";
import { type FlowEntry, sectionText } from "./flow.ts";
import {
  lineShapeForStyle,
  listStyleForKind,
  STYLE_DIVIDER,
  STYLE_FILE,
  STYLE_IMAGE,
  STYLE_TITLE,
  styleForLine,
  TYPE_DIVIDER,
  TYPE_FILE,
  TYPE_IMAGE,
  TYPE_TEXT,
  TYPE_TITLE,
} from "./lineStyles.ts";
import { asMessage, field, type RawMessage } from "./protobufRaw.ts";
import { encodeRawMessage, withFields } from "./rawEncode.ts";
import type { SectionRecord } from "./sections.ts";
import {
  blankWrite,
  escapeCanvasHtml,
  rawMessage,
  rawString,
  rawVarint,
  type SectionWrite,
  textContent,
} from "./sectionWrite.ts";

export interface Placement {
  forcePath: boolean;
  layoutParent: boolean;
  list: { id: string; style: number } | null;
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

function parentsFor(placement: Placement): SectionWrite["parents"] {
  const { list } = placement;
  return list ? { containerStyle: list.style, id: list.id } : "none";
}

function shapeStyle(line: CanvasLine, listStyle: number | null): number {
  if (line.kind === "divider") return STYLE_DIVIDER;
  return listStyle === null ? styleForLine(line) : 0;
}

function plainKind(record: SectionRecord): CanvasLine["kind"] {
  return record.type === TYPE_DIVIDER ? "divider" : lineShapeForStyle(record.style).kind;
}

export function newLineWrite(line: CanvasLine, placement: Placement): SectionWrite {
  const write = blankWrite(line.id);
  const listStyle = listStyleForKind(line.kind);
  write.type = line.kind === "divider" ? TYPE_DIVIDER : TYPE_TEXT;
  write.style = shapeStyle(line, listStyle);
  write.content = line.kind === "divider" ? [] : textContent(null, null, line.html);
  write.attrs = attributesFor(null, line, listStyle);
  write.parents = parentsFor(placement);
  write.layoutParent = placement.layoutParent;
  assignPlacement(write, placement);
  return write;
}

function structureChanges(write: SectionWrite, entry: FlowEntry, placement: Placement): boolean {
  const { existing } = entry;
  if (!existing) return false;
  let changed = false;
  const listChanged = (placement.list?.id ?? null) !== existing.listId;
  if (listChanged) {
    write.parents = parentsFor(placement);
    changed = true;
  }
  if (existing.record.layoutParent !== placement.layoutParent) {
    write.layoutParent = placement.layoutParent;
    changed = true;
  }
  const moved = placement.position !== existing.position;
  if (listChanged || placement.forcePath || moved) {
    assignPlacement(write, placement);
    changed = true;
  }
  return changed;
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
  const shape = lineShapeForStyle(record.style);
  const kindChanged =
    (existing.listId !== null) !== (listStyle !== null) ||
    (listStyle === null &&
      (plainKind(record) !== line.kind || (line.kind !== "divider" && shape.level !== line.level)));
  if (kindChanged) {
    write.type = line.kind === "divider" ? TYPE_DIVIDER : TYPE_TEXT;
    write.style = shapeStyle(line, listStyle);
    changed = true;
  }
  if (line.kind !== "divider" && line.html !== sectionText(record)) {
    const content = contentOf(record);
    write.content = textContent(content, content && asMessage(field(content, 1)), line.html);
    changed = true;
  }
  const attrs = asMessage(field(record.msg, 16));
  if (kindChanged || (listStyle !== null && attrsDiffer(attrs, line))) {
    write.attrs = attributesFor(attrs, line, listStyle);
    changed = true;
  }
  if (structureChanges(write, entry, placement)) changed = true;
  return changed ? write : null;
}

export function newFileWrite(node: CanvasFile, placement: Placement): SectionWrite {
  const write = blankWrite(node.id);
  write.type = TYPE_FILE;
  write.style = STYLE_FILE;
  write.content = fileContent(node);
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  write.parents = "none";
  write.layoutParent = placement.layoutParent;
  assignPlacement(write, placement);
  return write;
}

export function newImageWrite(node: CanvasImage, placement: Placement): SectionWrite {
  const write = blankWrite(node.id);
  write.type = TYPE_IMAGE;
  write.style = STYLE_IMAGE;
  write.content = imageContent(node);
  write.attrs = encodeRawMessage(new Map([[4, [rawVarint(0)]]]));
  write.parents = "none";
  write.layoutParent = placement.layoutParent;
  assignPlacement(write, placement);
  return write;
}

export function movedAtomWrite(entry: FlowEntry, placement: Placement): SectionWrite | null {
  const { existing } = entry;
  if (!existing) return null;
  const write = blankWrite(entry.id);
  write.sequence = existing.record.sequence;
  write.type = existing.record.type;
  write.style = existing.record.style;
  return structureChanges(write, entry, placement) ? write : null;
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
  if (control.kind === "date") write.label = control.label;
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
      new Map([
        [
          58,
          [
            rawMessage(
              withFields(titleMessage, new Map([[1, [rawString(escapeCanvasHtml(text))]]])),
            ),
          ],
        ],
      ]),
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
