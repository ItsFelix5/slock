import type { CanvasAtom, CanvasTableColumn } from "@slock/types";
import type { Op } from "@slock/ui/editor/quill";

export interface ColumnsEmbedValue {
  columns: Op[][];
  id: string;
  weights: number[];
}

export interface AtomEmbedValue<Node extends CanvasAtom> {
  node: Node;
}

interface TableEmbedCell {
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
export const CARD_EMBED = "canvasCard";
export const FILE_EMBED = "canvasFile";
export const IMAGE_EMBED = "canvasImage";
export const TABLE_EMBED = "canvasTable";
export const UNKNOWN_EMBED = "canvasUnknown";
export const DIVIDER_EMBED = "divider";
export const ATOM_EMBEDS = {
  card: CARD_EMBED,
  file: FILE_EMBED,
  image: IMAGE_EMBED,
  unknown: UNKNOWN_EMBED,
} satisfies Record<CanvasAtom["kind"], string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const BLOCK_EMBEDS = [
  COLUMNS_EMBED,
  DIVIDER_EMBED,
  TABLE_EMBED,
  ...Object.values(ATOM_EMBEDS),
];

export function isBlockEmbed(insert: object): boolean {
  return BLOCK_EMBEDS.some((name) => name in insert);
}

export function embedValue(insert: Op["insert"], name: string): unknown {
  return isRecord(insert) ? insert[name] : undefined;
}

export function isColumnsValue(value: unknown): value is ColumnsEmbedValue {
  return isRecord(value) && Array.isArray(value.columns) && Array.isArray(value.weights);
}

function isAtomValue(value: unknown): value is AtomEmbedValue<CanvasAtom> {
  return isRecord(value) && isRecord(value.node);
}

export function atomValue(insert: Op["insert"]) {
  for (const name of Object.values(ATOM_EMBEDS)) {
    const value = embedValue(insert, name);
    if (isAtomValue(value)) return value.node;
  }
  return null;
}

export function isTableValue(value: unknown): value is TableEmbedValue {
  return isRecord(value) && Array.isArray(value.rows) && Array.isArray(value.columns);
}
