import { compareAnchors, groupListItems } from "./canvasListNesting.ts";
import { type RawTable, tableGrid } from "./canvasTable.ts";
import { asMessage, asString, decodeRaw, dumpRaw, field, type RawMessage } from "./protobufRaw.ts";

export interface RawListItem {
  checked?: boolean;
  indent: number;
  text: string;
}

export type RawBlock =
  | { anchor: string; childTexts: string[]; type: "callout" }
  | { anchor: string; childTexts: string[]; type: "blockquote" }
  | { anchor: string; columns: string[]; type: "section" }
  | { anchor: string; fileIds: string[]; type: "image" }
  | { anchor: string; items: RawListItem[]; type: "bulletList" }
  | { anchor: string; items: RawListItem[]; type: "orderedList" }
  | { anchor: string; items: RawListItem[]; type: "checklist" }
  | { anchor: string; colWidths: number[]; rows: string[][]; type: "table" }
  | { anchor: string; style: number; text: string; type: "paragraph" }
  | { anchor: string; text: string; type: "title" }
  | { anchor: string; type: "unsupported" };

const ORPHANED_EMBED_RECORDS_ANCHOR = "zzzzzz-orphaned-m";

export type CanvasEmbed =
  | { channelId: string; type: "channel" }
  | { fileId: string; type: "file" }
  | { ms: number; type: "date" }
  | { shortcode: string; type: "emoji" }
  | { userId: string; type: "user" }
  | { durationMs: number; type: "video" }
  | { type: "unknown" };

const REF_PREFIX_RE = /^s[a-z]:/;

function parseEmbedRecord(msg: RawMessage): CanvasEmbed {
  const content = asMessage(field(msg, 12));
  const emoji = content && asMessage(field(content, 48));
  if (emoji) return { shortcode: asString(field(emoji, 2)) ?? "", type: "emoji" };
  const channel = content && asMessage(field(content, 42));
  if (channel)
    return {
      channelId: (asString(field(channel, 1)) ?? "").replace(REF_PREFIX_RE, ""),
      type: "channel",
    };
  const user = content && asMessage(field(content, 44));
  if (user)
    return { type: "user", userId: (asString(field(user, 1)) ?? "").replace(REF_PREFIX_RE, "") };
  const date = content && asMessage(field(content, 62));
  if (date) {
    const ms = field(date, 1)?.varint;
    return { ms: ms === undefined ? 0 : Number(ms), type: "date" };
  }
  const file = content && asMessage(field(content, 54));
  if (file)
    return { fileId: (asString(field(file, 2)) ?? "").replace(REF_PREFIX_RE, ""), type: "file" };
  const video = content && asMessage(field(content, 7));
  if (video) {
    const durationMs = field(msg, 2)?.varint;
    return { durationMs: durationMs === undefined ? 0 : Number(durationMs), type: "video" };
  }
  return { type: "unknown" };
}

function calloutChildIds(content: RawMessage): string[] {
  const container = asMessage(field(content, 63));
  if (!container) return [];
  const ids: string[] = [];
  for (const item of container.get(1) ?? []) {
    const itemMsg = asMessage(item);
    for (const entry of itemMsg?.get(2) ?? []) {
      const id = asString(entry);
      if (id) ids.push(id);
    }
  }
  return ids;
}

function blockquoteChildIds(content: RawMessage): string[] {
  const container = asMessage(field(content, 65));
  if (!container) return [];
  const ids: string[] = [];
  for (const entry of container.get(1) ?? []) {
    const id = asString(entry);
    if (id) ids.push(id);
  }
  return ids;
}

function imageFileIds(content: RawMessage): string[] {
  const ids: string[] = [];
  for (const entry of content.get(2) ?? []) {
    const img = asMessage(entry);
    const full = img && asMessage(field(img, 3));
    const fileId = full && asString(field(full, 5));
    if (fileId) ids.push(fileId);
  }
  return ids;
}

function sectionChildIds(content: RawMessage): string[] {
  const container = asMessage(field(content, 24));
  if (!container) return [];
  const ids: string[] = [];
  for (const item of container.get(1) ?? []) {
    const itemMsg = asMessage(item);
    const id = itemMsg && asString(field(itemMsg, 1));
    if (id) ids.push(id);
  }
  return ids;
}

export type PositionedRecord =
  | { anchor: string; childIds: string[]; kind: "callout" }
  | { anchor: string; childIds: string[]; kind: "blockquote" }
  | { anchor: string; childIds: string[]; kind: "section" }
  | { anchor: string; fileIds: string[]; kind: "image" }
  | { anchor: string; kind: "bulletList" }
  | { anchor: string; kind: "orderedList" }
  | { anchor: string; kind: "checklist" }
  | { anchor: string; kind: "table"; table: RawTable }
  | { anchor: string; id: string | null; kind: "title"; text: string }
  | {
      anchor: string;
      checked: boolean;
      id: string | null;
      indent: number;
      kind: "paragraph";
      style: number;
      text: string;
    }
  | { anchor: string; kind: "unsupported" };

const LIST_CONTAINER_STYLES: Record<number, "bulletList" | "checklist" | "orderedList"> = {
  5: "bulletList",
  6: "orderedList",
  7: "checklist",
};

