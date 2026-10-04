import { escapeCanvasHtml } from "@slock/canvas";
import type { CanvasControl, CanvasLine } from "@slock/types";
import type { Op } from "quill";
import { type CanvasNames, valueKey, valueToControl } from "./canvasEmbeds";
import { type EmbedValue, opsToHtml } from "./canvasHtml";

export interface LineEntry {
  id: string;
  line: CanvasLine | null;
}

export interface IdFix {
  id: string;
  index: number;
}

export interface ControlPool {
  take(lineId: string, key: string): string | null;
}

export interface LineContext {
  baselineHtml(id: string): string | undefined;
  controls: CanvasControl[];
  names: CanvasNames;
  newId(): string;
  pool: ControlPool;
  retired: ReadonlySet<string>;
}

interface Draft {
  at: number;
  line: CanvasLine | null;
  members: { at: number; sid: string | null }[];
  sid: string | null;
}

export interface ParsedLines {
  entries: LineEntry[];
  fixes: IdFix[];
}

const BLOCK_KEYS = ["code-block", "header", "indent", "list", "sid"];

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

export function opsToLines(ops: Op[], ctx: LineContext): ParsedLines {
  const drafts: Draft[] = [];
  let inline: Op[] = [];
  let index = 0;

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

  function finishLine(block: Record<string, unknown>, at: number) {
    const shape = lineShape(block);
    const previous = drafts.at(-1);
    const sid = isStringValue(block.sid) ? block.sid : null;
    if (
      shape.kind === "code" &&
      previous?.line?.kind === "code" &&
      (sid === null || sid === previous.sid)
    ) {
      const extra = opsToHtml(inline, (embed) => serialize(previous.sid ?? "", embed), true);
      previous.line.html += `<br>${extra}`;
      previous.members.push({ at, sid });
    } else {
      const html = opsToHtml(inline, (embed) => serialize(sid ?? "", embed), shape.kind === "code");
      drafts.push({ at, line: { ...shape, html, id: sid ?? "" }, members: [{ at, sid }], sid });
    }
    inline = [];
  }

  for (const op of ops) {
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
    } else if (op.insert && "divider" in op.insert) {
      const sid = isStringValue(op.attributes?.sid) ? op.attributes.sid : null;
      const line: CanvasLine = {
        checked: false,
        html: "",
        id: sid ?? "",
        indent: 0,
        kind: "divider",
        level: 0,
      };
      drafts.push({ at: index, line, members: [{ at: index, sid }], sid });
      index += 1;
    } else if (op.insert && "canvasBlock" in op.insert) {
      const block = op.insert.canvasBlock;
      const id = typeof block === "object" && block && "id" in block ? String(block.id) : null;
      drafts.push({ at: index, line: null, members: [], sid: id });
      index += 1;
    } else if (op.insert) {
      inline.push(op);
      index += 1;
    }
  }
  return resolveIds(drafts, ctx);
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
    const matches = (candidate: number) =>
      base !== undefined && drafts[candidate]?.line?.html === base;
    if (!matches(current) && matches(position)) winners.set(sid, position);
  });
  const entries: LineEntry[] = [];
  const fixes: IdFix[] = [];
  const opaqueSeen = new Set<string>();
  drafts.forEach((draft, position) => {
    const { line, members, sid } = draft;
    const keep = sid !== null && winners.get(sid) === position;
    if (line === null) {
      if (sid && keep && !opaqueSeen.has(sid)) {
        opaqueSeen.add(sid);
        entries.push({ id: sid, line: null });
      }
      return;
    }
    const id = keep && sid !== null ? sid : ctx.newId();
    for (const member of members) if (member.sid !== id) fixes.push({ id, index: member.at });
    entries.push({ id, line: { ...line, id } });
  });
  return { entries, fixes };
}
