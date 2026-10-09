import type { CanvasFile, CanvasImage, CanvasTableColumn, RawFile } from "@slock/types";
import type { Op } from "quill";

export interface ColumnsEmbedValue {
  columns: Op[][];
  id: string;
  weights: number[];
}

export interface ImageEmbedValue {
  file: RawFile | null;
  node: CanvasImage;
}

export interface FileEmbedValue {
  file: RawFile | null;
  node: CanvasFile;
}

export interface TableEmbedCell {
  contentId: string;
  ops: Op[];
}

export interface TableEmbedRow {
  cells: TableEmbedCell[];
  id: string;
}

export interface TableEmbedValue {
  columns: CanvasTableColumn[];
  id: string;
  rows: TableEmbedRow[];
}

export const COLUMNS_EMBED = "canvasColumns";
export const FILE_EMBED = "canvasFile";
export const IMAGE_EMBED = "canvasImage";
export const TABLE_EMBED = "canvasTable";
export const DIVIDER_EMBED = "divider";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function embedValue(insert: Op["insert"], name: string): unknown {
  return isRecord(insert) ? insert[name] : undefined;
}

export function isColumnsValue(value: unknown): value is ColumnsEmbedValue {
  return isRecord(value) && Array.isArray(value.columns) && Array.isArray(value.weights);
}

export function isImageValue(value: unknown): value is ImageEmbedValue {
  return isRecord(value) && isRecord(value.node);
}

export function isFileValue(value: unknown): value is FileEmbedValue {
  return isRecord(value) && isRecord(value.node);
}

export function isTableValue(value: unknown): value is TableEmbedValue {
  return isRecord(value) && Array.isArray(value.rows) && Array.isArray(value.columns);
}
