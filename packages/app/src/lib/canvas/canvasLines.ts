import { escapeCanvasHtml, framesFromAttribute } from "@slock/canvas";
import type { CanvasControl, CanvasLine, CanvasNode, CanvasTable, LayoutFrame } from "@slock/types";
import type { Op } from "quill";
import { type CanvasNames, valueKey, valueToControl } from "./canvasEmbeds";
import {
  COLUMNS_EMBED,
  DIVIDER_EMBED,
  embedValue,
  FILE_EMBED,
  IMAGE_EMBED,
  isColumnsValue,
  isFileValue,
  isImageValue,
  isTableValue,
  TABLE_EMBED,
  type TableEmbedValue,
} from "./canvasEmbedValues";
import { type EmbedValue, opsToHtml } from "./canvasHtml";

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

interface Draft {
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

const BLOCK_KEYS = ["blockquote", "code-block", "header", "indent", "layout", "list", "sid"];
const HEX_LENGTH = 25;
const ANNOTATION_RE = /<annotation id="([^"]+)"/g;

function blockAttributes(attributes: Op["attributes"]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes ?? {}).filter(([key]) => BLOCK_KEYS.includes(key)),
  );
}

function inlineAttributes(attributes: Op["attributes"]): Record<string, unknown> | undefined {
  const entries = Object.entries(attributes ?? {}).filter(([key]) => !BLOCK_KEYS.includes(key));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function lineShape(
  block: Record<string, unknown>,
): Pick<CanvasLine, "checked" | "indent" | "kind" | "level"> {
  const indent = typeof block.indent === "number" ? block.indent : 0;
  if (block.list === "bullet") return { checked: false, indent, kind: "bullet", level: 0 };
  if (block.list === "ordered") return { checked: false, indent, kind: "ordered", level: 0 };
  if (block.list === "checked" || block.list === "unchecked")
    return { checked: block.list === "checked", indent, kind: "checklist", level: 0 };
  if (block["code-block"]) return { checked: false, indent: 0, kind: "code", level: 0 };
  if (typeof block.header === "number")
    return { checked: false, indent: 0, kind: "heading", level: block.header };
  return { checked: false, indent: 0, kind: "paragraph", level: 0 };
}

function isStringValue(value: unknown): value is string {
  return typeof value === "string";
}

function freshHex(ctx: LineContext): string {
  return ctx.newId().slice(-HEX_LENGTH);
}

export function opsToLines(ops: Op[], ctx: LineContext): ParsedLines {
  const drafts: Draft[] = [];

  function serialize(lineId: string, embed: EmbedValue): string | null {
    if ("softbreak" in embed) return "<br>";
    const { canvasControl, emoji, mention } = embed;
    if (typeof emoji === "object" && emoji && "name" in emoji && isStringValue(emoji.name)) {
      const text = ctx.names.emojiText(emoji.name);
      if (text) return escapeCanvasHtml(text);
    }
    if (typeof canvasControl === "object" && canvasControl && "id" in canvasControl)
      return `<control id="${String(canvasControl.id)}"></control>`;
    const key = valueKey(embed);
    if (!key) return null;
    const existing = ctx.pool.take(lineId, key);
    const controlId = existing ?? ctx.newId();
    if (!existing) {
      const control = valueToControl(embed, controlId, ctx.names);
      if (!control) {
        const name =
          typeof mention === "object" && mention && "name" in mention ? mention.name : "";
        return escapeCanvasHtml(`@${String(name)}`);
      }
      ctx.controls.push(control);
    }
    return `<control id="${controlId}"></control>`;
  }

  function registerAnnotations(html: string) {
    for (const match of html.matchAll(ANNOTATION_RE)) {
      const id = match[1];
      if (!id || ctx.annotations.has(id)) continue;
      ctx.annotations.add(id);
      ctx.controls.push({ id, kind: "annotation" });
    }
  }

  function cellHtml(cellOps: Op[], contentId: string): string {
    const inline: Op[] = [];
    for (const op of cellOps) {
      if (typeof op.insert === "string") {
        const text = op.insert.replaceAll("\n", "");
        if (text) inline.push({ attributes: inlineAttributes(op.attributes), insert: text });
      } else if (op.insert) inline.push(op);
    }
    const html = opsToHtml(inline, (embed) => serialize(contentId, embed), false);
    registerAnnotations(html);
    return html;
  }

  function tableNode(value: TableEmbedValue, id: string, frames: LayoutFrame[]): CanvasTable {
    return {
      columns: value.columns,
      frames,
      id,
      kind: "table",
      rows: value.rows.map((row) => ({
        cells: row.cells.map((cell) => ({
          contentId: cell.contentId,
          html: cellHtml(cell.ops, cell.contentId),
        })),
        id: row.id,
      })),
    };
  }

  function collect(source: Op[], scope: string, prefix: LayoutFrame[]) {
    let inline: Op[] = [];
    let index = 0;

    function finishLine(block: Record<string, unknown>, at: number) {
      const shape = lineShape(block);
      const frames = [...prefix, ...framesFromAttribute(block.layout)];
      const previous = drafts.at(-1);
      const sid = isStringValue(block.sid) ? block.sid : null;
      const previousLine = previous?.node;
      if (
        shape.kind === "code" &&
        previous &&
        previous.scope === scope &&
        previousLine &&
        "html" in previousLine &&
        previousLine.kind === "code" &&
        (sid === null || sid === previous.sid)
      ) {
        const extra = opsToHtml(inline, (embed) => serialize(previous.sid ?? "", embed), true);
        registerAnnotations(extra);
        previousLine.html += `<br>${extra}`;
        previous.members.push({ at, sid });
      } else {
        const html = opsToHtml(
          inline,
          (embed) => serialize(sid ?? "", embed),
          shape.kind === "code",
        );
        drafts.push({
          at,
          members: [{ at, sid }],
          node: { ...shape, frames, html, id: sid ?? "" },
          scope,
          sid,
        });
      }
      inline = [];
    }

    function pushAtom(node: CanvasNode, op: Op, at: number) {
      const sid = isStringValue(op.attributes?.sid) ? op.attributes.sid : null;
      drafts.push({ at, members: [{ at, sid }], node, scope, sid });
    }

    for (const op of source) {
      if (typeof op.insert === "string") {
        const parts = op.insert.split("\n");
        parts.forEach((part, partIndex) => {
          if (part) {
            inline.push({ attributes: inlineAttributes(op.attributes), insert: part });
            index += part.length;
          }
          if (partIndex < parts.length - 1) {
            finishLine(blockAttributes(op.attributes), index);
            index += 1;
          }
        });
        continue;
      }
      if (!op.insert) continue;
      if (typeof op.insert !== "object" || !blockEmbedName(op.insert)) {
        inline.push(op);
        index += 1;
        continue;
      }
      const frames = [...prefix, ...framesFromAttribute(op.attributes?.layout)];
      const id = isStringValue(op.attributes?.sid) ? op.attributes.sid : "";
      const columns = embedValue(op.insert, COLUMNS_EMBED);
      const image = embedValue(op.insert, IMAGE_EMBED);
      const file = embedValue(op.insert, FILE_EMBED);
      const table = embedValue(op.insert, TABLE_EMBED);
      if (isColumnsValue(columns)) {
        columns.columns.forEach((columnOps, columnIndex) => {
          collect(columnOps, `${scope}${id}:${columnIndex}/`, [
            ...frames,
            { id, index: columnIndex, kind: "columns", weights: columns.weights },
          ]);
        });
      } else if (isImageValue(image)) pushAtom({ ...image.node, frames, id }, op, index);
      else if (isFileValue(file)) pushAtom({ ...file.node, frames, id }, op, index);
      else if (isTableValue(table)) pushAtom(tableNode(table, id, frames), op, index);
      else if (DIVIDER_EMBED in op.insert)
        pushAtom(
          { checked: false, frames, html: "", id, indent: 0, kind: "divider", level: 0 },
          op,
          index,
        );
      index += 1;
    }
  }

  collect(ops, "", []);
  return resolveIds(drafts, ctx);
}

function blockEmbedName(insert: object): boolean {
  return [COLUMNS_EMBED, DIVIDER_EMBED, FILE_EMBED, IMAGE_EMBED, TABLE_EMBED].some(
    (name) => name in insert,
  );
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

function resolveIds(drafts: Draft[], ctx: LineContext): ParsedLines {
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