export function parseLoadDataResponse(bytes: Uint8Array): {
  blocks: RawBlock[];
  embedsById: Map<string, CanvasEmbed>;
} {
  const root = decodeRaw(bytes);
  const payload = asMessage(field(root, 2));
  const document = payload && asMessage(field(payload, 2));
  const records = document?.get(7) ?? [];
  const embedsById = new Map<string, CanvasEmbed>();
  const positioned: PositionedRecord[] = [];
  const textById = new Map<string, string>();
  const anchorById = new Map<string, string>();
  for (const record of records) {
    const msg = asMessage(record);
    if (!msg) continue;
    const anchor = asString(field(msg, 21)) ?? asString(field(msg, 8)) ?? asString(field(msg, 1));
    if (!anchor) continue;
    if (anchor === ORPHANED_EMBED_RECORDS_ANCHOR) {
      const id = asString(field(msg, 1));
      const embed = parseEmbedRecord(msg);
      if (embed.type === "unknown")
        console.log("[canvas] unrecognized orphan record:", JSON.stringify(dumpRaw(msg), null, 2));
      if (id) embedsById.set(id, embed);
      continue;
    }
    const id = asString(field(msg, 1));
    const content = asMessage(field(msg, 12));
    const paragraph = content && asMessage(field(content, 1));
    const title = content && asMessage(field(content, 58));
    const calloutIds = content ? calloutChildIds(content) : [];
    const blockquoteIds = content ? blockquoteChildIds(content) : [];
    const sectionIds = content ? sectionChildIds(content) : [];
    const imageIds = content ? imageFileIds(content) : [];
    const table = content ? tableGrid(content) : null;
    const listKind = LIST_CONTAINER_STYLES[Number(field(msg, 10)?.varint ?? -1n)];
    if (paragraph) {
      const text = asString(field(paragraph, 1)) ?? "";
      if (id) {
        textById.set(id, text);
        anchorById.set(id, anchor);
      }
      const itemFlags = asMessage(field(msg, 16)) ?? new Map();
      positioned.push({
        anchor,
        checked: Number(field(itemFlags, 2)?.varint ?? 0n) !== 0,
        id,
        indent: Number(field(itemFlags, 1)?.varint ?? 0n),
        kind: "paragraph",
        style: Number(field(msg, 10)?.varint ?? 0n),
        text,
      });
    } else if (title) {
      const text = asString(field(title, 1)) ?? "";
      if (id) {
        textById.set(id, text);
        anchorById.set(id, anchor);
      }
      positioned.push({ anchor, id, kind: "title", text });
    } else if (calloutIds.length > 0) {
      positioned.push({ anchor, childIds: calloutIds, kind: "callout" });
    } else if (blockquoteIds.length > 0) {
      positioned.push({ anchor, childIds: blockquoteIds, kind: "blockquote" });
    } else if (sectionIds.length > 0) {
      positioned.push({ anchor, childIds: sectionIds, kind: "section" });
    } else if (imageIds.length > 0) {
      positioned.push({ anchor, fileIds: imageIds, kind: "image" });
    } else if (table) {
      positioned.push({ anchor, kind: "table", table });
    } else if (content && content.size === 0 && listKind) {
      positioned.push({ anchor, kind: listKind });
    } else {
      console.log(
        `[canvas] unsupported block anchor=${anchor} full record=`,
        JSON.stringify(dumpRaw(msg), null, 2),
      );
      positioned.push({ anchor, kind: "unsupported" });
    }
  }

  const consumedIds = new Set<string>();
  for (const record of positioned) {
    if (record.kind === "callout" || record.kind === "blockquote" || record.kind === "section") {
      for (const childId of record.childIds) consumedIds.add(childId);
    } else if (record.kind === "table") {
      for (const contentId of record.table.cellContentIds.values()) consumedIds.add(contentId);
    }
  }

  const { itemsByRoot: listItemsByContainer, nestedContainerAnchors } = groupListItems(
    positioned,
    consumedIds,
  );

  const blocks: RawBlock[] = [];
  for (const record of positioned) {
    if (record.kind === "unsupported") {
      blocks.push({ anchor: record.anchor, type: "unsupported" });
    } else if (record.kind === "callout" || record.kind === "blockquote") {
      const childTexts = record.childIds.map((childId) => textById.get(childId) ?? "");
      const anchor = anchorById.get(record.childIds[0] ?? "") ?? record.anchor;
      blocks.push({ anchor, childTexts, type: record.kind });
    } else if (record.kind === "section") {
      const columns = record.childIds.map((childId) => textById.get(childId) ?? "");
      const anchor = anchorById.get(record.childIds[0] ?? "") ?? record.anchor;
      blocks.push({ anchor, columns, type: "section" });
    } else if (record.kind === "image") {
      blocks.push({ anchor: record.anchor, fileIds: record.fileIds, type: "image" });
    } else if (record.kind === "table") {
      const rows = record.table.rowIds.map((rowId) =>
        record.table.colIds.map((colId) => {
          const contentId = record.table.cellContentIds.get(`${rowId} ${colId}`);
          return contentId ? (textById.get(contentId) ?? "") : "";
        }),
      );
      const firstContentId = record.table.cellContentIds.get(
        `${record.table.rowIds[0]} ${record.table.colIds[0]}`,
      );
      const anchor = anchorById.get(firstContentId ?? "") ?? record.anchor;
      blocks.push({ anchor, colWidths: record.table.colWidths, rows, type: "table" });
    } else if (
      record.kind === "bulletList" ||
      record.kind === "orderedList" ||
      record.kind === "checklist"
    ) {
      if (nestedContainerAnchors.has(record.anchor)) continue;
      const items = (listItemsByContainer.get(record.anchor) ?? []).map(
        ({ checked, indent, text }) => ({ checked, indent, text }),
      );
      blocks.push({ anchor: record.anchor, items, type: record.kind });
    } else if (!(record.id && consumedIds.has(record.id))) {
      if (record.kind === "title")
        blocks.push({ anchor: record.anchor, text: record.text, type: "title" });
      else
        blocks.push({
          anchor: record.anchor,
          style: record.style,
          text: record.text,
          type: "paragraph",
        });
    }
  }
  blocks.sort((a, b) => compareAnchors(a.anchor, b.anchor));
  return { blocks, embedsById };
}
