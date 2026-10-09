import { isRecord } from "./rawTypes";
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

const LINE_KINDS: readonly string[] = [
  "bullet",
  "checklist",
  "code",
  "divider",
  "heading",
  "ordered",
  "paragraph",
];

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFrame(value: unknown): value is LayoutFrame {
  if (!isRecord(value)) return false;
  if (value.kind === "quote") return true;
  if (value.kind === "callout") return Number.isInteger(value.color);
  return (
    value.kind === "columns" &&
    isString(value.id) &&
    Number.isInteger(value.index) &&
    Array.isArray(value.weights) &&
    value.weights.every(isNumber)
  );
}

function hasFrames(value: Record<string, unknown>): boolean {
  return isString(value.id) && Array.isArray(value.frames) && value.frames.every(isFrame);
}

function isCanvasLine(value: Record<string, unknown>): boolean {
  return (
    hasFrames(value) &&
    isString(value.html) &&
    typeof value.checked === "boolean" &&
    Number.isInteger(value.indent) &&
    Number.isInteger(value.level) &&
    isString(value.kind) &&
    LINE_KINDS.includes(value.kind)
  );
}

function isCanvasFile(value: Record<string, unknown>): boolean {
  return hasFrames(value) && isString(value.fileId) && isString(value.permalink);
}

function isThumb(value: unknown): boolean {
  return isRecord(value) && isNumber(value.width) && isNumber(value.height) && isString(value.name);
}

function isCanvasImage(value: Record<string, unknown>): boolean {
  return (
    hasFrames(value) &&
    isString(value.fileId) &&
    isString(value.mimetype) &&
    isString(value.name) &&
    isNumber(value.width) &&
    isNumber(value.height) &&
    isNumber(value.weight) &&
    Array.isArray(value.thumbs) &&
    value.thumbs.every(isThumb)
  );
}

function isCell(value: unknown): boolean {
  return isRecord(value) && isString(value.contentId) && isString(value.html);
}

function isRow(value: unknown): boolean {
  return (
    isRecord(value) && isString(value.id) && Array.isArray(value.cells) && value.cells.every(isCell)
  );
}

function isColumn(value: unknown): boolean {
  return isRecord(value) && isString(value.id) && isNumber(value.width);
}

function isCanvasTable(value: Record<string, unknown>): boolean {
  return (
    hasFrames(value) &&
    Array.isArray(value.rows) &&
    value.rows.every(isRow) &&
    Array.isArray(value.columns) &&
    value.columns.every(isColumn)
  );
}

function isCanvasNode(value: unknown): value is CanvasNode {
  if (!isRecord(value)) return false;
  if (value.kind === "file") return isCanvasFile(value);
  if (value.kind === "image") return isCanvasImage(value);
  if (value.kind === "table") return isCanvasTable(value);
  return isCanvasLine(value);
}

function isCanvasControl(value: unknown): value is CanvasControl {
  if (!(isRecord(value) && isString(value.id))) return false;
  if (value.kind === "user") return isString(value.userId);
  if (value.kind === "channel") return isString(value.channelId);
  if (value.kind === "emoji") return isString(value.name) && isString(value.teamId);
  return value.kind === "date" && isNumber(value.ms) && isString(value.label);
}

function isUpsert(value: unknown): value is CanvasUpsert {
  return (
    isRecord(value) && (value.after === null || isString(value.after)) && isCanvasNode(value.node)
  );
}

export function parseCanvasEdit(payload: unknown): CanvasEdit | null {
  if (!isRecord(payload)) return null;
  const { controls, deleted, title, upserts } = payload;
  if (!(Array.isArray(controls) && controls.every(isCanvasControl))) return null;
  if (!(Array.isArray(deleted) && deleted.every(isString))) return null;
  if (!(Array.isArray(upserts) && upserts.every(isUpsert))) return null;
  if (title !== null && !isString(title)) return null;
  return { controls, deleted, title, upserts };
}
