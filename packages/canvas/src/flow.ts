import type { CanvasLine } from "@slock/types";
import { parseCanvas } from "./canvasParse.ts";
import { descendantIds } from "./descendants.ts";
import { lineShapeForStyle, listKindForStyle, TYPE_TITLE } from "./lineStyles.ts";
import { asMessage, asString, field } from "./protobufRaw.ts";
import type { DecodedCanvas, SectionRecord } from "./sections.ts";

export interface ExistingEntry {
  containerId: string | null;
  position: string;
  record: SectionRecord;
}

export interface FlowEntry {
  descendants: string[];
  existing: ExistingEntry | null;
  id: string;
  line: CanvasLine | null;
  touched: boolean;
}

export interface ExistingContainer {
  position: string;
  record: SectionRecord;
  style: number;
}

export interface Flow {
  containers: Map<string, ExistingContainer>;
  entries: FlowEntry[];
  records: Map<string, SectionRecord>;
  title: SectionRecord | null;
  usedPositions: Set<string>;
}

export function ownPosition(record: SectionRecord): string {
  const own = asString(field(record.msg, 8));
  if (own) return own;
  return record.anchor.slice(record.anchor.lastIndexOf("-") + 1);
}

export function sectionText(record: SectionRecord): string {
  const content = asMessage(field(record.msg, 12));
  const paragraph = content && asMessage(field(content, 1));
  return (paragraph && asString(field(paragraph, 1))) ?? "";
}

function attributes(record: SectionRecord) {
  const attrs = asMessage(field(record.msg, 16));
  return {
    checked: Number(attrs ? (field(attrs, 2)?.varint ?? 0n) : 0n) !== 0,
    indent: Number(attrs ? (field(attrs, 1)?.varint ?? 0n) : 0n),
  };
}

function textLine(record: SectionRecord, id: string, listKind: CanvasLine["kind"] | null) {
  const { checked, indent } = attributes(record);
  const shape = lineShapeForStyle(record.style);
  return {
    checked: listKind === "checklist" && checked,
    html: sectionText(record),
    id,
    indent: listKind ? indent : 0,
    kind: listKind ?? shape.kind,
    level: listKind ? 0 : shape.level,
  };
}

export function buildFlow(decoded: DecodedCanvas): Flow {
  const records = new Map<string, SectionRecord>();
  const usedPositions = new Set<string>();
  const containers = new Map<string, ExistingContainer>();
  let title: SectionRecord | null = null;
  for (const record of decoded.records) {
    usedPositions.add(ownPosition(record));
    if (!record.id) continue;
    records.set(record.id, record);
    if (record.type === TYPE_TITLE) title = record;
    if (listKindForStyle(record.style) && record.type === 1) {
      containers.set(record.id, {
        position: ownPosition(record),
        record,
        style: record.style,
      });
    }
  }

  const entries: FlowEntry[] = [];
  for (const block of parseCanvas(decoded).blocks) {
    if (block.type === "title") continue;
    if (block.type === "paragraph") {
      const record = block.id ? records.get(block.id) : undefined;
      if (!(record && block.id)) continue;
      entries.push({
        descendants: [],
        existing: { containerId: null, position: ownPosition(record), record },
        id: block.id,
        line: textLine(record, block.id, null),
        touched: false,
      });
    } else if (
      block.type === "bulletList" ||
      block.type === "orderedList" ||
      block.type === "checklist"
    ) {
      for (const item of block.items) {
        const record = item.id ? records.get(item.id) : undefined;
        if (!(record && item.id)) continue;
        const containerId = record.parentIds[0] ?? block.containerId;
        const kind = listKindForStyle(containers.get(containerId ?? "")?.style ?? -1);
        entries.push({
          descendants: [],
          existing: { containerId, position: ownPosition(record), record },
          id: item.id,
          line: textLine(record, item.id, kind),
          touched: false,
        });
      }
    } else if (block.id) {
      const record = records.get(block.id);
      if (!record) continue;
      entries.push({
        descendants: descendantIds(record),
        existing: { containerId: null, position: block.anchor, record },
        id: block.id,
        line:
          block.type === "divider"
            ? { checked: false, html: "", id: block.id, indent: 0, kind: "divider", level: 0 }
            : null,
        touched: false,
      });
    }
  }
  return { containers, entries, records, title, usedPositions };
}
