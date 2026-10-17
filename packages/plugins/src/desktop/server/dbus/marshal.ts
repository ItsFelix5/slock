export type Variant = { sig: string; value: unknown };

const ALIGN: Record<string, number> = {
  b: 4,
  d: 8,
  g: 1,
  i: 4,
  n: 2,
  o: 4,
  q: 2,
  s: 4,
  t: 8,
  u: 4,
  v: 1,
  x: 8,
  y: 1,
};

export function end(sig: string, at: number): number {
  const c = sig[at];
  if (c === "a") return end(sig, at + 1);
  if (c === "(" || c === "{") {
    let depth = 0;
    for (let i = at; i < sig.length; i++) {
      if (sig[i] === "(" || sig[i] === "{") depth++;
      if (sig[i] === ")" || sig[i] === "}") depth--;
      if (depth === 0) return i + 1;
    }
    throw new Error(`bad signature ${sig}`);
  }
  return at + 1;
}

export function split(sig: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < sig.length; ) {
    const next = end(sig, i);
    out.push(sig.slice(i, next));
    i = next;
  }
  return out;
}

function alignOf(sig: string): number {
  const c = sig[0] ?? "y";
  if (c === "(" || c === "{") return 8;
  return ALIGN[c] ?? 4;
}

export class Writer {
  bytes: number[] = [];

  align(n: number) {
    while (this.bytes.length % n) this.bytes.push(0);
  }

  private number(size: number, write: (view: DataView) => void) {
    this.align(size);
    const view = new DataView(new ArrayBuffer(size));
    write(view);
    this.bytes.push(...new Uint8Array(view.buffer));
  }

  private text(value: string, lengthBytes: 1 | 4) {
    const data = new TextEncoder().encode(value);
    if (lengthBytes === 1) this.bytes.push(data.length);
    else this.number(4, (v) => v.setUint32(0, data.length, true));
    this.bytes.push(...data, 0);
  }

  write(sig: string, value: unknown) {
    const c = sig[0];
    if (c === "y") this.bytes.push(Number(value));
    else if (c === "b") this.number(4, (v) => v.setUint32(0, value ? 1 : 0, true));
    else if (c === "n") this.number(2, (v) => v.setInt16(0, Number(value), true));
    else if (c === "q") this.number(2, (v) => v.setUint16(0, Number(value), true));
    else if (c === "i") this.number(4, (v) => v.setInt32(0, Number(value), true));
    else if (c === "u") this.number(4, (v) => v.setUint32(0, Number(value), true));
    else if (c === "x") this.number(8, (v) => v.setBigInt64(0, BigInt(value as number), true));
    else if (c === "t") this.number(8, (v) => v.setBigUint64(0, BigInt(value as number), true));
    else if (c === "d") this.number(8, (v) => v.setFloat64(0, Number(value), true));
    else if (c === "s" || c === "o") this.text(String(value), 4);
    else if (c === "g") this.text(String(value), 1);
    else if (c === "v") {
      const variant = value as Variant;
      this.text(variant.sig, 1);
      this.write(variant.sig, variant.value);
    } else if (c === "a") this.array(sig.slice(1), value as unknown[]);
    else if (c === "(") {
      this.align(8);
      const parts = split(sig.slice(1, -1));
      parts.forEach((part, i) => {
        this.write(part, (value as unknown[])[i]);
      });
    } else if (c === "{") {
      this.align(8);
      const [key, val] = split(sig.slice(1, -1));
      this.write(key ?? "", (value as unknown[])[0]);
      this.write(val ?? "", (value as unknown[])[1]);
    } else throw new Error(`cannot write ${sig}`);
  }

  private array(element: string, items: unknown[]) {
    this.align(4);
    const lengthAt = this.bytes.length;
    this.bytes.push(0, 0, 0, 0);
    this.align(alignOf(element));
    const start = this.bytes.length;
    for (const item of items) this.write(element, item);
    const length = this.bytes.length - start;
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, length, true);
    this.bytes.splice(lengthAt, 4, ...new Uint8Array(view.buffer));
  }
}

export class Reader {
  at: number;
  private data: Uint8Array;
  private view: DataView;

  constructor(data: Uint8Array, at = 0) {
    this.data = data;
    this.at = at;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  align(n: number) {
    while (this.at % n) this.at++;
  }

  private take<T>(size: number, read: (view: DataView, at: number) => T): T {
    this.align(size);
    const result = read(this.view, this.at);
    this.at += size;
    return result;
  }

  private text(lengthBytes: 1 | 4): string {
    const length =
      lengthBytes === 1 ? this.read("y") : this.take(4, (v, at) => v.getUint32(at, true));
    const value = new TextDecoder().decode(this.data.subarray(this.at, this.at + Number(length)));
    this.at += Number(length) + 1;
    return value;
  }

  read(sig: string): unknown {
    const c = sig[0];
    if (c === "y") return this.data[this.at++] ?? 0;
    if (c === "b") return this.take(4, (v, at) => v.getUint32(at, true)) !== 0;
    if (c === "n") return this.take(2, (v, at) => v.getInt16(at, true));
    if (c === "q") return this.take(2, (v, at) => v.getUint16(at, true));
    if (c === "i") return this.take(4, (v, at) => v.getInt32(at, true));
    if (c === "u") return this.take(4, (v, at) => v.getUint32(at, true));
    if (c === "x") return Number(this.take(8, (v, at) => v.getBigInt64(at, true)));
    if (c === "t") return Number(this.take(8, (v, at) => v.getBigUint64(at, true)));
    if (c === "d") return this.take(8, (v, at) => v.getFloat64(at, true));
    if (c === "s" || c === "o") return this.text(4);
    if (c === "g") return this.text(1);
    if (c === "v") {
      const inner = this.text(1);
      return { sig: inner, value: this.read(inner) } satisfies Variant;
    }
    if (c === "a") {
      const element = sig.slice(1);
      const length = this.take(4, (v, at) => v.getUint32(at, true));
      this.align(alignOf(element));
      const stop = this.at + length;
      const items: unknown[] = [];
      while (this.at < stop) items.push(this.read(element));
      return items;
    }
    if (c === "(" || c === "{") {
      this.align(8);
      return split(sig.slice(1, -1)).map((part) => this.read(part));
    }
    throw new Error(`cannot read ${sig}`);
  }
}

export function encode(sig: string, values: unknown[]): number[] {
  const writer = new Writer();
  split(sig).forEach((part, i) => {
    writer.write(part, values[i]);
  });
  return writer.bytes;
}

export function decode(sig: string, data: Uint8Array): unknown[] {
  const reader = new Reader(data);
  return split(sig).map((part) => reader.read(part));
}
