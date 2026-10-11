import type { Reaction } from "./types";

export type CanvasLineKind =
  | "bullet"
  | "checklist"
  | "code"
  | "divider"
  | "heading"
  | "ordered"
  | "paragraph";

export type LayoutFrame =
  | { color: number; kind: "callout" }
  | { id: string; index: number; kind: "columns"; weights: number[] }
  | { kind: "quote" };

export interface CanvasLine {
  checked: boolean;
  frames: LayoutFrame[];
  html: string;
  id: string;
  indent: number;
  kind: CanvasLineKind;
  level: number;
}

export interface CanvasFile {
  fileId: string;
  frames: LayoutFrame[];
  id: string;
  kind: "file";
  permalink: string;
}

export interface CanvasImageThumb {
  height: number;
  name: string;
  width: number;
}

export interface CanvasImage {
  fileId: string;
  frames: LayoutFrame[];
  height: number;
  id: string;
  kind: "image";
  mimetype: string;
  name: string;
  thumbs: CanvasImageThumb[];
  weight: number;
  width: number;
}

export interface CanvasTableColumn {
  id: string;
  width: number;
}

export interface CanvasTableCell {
  contentId: string;
  html: string;
}

export interface CanvasTableRow {
  cells: CanvasTableCell[];
  id: string;
}

export interface CanvasTable {
  columns: CanvasTableColumn[];
  frames: LayoutFrame[];
  id: string;
  kind: "table";
  rows: CanvasTableRow[];
}

export type CanvasNode = CanvasFile | CanvasImage | CanvasLine | CanvasTable;

export type CanvasControl = { id: string } & (
  | { kind: "annotation" }
  | { channelId: string; kind: "channel" }
  | { kind: "date"; label: string; ms: number }
  | { kind: "emoji"; name: string; teamId: string }
  | { kind: "user"; userId: string }
);

export interface CanvasVersion {
  authorId: string;
  createdMs: number;
  sequence: number;
  versionId: string;
}

export interface CanvasCommentThread {
  archived: boolean;
  authorIds: string[];
  latestReply: string | null;
  quote: string;
  reactions: Reaction[];
  replyCount: number;
  threadId: string;
  ts: string;
}

export interface CanvasUpsert {
  after: string | null;
  node: CanvasNode;
}

export interface CanvasEdit {
  controls: CanvasControl[];
  deleted: string[];
  title: string | null;
  upserts: CanvasUpsert[];
}
