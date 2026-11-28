import { isChannelId, isFileId, isTs } from "@slock/slack";
import type { CanvasCard, CanvasFile, CanvasImage, LayoutFrame } from "@slock/types";
import { asMessage, asString, field, type RawField, type RawMessage } from "./protobufRaw.ts";
import { encodeRawMessage } from "./rawEncode.ts";
import type { SectionRecord } from "./sections.ts";
import { rawMessage, rawString, rawVarint } from "./sectionWrite.ts";

const FIELD_ATTACHMENT = 50;
const FIELD_IMAGES = 2;
const KIND_FILE = 2;
const KIND_CARD = 3;
const FLAG_FILE = 4;
const FLAG_MESSAGE_CARD = 6;
const FILE_REF_PREFIX = "sf:";
const CARD_REF = /^suo:([^/]+)\/([^/]+)\/([^/]+)$/;
const ZERO_DOUBLE: RawField = { fixed64: new Uint8Array(8) };

function content(record: SectionRecord) {
  return asMessage(field(record.msg, 12));
}

function attachmentRef(attachment: RawMessage, kind: number): string {
  const slot = asMessage(field(asMessage(field(attachment, 3)) ?? new Map(), kind));
  return (slot && asString(field(slot, 1))) ?? "";
}

export function readAttachment(
  record: SectionRecord,
  frames: LayoutFrame[],
): CanvasCard | CanvasFile | null {
  const attachment = asMessage(field(content(record) ?? new Map(), FIELD_ATTACHMENT));
  const { id } = record;
  if (!(attachment && id)) return null;
  const url = asString(field(attachment, 1)) ?? "";
  const fileRef = attachmentRef(attachment, KIND_FILE);
  const fileId = fileRef.startsWith(FILE_REF_PREFIX)
    ? fileRef.slice(FILE_REF_PREFIX.length)
    : fileRef;
  if (isFileId(fileId)) return { fileId, frames, id, kind: "file", permalink: url };
  const [, ownerId, channelId = "", ts = ""] =
    attachmentRef(attachment, KIND_CARD).match(CARD_REF) ?? [];
  if (!(ownerId && isChannelId(channelId) && isTs(ts))) return null;
  const isMessage = field(attachment, FLAG_MESSAGE_CARD)?.varint === 1n;
  return { channelId, frames, id, isMessage, kind: "card", ownerId, ts, url };
}

export function readImage(
  record: SectionRecord,
  frames: LayoutFrame[],
  weight: number,
): CanvasImage | null {
  const image = asMessage(content(record)?.get(FIELD_IMAGES)?.[0]);
  const full = image && asMessage(field(image, 3));
  const fileId = (full && asString(field(full, 5))) ?? "";
  if (!(image && full && record.id && isFileId(fileId))) return null;
  return {
    fileId,
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

export function attachmentContent(node: CanvasCard | CanvasFile): number[] {
  const card = node.kind === "card";
  const kind = card ? KIND_CARD : KIND_FILE;
  const ref = card ? `suo:${node.ownerId}/${node.channelId}/${node.ts}` : `sf:${node.fileId}`;
  const attachment = new Map([
    [1, [rawString(card ? node.url : node.permalink)]],
    [2, [rawVarint(kind)]],
    [3, [rawMessage(new Map([[kind, [rawMessage(new Map([[1, [rawString(ref)]]]))]]]))]],
    [8, [rawVarint(0)]],
  ]);
  if (!card) attachment.set(FLAG_FILE, [rawVarint(1)]);
  else if (node.isMessage) attachment.set(FLAG_MESSAGE_CARD, [rawVarint(1)]);
  return encodeRawMessage(new Map([[FIELD_ATTACHMENT, [rawMessage(attachment)]]]));
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
