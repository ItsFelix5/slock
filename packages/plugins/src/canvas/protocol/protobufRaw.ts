import { defined } from "@slock/core";
export type RawField = {
  bytes?: Uint8Array;
  fixed32?: Uint8Array;
  fixed64?: Uint8Array;
  varint?: bigint;
};
export type RawMessage = Map<number, RawField[]>;

function readVarint(buf: Uint8Array, pos: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  while (true) {
    const byte = buf[pos++];
    result |= BigInt(defined(byte) & 0x7f) << shift;
    if ((defined(byte) & 0x80) === 0) break;
    shift += 7n;
  }
  return [result, pos];
}

function slice(buf: Uint8Array, from: number, length: number, end: number): Uint8Array {
  if (from + length > end) throw new Error(`canvas collab: truncated field at byte ${from}`);
  return buf.subarray(from, from + length);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const decoder = new TextDecoder();

export function decodeRaw(buf: Uint8Array, start = 0, end = buf.length): RawMessage {
  const out: RawMessage = new Map();
  let pos = start;
  while (pos < end) {
    const [tag, afterTag] = readVarint(buf, pos);
    pos = afterTag;
    const fieldNum = Number(tag >> 3n);
    const wireType = Number(tag & 0x7n);
    const list = out.get(fieldNum) ?? [];
    if (wireType === 0) {
      const [v, next] = readVarint(buf, pos);
      pos = next;
      list.push({ varint: v });
    } else if (wireType === 1) {
      list.push({ fixed64: slice(buf, pos, 8, end) });
      pos += 8;
    } else if (wireType === 2) {
      const [len, next] = readVarint(buf, pos);
      list.push({ bytes: slice(buf, next, Number(len), end) });
      pos = next + Number(len);
    } else if (wireType === 5) {
      list.push({ fixed32: slice(buf, pos, 4, end) });
      pos += 4;
    } else {
      throw new Error(`canvas collab: unsupported wire type ${wireType} at byte ${pos}`);
    }
    out.set(fieldNum, list);
  }
  return out;
}

export function field(msg: RawMessage, num: number): RawField | undefined {
  return msg.get(num)?.[0];
}

export function asMessage(f: RawField | undefined): RawMessage | null {
  return f?.bytes ? decodeRaw(f.bytes) : null;
}

export function asString(f: RawField | undefined): string | null {
  return f?.bytes ? decoder.decode(f.bytes) : null;
}

export function asDouble(f: RawField | undefined): number | null {
  return f?.fixed64
    ? new DataView(f.fixed64.buffer, f.fixed64.byteOffset, 8).getFloat64(0, true)
    : null;
}

export function maybeMessage(bytes: Uint8Array): RawMessage | null {
  try {
    return decodeRaw(bytes);
  } catch {
    return null;
  }
}

const PRINTABLE_RE = /^[\x20-\x7e]+$/;

function maybeText(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function dumpBytes(bytes: Uint8Array): unknown {
  const text = maybeText(bytes);
  if (text !== null && PRINTABLE_RE.test(text)) return text;
  const message = maybeMessage(bytes);
  return message ? dumpRaw(message) : (text ?? toHex(bytes));
}

export function dumpRaw(msg: RawMessage): unknown {
  const out: Record<number, unknown[]> = {};
  for (const [num, entries] of msg) {
    out[num] = entries.map((f) => {
      if (f.varint !== undefined)
        return f.varint <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(f.varint) : f.varint.toString();
      if (f.bytes) return dumpBytes(f.bytes);
      if (f.fixed64) return toHex(f.fixed64);
      if (f.fixed32) return toHex(f.fixed32);
      return null;
    });
  }
  return out;
}
