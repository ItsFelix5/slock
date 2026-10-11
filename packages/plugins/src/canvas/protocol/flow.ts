import type { CanvasNode, LayoutFrame } from "@slock/types";
import { asMessage, asString, field } from "./protobufRaw.ts";
import type { SectionRecord } from "./sections.ts";

export type ContainerKind = "callout" | "columns" | "list" | "quote";

export interface ExistingEntry {
  layoutIds: string[];
  listId: string | null;
  position: string;
  record: SectionRecord;
  wrapperId: string | null;
}

export interface FlowEntry {
  descendants: string[];
  existing: ExistingEntry | null;
  frames: LayoutFrame[];
  id: string;
  node: CanvasNode | null;
  touched: boolean;
}

export interface ExistingContainer {
  kind: ContainerKind;
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

export function titleText(record: SectionRecord): string {
  const content = asMessage(field(record.msg, 12));
  const title = content && asMessage(field(content, 58));
  return (title && asString(field(title, 1))) ?? "";
}
