import type { CanvasControl, CanvasNode, CanvasTable } from "@slock/types";
import type { CanvasNames } from "./canvasEmbeds";

export interface LineEntry {
  id: string;
  node: CanvasNode;
}

export interface IdFix {
  id: string;
  index: number;
  scope: string;
}

export interface ControlPool {
  take(lineId: string, key: string): string | null;
}

export interface LineContext {
  annotations: Set<string>;
  baselineHtml(id: string): string | undefined;
  controls: CanvasControl[];
  names: CanvasNames;
  newId(): string;
  pool: ControlPool;
  retired: ReadonlySet<string>;
}

export interface Draft {
  at: number;
  members: { at: number; sid: string | null }[];
  node: CanvasNode;
  scope: string;
  sid: string | null;
}

export interface ParsedLines {
  entries: LineEntry[];
  fixes: IdFix[];
}

const HEX_LENGTH = 25;

function freshHex(ctx: LineContext): string {
  return ctx.newId().slice(-HEX_LENGTH);
}

function renewTable(node: CanvasTable, ctx: LineContext): CanvasTable {
  return {
    ...node,
    columns: node.columns.map((column) => ({ ...column, id: `col:${freshHex(ctx)}` })),
    rows: node.rows.map((row) => ({
      cells: row.cells.map((cell) => ({ ...cell, contentId: ctx.newId() })),
      id: `w:${freshHex(ctx)}`,
    })),
  };
}

export function resolveIds(drafts: Draft[], ctx: LineContext): ParsedLines {
  const winners = new Map<string, number>();
  drafts.forEach((draft, position) => {
    const { sid } = draft;
    if (sid === null || ctx.retired.has(sid)) return;
    const current = winners.get(sid);
    if (current === undefined) {
      winners.set(sid, position);
      return;
    }
    const base = ctx.baselineHtml(sid);
    const html = (candidate: number) => {
      const node = drafts[candidate]?.node;
      return node && "html" in node ? node.html : undefined;
    };
    const matches = (candidate: number) => base !== undefined && html(candidate) === base;
    if (!matches(current) && matches(position)) winners.set(sid, position);
  });
  const entries: LineEntry[] = [];
  const fixes: IdFix[] = [];
  drafts.forEach((draft, position) => {
    const { members, node, scope, sid } = draft;
    const keep = sid !== null && winners.get(sid) === position;
    const id = keep && sid !== null ? sid : ctx.newId();
    for (const member of members)
      if (member.sid !== id) fixes.push({ id, index: member.at, scope });
    const renewed = !keep && node.kind === "table" ? renewTable(node, ctx) : node;
    entries.push({ id, node: { ...renewed, id } });
  });
  return { entries, fixes };
}
