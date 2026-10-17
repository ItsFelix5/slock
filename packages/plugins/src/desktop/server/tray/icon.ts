import { deflateSync } from "node:zlib";

const RING = [0x61, 0x1f, 0x69];
const CORE = [0xff, 0xff, 0xff];

function coverage(distance: number, radius: number): number {
  return Math.max(0, Math.min(1, radius - distance + 0.5));
}

export function iconRgba(size: number): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  const middle = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - middle, y - middle);
      const outer = coverage(distance, size / 2 - 0.5);
      const inner = coverage(distance, size / 5);
      const colour = RING.map((c, i) => c * (1 - inner) + (CORE[i] ?? 0) * inner);
      out.set([...colour, outer * 255], (y * size + x) * 4);
    }
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, Bun.hash.crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function iconPng(size: number): Uint8Array {
  const rgba = iconRgba(size);
  const rows = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header.set([8, 6, 0, 0, 0], 8);
  const parts = [
    Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ];
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

export function iconIco(size: number): Uint8Array {
  const png = iconPng(size);
  const head = new Uint8Array(22);
  const view = new DataView(head.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, 1, true);
  head.set([size % 256, size % 256], 6);
  view.setUint16(10, 1, true);
  view.setUint16(12, 32, true);
  view.setUint32(14, png.length, true);
  view.setUint32(18, 22, true);
  return Uint8Array.from([...head, ...png]);
}

export function iconArgb(size: number): number[] {
  const rgba = iconRgba(size);
  const out: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    out.push(rgba[i + 3] ?? 0, rgba[i] ?? 0, rgba[i + 1] ?? 0, rgba[i + 2] ?? 0);
  }
  return out;
}
