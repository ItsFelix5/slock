import { deflateSync } from "node:zlib";
import { int, random } from "./random";
import { type Session, text } from "./slack";
import { words } from "./text";
import type { World } from "./world";

type Asset = { name: string; bytes: Uint8Array<ArrayBuffer> };

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function png(size: number): Uint8Array<ArrayBuffer> {
  const stride = size * 3 + 1;
  const raw = new Uint8Array(stride * size);
  for (let i = 0; i < raw.length; i++) raw[i] = i % stride === 0 ? 0 : Math.floor(random() * 256);
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header[8] = 8;
  header[9] = 2;
  return new Uint8Array(
    Buffer.concat([
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", deflateSync(raw)),
      pngChunk("IEND", new Uint8Array()),
    ]),
  );
}

const encode = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s);

function pdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const stream = lines
    .map((line, i) => `1 0 0 1 40 ${760 - i * 16} Tm (${line.replace(/[()\\]/g, "")}) Tj`)
    .join("\n");
  const body = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\nBT /F1 12 Tf\n${stream}\nET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = body.map((obj, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${body.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${body.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encode(out);
}

const randomBytes = (length: number): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.floor(random() * 256);
  return out;
};

export function assets(): Asset[] {
  const csv = Array.from(
    { length: 20000 },
    (_, i) => `${i},${words(2)},${int(0, 1e6)},"${words(3)}"`,
  ).join("\n");
  const json = JSON.stringify(
    Array.from({ length: 40000 }, (_, i) => ({
      id: i,
      word: words(3),
      nested: { ok: random() < 0.5, list: [1, 2, 3] },
    })),
  );
  const book = Array.from({ length: 10000 }, () => words(12)).join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">${Array.from(
    { length: 2000 },
    () =>
      `<circle cx="${int(0, 800)}" cy="${int(0, 800)}" r="${int(1, 40)}" fill="#${int(0, 0xffffff).toString(16).padStart(6, "0")}"/>`,
  ).join("")}</svg>`;
  return [
    { name: "chaos-noise.png", bytes: png(1200) },
    { name: "chaos-tiny.png", bytes: png(8) },
    { name: "chaos.svg", bytes: encode(svg) },
    { name: "chaos-data.csv", bytes: encode(csv) },
    { name: "chaos-data.json", bytes: encode(json) },
    { name: "chaos-book.txt", bytes: encode(book) },
    { name: "empty.txt", bytes: new Uint8Array() },
    { name: `${"ünïcødé 🔥 名前 ".repeat(8)}.txt`, bytes: encode("unicode filename") },
    { name: "chaos-25mb.bin", bytes: randomBytes(25_000_000) },
    { name: "chaos.pdf", bytes: pdf(Array.from({ length: 30 }, () => words(10))) },
  ];
}

export async function upload(
  session: Session,
  world: World,
  channel: string,
  asset: Asset,
): Promise<void> {
  const slot = await session.callForm("files.getUploadURLExternal", {
    filename: asset.name,
    length: String(asset.bytes.length),
  });
  if (!slot.ok) {
    console.log("upload slot failed", asset.name, slot.error);
    return;
  }
  await fetch(text(slot, "upload_url"), {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: new Blob([asset.bytes]),
  });
  const fileId = text(slot, "file_id");
  const done = await session.callForm("files.completeUploadExternal", {
    files: JSON.stringify([{ id: fileId, title: asset.name }]),
    channel_id: channel,
    initial_comment: words(5),
  });
  if (!done.ok) {
    console.log("upload complete failed", asset.name, done.error);
    return;
  }
  if (asset.name.endsWith(".png")) world.images.push(fileId);
}
