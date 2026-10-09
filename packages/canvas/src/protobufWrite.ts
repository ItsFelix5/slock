const encoder = new TextEncoder();

export type Bytes = number[];

export function varint(value: number | bigint): Bytes {
  let rest = BigInt(value);
  const out: Bytes = [];
  while (true) {
    let byte = Number(rest & 0x7fn);
    rest >>= 7n;
    if (rest !== 0n) byte |= 0x80;
    out.push(byte);
    if (rest === 0n) return out;
  }
}

export function tag(field: number, wireType: number): Bytes {
  return varint((field << 3) | wireType);
}

export function messageField(field: number, body: Bytes): Bytes {
  return [...tag(field, 2), ...varint(body.length), ...body];
}

export function stringField(field: number, value: string): Bytes {
  return messageField(field, [...encoder.encode(value)]);
}

export function varintField(field: number, value: number | bigint): Bytes {
  return [...tag(field, 0), ...varint(value)];
}

export function boolField(field: number, value: boolean): Bytes {
  return varintField(field, value ? 1 : 0);
}
