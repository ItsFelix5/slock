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

export function decodeLoadData(bytes: Uint8Array): DecodedCanvas {
  const root = decodeRaw(bytes);
  const payload = asMessage(field(root, 2));
  const document = payload && asMessage(field(payload, 2));
  if (!document) return { meta: null, records: [] };
  const records: SectionRecord[] = [];
  for (const entry of document.get(7) ?? []) {
    const msg = asMessage(entry);
    const record = msg && decodeSection(msg);
    if (record) records.push(record);
  }
  return { meta: decodeMeta(document), records };
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
