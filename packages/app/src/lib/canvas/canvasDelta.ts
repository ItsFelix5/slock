import { type CanvasEmbed, type CanvasMeta, lineShapeForStyle, type RawBlock } from "@slock/canvas";
import type { RawFile } from "@slock/types";
import type { Op } from "quill";
import { toCanvasBlock } from "./canvasBlocks";
import { type CanvasNames, embedToValue } from "./canvasEmbeds";
import { htmlToOps } from "./canvasHtml";

export interface CanvasDocModel {
  blocks: RawBlock[];
  embeds: Map<string, CanvasEmbed>;
  files: Map<string, RawFile>;
  meta: CanvasMeta;
}

function splitOnSoftBreaks(inline: Op[]): Op[][] {
  const lines: Op[][] = [[]];
  for (const op of inline) {
    if (typeof op.insert === "object" && op.insert && "softbreak" in op.insert) lines.push([]);
    else lines.at(-1)?.push(op);
  }
  return lines;
}

export function canvasToOps(doc: CanvasDocModel, names: CanvasNames): Op[] {
  const ops: Op[] = [];
  const resolve = (controlId: string) => embedToValue(doc.embeds.get(controlId), controlId, names);

  function pushLine(inline: Op[], attributes: Record<string, unknown>) {
    ops.push(...inline, { attributes, insert: "\n" });
  }

  for (const block of doc.blocks) {
    if (block.type === "title") continue;
    if (block.type === "paragraph" && block.id) {
      const shape = lineShapeForStyle(block.style);
      const inline = htmlToOps(block.text, resolve, shape.kind === "code");
      if (shape.kind === "code") {
        for (const line of splitOnSoftBreaks(inline))
          pushLine(line, { "code-block": true, sid: block.id });
      } else {
        pushLine(inline, {
          sid: block.id,
          ...(shape.kind === "heading" ? { header: shape.level } : {}),
        });
      }
    } else if (
      block.type === "bulletList" ||
      block.type === "orderedList" ||
      block.type === "checklist"
    ) {
      for (const item of block.items) {
        if (!item.id) continue;
        const list =
          block.type === "checklist"
            ? item.checked
              ? "checked"
              : "unchecked"
            : block.type === "orderedList"
              ? "ordered"
              : "bullet";
        pushLine(htmlToOps(item.text, resolve, false), {
          list,
          sid: item.id,
          ...(item.indent > 0 ? { indent: item.indent } : {}),
        });
      }
    } else if (block.type === "divider" && block.id) {
      ops.push({ attributes: { sid: block.id }, insert: { divider: true } });
    } else if (block.id && block.type !== "unsupported") {
      const display = toCanvasBlock(block, doc.embeds, doc.files);
      if (display) ops.push({ insert: { canvasBlock: { block: display, id: block.id } } });
    }
  }
  return ops;
}

export function canvasTitle(doc: CanvasDocModel): string {
  for (const block of doc.blocks) if (block.type === "title") return block.text;
  return "";
}
