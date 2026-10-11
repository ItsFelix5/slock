import type { RawField, RawMessage } from "./protobufRaw.ts";
import { type Bytes, messageField, tag, varintField } from "./protobufWrite.ts";

function encodeField(num: number, entry: RawField): Bytes {
  if (entry.varint !== undefined) return varintField(num, entry.varint);
  if (entry.bytes) return messageField(num, [...entry.bytes]);
  if (entry.fixed64) return [...tag(num, 1), ...entry.fixed64];
  if (entry.fixed32) return [...tag(num, 5), ...entry.fixed32];
  return [];
}

export function encodeRawMessage(msg: RawMessage): Bytes {
  const out: Bytes = [];
  for (const [num, entries] of msg) {
    for (const entry of entries) out.push(...encodeField(num, entry));
  }
  return out;
}

export function withFields(msg: RawMessage | null, replace: Map<number, RawField[]>): RawMessage {
  const next: RawMessage = new Map(msg ?? []);
  for (const [num, entries] of replace) {
    if (entries.length === 0) next.delete(num);
    else next.set(num, entries);
  }
  return next;
}
