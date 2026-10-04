import { compareAnchors, groupListItems } from "./canvasListNesting.ts";
import { type RawTable, tableGrid } from "./canvasTable.ts";
import { type CanvasEmbed, parseEmbedRecord } from "./embeds.ts";
import {
  blockquoteChildIds,
  calloutChildIds,
  imageFileIds,
  sectionChildIds,
} from "./layoutContent.ts";
import { asMessage, asString, dumpRaw, field } from "./protobufRaw.ts";
import {
  type CanvasMeta,
  type DecodedCanvas,
  decodeLoadData,
  ORPHANED_EMBED_RECORDS_ANCHOR,
  SECTION_TYPE_DIVIDER,
} from "./sections.ts";

export interface RawListItem {
  checked?: boolean;
  id: string | null;
  indent: number;
  text: string;
}

export type RawBlock =
  | { anchor: string; childIds: string[]; childTexts: string[]; id: string | null; type: "callout" }
  | {
      anchor: string;
      childIds: string[];
      childTexts: string[];
      id: string | null;
      type: "blockquote";
    }
  | { anchor: string; columns: string[]; id: string | null; type: "section" }
  | { anchor: string; fileIds: string[]; id: string | null; type: "image" }
  | { anchor: string; containerId: string | null; items: RawListItem[]; type: "bulletList" }
  | { anchor: string; containerId: string | null; items: RawListItem[]; type: "orderedList" }
  | { anchor: string; containerId: string | null; items: RawListItem[]; type: "checklist" }
  | {
      anchor: string;
      colWidths: number[];
      id: string | null;
      rows: string[][];
      type: "table";
    }
  | { anchor: string; id: string | null; style: number; text: string; type: "paragraph" }
  | { anchor: string; id: string | null; text: string; type: "title" }
  | { anchor: string; id: string | null; type: "divider" }
  | { anchor: string; id: string | null; type: "unsupported" };

export type PositionedRecord =
  | { anchor: string; childIds: string[]; id: string | null; kind: "callout" }
  | { anchor: string; childIds: string[]; id: string | null; kind: "blockquote" }
  | { anchor: string; childIds: string[]; id: string | null; kind: "section" }
  | { anchor: string; fileIds: string[]; id: string | null; kind: "image" }
  | { anchor: string; id: string | null; kind: "bulletList" }
  | { anchor: string; id: string | null; kind: "orderedList" }
  | { anchor: string; id: string | null; kind: "checklist" }
  | { anchor: string; id: string | null; kind: "table"; table: RawTable }
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
  | { anchor: string; id: string | null; kind: "divider" }
  | { anchor: string; id: string | null; kind: "unsupported" };

const LIST_CONTAINER_STYLES: Record<number, "bulletList" | "checklist" | "orderedList"> = {
  5: "bulletList",
  6: "orderedList",
  7: "checklist",
};

export interface ParsedCanvas {
  blocks: RawBlock[];
  embedsById: Map<string, CanvasEmbed>;
  meta: CanvasMeta | null;
}

export function parseLoadDataResponse(bytes: Uint8Array): ParsedCanvas {
  return parseCanvas(decodeLoadData(bytes));
}

export function parseCanvas({ meta, records }: DecodedCanvas): ParsedCanvas {
  const embedsById = new Map<string, CanvasEmbed>();
  const positioned: PositionedRecord[] = [];
  const textById = new Map<string, string>();
  const anchorById = new Map<string, string>();
  for (const { anchor, id, msg, type } of records) {
    if (anchor === ORPHANED_EMBED_RECORDS_ANCHOR) {
      const embed = parseEmbedRecord(msg);
      if (embed.type === "unknown")
        console.log("[canvas] unrecognized orphan record:", JSON.stringify(dumpRaw(msg), null, 2));
      if (id) embedsById.set(id, embed);
      continue;
    }
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
      positioned.push({ anchor, childIds: calloutIds, id, kind: "callout" });
    } else if (blockquoteIds.length > 0) {
      positioned.push({ anchor, childIds: blockquoteIds, id, kind: "blockquote" });
    } else if (sectionIds.length > 0) {
      positioned.push({ anchor, childIds: sectionIds, id, kind: "section" });
    } else if (imageIds.length > 0) {
      positioned.push({ anchor, fileIds: imageIds, id, kind: "image" });
    } else if (table) {
      positioned.push({ anchor, id, kind: "table", table });
    } else if (content && content.size === 0 && listKind) {
      positioned.push({ anchor, id, kind: listKind });
    } else if (type === SECTION_TYPE_DIVIDER) {
      positioned.push({ anchor, id, kind: "divider" });
    } else {
      console.log(
        `[canvas] unsupported block anchor=${anchor} full record=`,
        JSON.stringify(dumpRaw(msg), null, 2),
      );
      positioned.push({ anchor, id, kind: "unsupported" });
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
    if (record.kind === "unsupported" || record.kind === "divider") {
      blocks.push({ anchor: record.anchor, id: record.id, type: record.kind });
    } else if (record.kind === "callout" || record.kind === "blockquote") {
      const childTexts = record.childIds.map((childId) => textById.get(childId) ?? "");
      const anchor = anchorById.get(record.childIds[0] ?? "") ?? record.anchor;
      blocks.push({
        anchor,
        childIds: record.childIds,
        childTexts,
        id: record.id,
        type: record.kind,
      });
    } else if (record.kind === "section") {
      const columns = record.childIds.map((childId) => textById.get(childId) ?? "");
      const anchor = anchorById.get(record.childIds[0] ?? "") ?? record.anchor;
      blocks.push({ anchor, columns, id: record.id, type: "section" });
    } else if (record.kind === "image") {
      blocks.push({ anchor: record.anchor, fileIds: record.fileIds, id: record.id, type: "image" });
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
      blocks.push({
        anchor,
        colWidths: record.table.colWidths,
        id: record.id,
        rows,
        type: "table",
      });
    } else if (
      record.kind === "bulletList" ||
      record.kind === "orderedList" ||
      record.kind === "checklist"
    ) {
      if (nestedContainerAnchors.has(record.anchor)) continue;
      const items = (listItemsByContainer.get(record.anchor) ?? []).map(
        ({ checked, id, indent, text }) => ({ checked, id, indent, text }),
      );
      blocks.push({ anchor: record.anchor, containerId: record.id, items, type: record.kind });
    } else if (!(record.id && consumedIds.has(record.id))) {
      if (record.kind === "title")
        blocks.push({ anchor: record.anchor, id: record.id, text: record.text, type: "title" });
      else
        blocks.push({
          anchor: record.anchor,
          id: record.id,
          style: record.style,
          text: record.text,
          type: "paragraph",
        });
    }
  }
  blocks.sort((a, b) => compareAnchors(a.anchor, b.anchor));
  return { blocks, embedsById, meta };
}
