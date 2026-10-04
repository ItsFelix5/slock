import { asMessage, asString, decodeRaw, field, type RawMessage } from "./protobufRaw.ts";

export const ORPHANED_EMBED_RECORDS_ANCHOR = "zzzzzz-orphaned-m";
export const SECTION_TYPE_DIVIDER = 16;

export interface SectionRecord {
  anchor: string;
  id: string | null;
  layoutParent: boolean;
  msg: RawMessage;
  parentIds: string[];
  sectionClass: number;
  sequence: number;
  style: number;
  type: number;
}

export interface CanvasMeta {
  documentId: string;
  secretPath: string;
  shardChars: string;
  threadId: string;
}

export interface DecodedCanvas {
  meta: CanvasMeta | null;
  records: SectionRecord[];
}

function numberField(msg: RawMessage, num: number): number {
  return Number(field(msg, num)?.varint ?? 0n);
}

function decodeSection(msg: RawMessage): SectionRecord | null {
  const anchor = asString(field(msg, 21)) ?? asString(field(msg, 8)) ?? asString(field(msg, 1));
  if (!anchor) return null;
  const parents = asMessage(field(msg, 13));
  return {
    anchor,
    id: asString(field(msg, 1)),
    layoutParent: numberField(msg, 29) !== 0,
    msg,
    parentIds: (parents?.get(1) ?? []).map((entry) => asString(entry) ?? ""),
    sectionClass: numberField(msg, 11),
    sequence: numberField(msg, 2),
    style: numberField(msg, 10),
    type: numberField(msg, 9),
  };
}

function decodeMeta(document: RawMessage): CanvasMeta | null {
  const thread = asMessage(field(document, 3));
  const doc = asMessage(field(document, 6));
  const threadId = thread && asString(field(thread, 1));
  const documentId = doc && asString(field(doc, 1));
  if (!(thread && doc && threadId && documentId)) return null;
  const secretPath = asMessage(field(thread, 7));
  return {
    documentId,
    secretPath: (secretPath && asString(field(secretPath, 9))) ?? "",
    shardChars: asString(field(doc, 42)) || documentId.slice(0, 3),
    threadId,
  };
}

function recordsIn(message: RawMessage | null, num: number): SectionRecord[] {
  return (message?.get(num) ?? []).flatMap((entry) => {
    const msg = asMessage(entry);
    const record = msg && decodeSection(msg);
    return record ? [record] : [];
  });
}

export function decodeRecords(bytes: Uint8Array, path: number[]): SectionRecord[] {
  let message: RawMessage | null = decodeRaw(bytes);
  for (const num of path.slice(0, -1)) message = message && asMessage(field(message, num));
  const last = path.at(-1);
  return last === undefined ? [] : recordsIn(message, last);
}

export function decodeLoadData(bytes: Uint8Array): DecodedCanvas {
  const payload = asMessage(field(decodeRaw(bytes), 2));
  const document = payload && asMessage(field(payload, 2));
  if (!document) return { meta: null, records: [] };
  return { meta: decodeMeta(document), records: recordsIn(document, 7) };
}

const SECTION_ID_RE = /^temp:C:[A-Za-z0-9_-]{3}[0-9a-f]{25}$/;

export function newSectionId(shardChars: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(13));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `temp:C:${shardChars}${hex.slice(0, 25)}`;
}

export function isSectionId(id: string): boolean {
  return SECTION_ID_RE.test(id);
}
