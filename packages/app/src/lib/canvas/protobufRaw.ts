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
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7n;
  }
  return [result, pos];
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

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
      list.push({ fixed64: buf.slice(pos, pos + 8) });
      pos += 8;
    } else if (wireType === 2) {
      const [len, next] = readVarint(buf, pos);
      const dataEnd = next + Number(len);
      list.push({ bytes: buf.slice(next, dataEnd) });
      pos = dataEnd;
    } else if (wireType === 5) {
      list.push({ fixed32: buf.slice(pos, pos + 4) });
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
  return f?.bytes ? new TextDecoder().decode(f.bytes) : null;
}

export function asDouble(f: RawField | undefined): number | null {
  return f?.fixed64
    ? new DataView(f.fixed64.buffer, f.fixed64.byteOffset, 8).getFloat64(0, true)
    : null;
}

export function dumpRaw(msg: RawMessage): unknown {
  const out: Record<number, unknown[]> = {};
  for (const [num, entries] of msg) {
    out[num] = entries.map((f) => {
      if (f.varint !== undefined)
        return f.varint <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(f.varint) : f.varint.toString();
      if (f.bytes) {
        try {
          return dumpRaw(decodeRaw(f.bytes));
        } catch {
          const text = new TextDecoder("utf-8", { fatal: true });
          try {
            return text.decode(f.bytes);
          } catch {
            return toHex(f.bytes);
          }
        }
      }
      if (f.fixed64) return toHex(f.fixed64);
      if (f.fixed32) return toHex(f.fixed32);
      return null;
    });
  }
  return out;
}
