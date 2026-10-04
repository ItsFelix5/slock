import type { RawField, RawMessage } from "./protobufRaw.ts";
import { type Bytes, boolField, messageField, stringField, varintField } from "./protobufWrite.ts";
import { encodeRawMessage, withFields } from "./rawEncode.ts";

const encoder = new TextEncoder();
const AMPERSAND_RE = /&/g;
const LESS_THAN_RE = /</g;
const GREATER_THAN_RE = />/g;

export function escapeCanvasHtml(text: string): string {
  return text
    .replace(AMPERSAND_RE, "&amp;")
    .replace(LESS_THAN_RE, "&lt;")
    .replace(GREATER_THAN_RE, "&gt;");
}

export interface SectionWrite {
  attrs: Bytes | null;
  content: Bytes | null;
  deleted: boolean;
  id: string;
  layoutParent: boolean | null;
  parents: { containerStyle: number; id: string } | "none" | null;
  position: string | null;
  sectionClass: number | null;
  sequence: number;
  style: number | null;
  type: number | null;
  path: string | null;
}

export function blankWrite(id: string): SectionWrite {
  return {
    attrs: null,
    content: null,
    deleted: false,
    id,
    layoutParent: null,
    parents: null,
    path: null,
    position: null,
    sectionClass: null,
    sequence: 0,
    style: null,
    type: null,
  };
}

export function rawString(value: string): RawField {
  return { bytes: encoder.encode(value) };
}

export function rawVarint(value: number): RawField {
  return { varint: BigInt(value) };
}

export function rawMessage(msg: RawMessage): RawField {
  return { bytes: Uint8Array.from(encodeRawMessage(msg)) };
}

export function textContent(
  existing: RawMessage | null,
  existingText: RawMessage | null,
  html: string,
) {
  const text = withFields(existingText, new Map([[1, [rawString(html)]]]));
  return encodeRawMessage(withFields(existing, new Map([[1, [rawMessage(text)]]])));
}

export function encodeSection(write: SectionWrite): Bytes {
  const out: Bytes = [...stringField(1, write.id), ...varintField(2, write.sequence)];
  if (write.deleted) out.push(...boolField(3, true));
  if (write.position !== null) out.push(...stringField(8, write.position));
  if (write.type !== null) out.push(...varintField(9, write.type));
  if (write.style !== null) out.push(...varintField(10, write.style));
  if (write.sectionClass !== null) out.push(...varintField(11, write.sectionClass));
  if (write.content !== null) out.push(...messageField(12, write.content));
  if (write.parents === "none") out.push(...messageField(13, []));
  else if (write.parents)
    out.push(
      ...messageField(13, [
        ...stringField(1, write.parents.id),
        ...varintField(4, write.parents.containerStyle),
      ]),
    );
  if (write.attrs !== null) out.push(...messageField(16, write.attrs));
  out.push(...boolField(19, true), ...varintField(25, 1));
  if (write.path !== null) out.push(...stringField(21, write.path));
  if (write.layoutParent !== null) out.push(...boolField(29, write.layoutParent));
  return out;
}

export function encodeDocumentData(writes: SectionWrite[]): Bytes {
  return writes.flatMap((write) => messageField(1, encodeSection(write)));
}
