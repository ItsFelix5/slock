import type { CanvasFile, CanvasImage, LayoutFrame } from "@slock/types";
import { asMessage, asString, field, type RawField } from "./protobufRaw.ts";
import { encodeRawMessage } from "./rawEncode.ts";
import type { SectionRecord } from "./sections.ts";
import { rawMessage, rawString, rawVarint } from "./sectionWrite.ts";

const FIELD_FILE = 50;
const FIELD_IMAGES = 2;
const FILE_REF_RE = /^sf:/;
const ZERO_DOUBLE: RawField = { fixed64: new Uint8Array(8) };

function content(record: SectionRecord) {
  return asMessage(field(record.msg, 12));
}

export function readFile(record: SectionRecord, frames: LayoutFrame[]): CanvasFile | null {
  const file = asMessage(field(content(record) ?? new Map(), FIELD_FILE));
  if (!(file && record.id)) return null;
  const ref = asMessage(field(asMessage(field(file, 3)) ?? new Map(), 2));
  return {
    fileId: (ref && asString(field(ref, 1)))?.replace(FILE_REF_RE, "") ?? "",
    frames,
    id: record.id,
    kind: "file",
    permalink: asString(field(file, 1)) ?? "",
  };
}

export function readImage(
  record: SectionRecord,
  frames: LayoutFrame[],
  weight: number,
): CanvasImage | null {
  const image = asMessage(content(record)?.get(FIELD_IMAGES)?.[0]);
  const full = image && asMessage(field(image, 3));
  if (!(image && full && record.id)) return null;
  return {
    fileId: asString(field(full, 5)) ?? "",
    frames,
    height: Number(field(full, 3)?.varint ?? 0n),
    id: record.id,
    kind: "image",
    mimetype: asString(field(full, 4)) ?? "",
    name: asString(field(image, 7)) ?? "",
    thumbs: (image.get(4) ?? []).flatMap((entry) => {
      const thumb = asMessage(entry);
      const name = thumb && asString(field(thumb, 6));
      return thumb && name
        ? [
            {
              height: Number(field(thumb, 3)?.varint ?? 0n),
              name,
              width: Number(field(thumb, 2)?.varint ?? 0n),
            },
          ]
        : [];
    }),
    weight,
    width: Number(field(full, 2)?.varint ?? 0n),
  };
}

export function fileContent(node: CanvasFile): number[] {
  const file = new Map([
    [1, [rawString(node.permalink)]],
    [2, [rawVarint(2)]],
    [
      3,
      [rawMessage(new Map([[2, [rawMessage(new Map([[1, [rawString(`sf:${node.fileId}`)]]]))]]]))],
    ],
    [4, [rawVarint(1)]],
    [8, [rawVarint(0)]],
  ]);
  return encodeRawMessage(new Map([[FIELD_FILE, [rawMessage(file)]]]));
}

function pictureMessage(
  node: CanvasImage,
  size: { height: number; name: string | null; width: number },
) {
  const parts = new Map([
    [2, [rawVarint(size.width)]],
    [3, [rawVarint(size.height)]],
    [4, [rawString(node.mimetype)]],
    [5, [rawString(node.fileId)]],
  ]);
  if (size.name) parts.set(6, [rawString(size.name)]);
  return rawMessage(parts);
}

export function imageContent(node: CanvasImage): number[] {
  const image = new Map([
    [1, [rawVarint(0)]],
    [3, [pictureMessage(node, { height: node.height, name: null, width: node.width })]],
    [
      4,
      node.thumbs.map((thumb) =>
        pictureMessage(node, { height: thumb.height, name: thumb.name, width: thumb.width }),
      ),
    ],
    [7, [rawString(node.name)]],
    [12, [ZERO_DOUBLE]],
  ]);
  return encodeRawMessage(new Map([[FIELD_IMAGES, [rawMessage(image)]]]));
}
