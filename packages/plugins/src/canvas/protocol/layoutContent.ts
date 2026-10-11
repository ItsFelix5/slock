import {
  STYLE_CALLOUT,
  STYLE_COLUMNS,
  STYLE_QUOTE,
  TYPE_CALLOUT,
  TYPE_COLUMNS,
  TYPE_QUOTE,
} from "./lineStyles.ts";
import { asMessage, asString, field, type RawField, type RawMessage } from "./protobufRaw.ts";
import { encodeRawMessage, withFields } from "./rawEncode.ts";
import type { SectionRecord } from "./sections.ts";
import { rawMessage, rawString, rawVarint } from "./sectionWrite.ts";

export type LayoutKind = "callout" | "columns" | "quote";

export interface LayoutColumn {
  memberIds: string[];
  weight: number;
}

export interface LayoutRead {
  color: number;
  columns: LayoutColumn[];
  kind: LayoutKind;
}

export const DEFAULT_COLUMN_WEIGHT = 3;
export const FULL_WIDTH_WEIGHT = 6;

const FIELD_CALLOUT = 63;
const FIELD_COLUMNS = 24;
const FIELD_QUOTE = 65;

export function layoutKindOf(record: { style: number; type: number }): LayoutKind | null {
  if (record.type === TYPE_QUOTE && record.style === STYLE_QUOTE) return "quote";
  if (record.type === TYPE_CALLOUT && record.style === STYLE_CALLOUT) return "callout";
  if (record.type === TYPE_COLUMNS && record.style === STYLE_COLUMNS) return "columns";
  return null;
}

export function styleOfLayout(kind: LayoutKind): { style: number; type: number } {
  if (kind === "quote") return { style: STYLE_QUOTE, type: TYPE_QUOTE };
  if (kind === "callout") return { style: STYLE_CALLOUT, type: TYPE_CALLOUT };
  return { style: STYLE_COLUMNS, type: TYPE_COLUMNS };
}

function strings(fields: RawField[] | undefined): string[] {
  return (fields ?? []).flatMap((entry) => asString(entry) ?? []);
}

export function readLayout(record: SectionRecord): LayoutRead | null {
  const kind = layoutKindOf(record);
  const content = asMessage(field(record.msg, 12));
  if (!(kind && content)) return null;
  if (kind === "quote") {
    const quote = asMessage(field(content, FIELD_QUOTE));
    return { color: 0, columns: [{ memberIds: strings(quote?.get(1)), weight: 0 }], kind };
  }
  if (kind === "callout") {
    const callout = asMessage(field(content, FIELD_CALLOUT));
    const columns = (callout?.get(1) ?? []).map((item) => {
      const message = asMessage(item);
      return { memberIds: message ? strings(message.get(2)) : [], weight: 0 };
    });
    return {
      color: Number(callout ? (field(callout, 2)?.varint ?? 0n) : 0n),
      columns,
      kind,
    };
  }
  const container = asMessage(field(content, FIELD_COLUMNS));
  const columns = (container?.get(1) ?? []).map((item) => {
    const message = asMessage(item);
    return {
      memberIds: message ? strings(message.get(1)) : [],
      weight: Number((message && field(message, 2)?.varint) ?? DEFAULT_COLUMN_WEIGHT),
    };
  });
  return { color: 0, columns, kind };
}

export function layoutMemberIds(record: SectionRecord): string[] {
  return readLayout(record)?.columns.flatMap((column) => column.memberIds) ?? [];
}

function quoteContent(memberIds: string[]): RawMessage {
  const quote = new Map([[1, memberIds.map(rawString)]]);
  return new Map([[FIELD_QUOTE, [rawMessage(quote)]]]);
}

function calloutContent(
  existing: RawMessage | null,
  memberIds: string[],
  color: number,
  makeColumnId: () => string,
): RawMessage {
  const callout = existing && asMessage(field(existing, FIELD_CALLOUT));
  const item = callout && asMessage(callout.get(1)?.[0]);
  const column = withFields(
    item ?? new Map([[1, [rawString(makeColumnId())]]]),
    new Map([[2, memberIds.map(rawString)]]),
  );
  const next = withFields(callout, new Map([[1, [rawMessage(column)]]]));
  next.set(2, [rawVarint(color)]);
  return withFields(existing, new Map([[FIELD_CALLOUT, [rawMessage(next)]]]));
}

function columnsContent(existing: RawMessage | null, columns: LayoutColumn[]): RawMessage {
  const previous = existing && asMessage(field(existing, FIELD_COLUMNS));
  const items = columns.map((column) =>
    rawMessage(
      new Map([
        [1, column.memberIds.map(rawString)],
        [2, [rawVarint(column.weight)]],
      ]),
    ),
  );
  const next = withFields(previous, new Map([[1, items]]));
  if (!next.has(2)) next.set(2, [rawVarint(1)]);
  return withFields(existing, new Map([[FIELD_COLUMNS, [rawMessage(next)]]]));
}

export function layoutContent(
  kind: LayoutKind,
  existing: RawMessage | null,
  layout: { color: number; columns: LayoutColumn[] },
  makeColumnId: () => string,
): number[] {
  const memberIds = layout.columns.flatMap((column) => column.memberIds);
  if (kind === "quote") return encodeRawMessage(quoteContent(memberIds));
  if (kind === "callout")
    return encodeRawMessage(calloutContent(existing, memberIds, layout.color, makeColumnId));
  return encodeRawMessage(columnsContent(existing, layout.columns));
}

export function imageFileIds(content: RawMessage): string[] {
  const ids: string[] = [];
  for (const entry of content.get(2) ?? []) {
    const img = asMessage(entry);
    const full = img && asMessage(field(img, 3));
    const fileId = full && asString(field(full, 5));
    if (fileId) ids.push(fileId);
  }
  return ids;
}
