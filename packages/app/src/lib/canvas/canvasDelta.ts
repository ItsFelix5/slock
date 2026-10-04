import { decodeTextEntities } from "@slock/blockkit";
import { type CanvasDocument, isLineNode, layoutAttribute } from "@slock/canvas";
import type { CanvasLine, CanvasNode, LayoutFrame, RawFile } from "@slock/types";
import type { Op } from "quill";
import { type CanvasNames, embedToValue } from "./canvasEmbeds";
import {
  COLUMNS_EMBED,
  DIVIDER_EMBED,
  FILE_EMBED,
  IMAGE_EMBED,
  TABLE_EMBED,
} from "./canvasEmbedValues";
import { htmlToOps } from "./canvasHtml";

export interface CanvasDocModel extends CanvasDocument {
  files: Map<string, RawFile>;
}

function splitOnSoftBreaks(inline: Op[]): Op[][] {
  const lines: Op[][] = [[]];
  for (const op of inline) {
    if (typeof op.insert === "object" && op.insert && "softbreak" in op.insert) lines.push([]);
    else lines.at(-1)?.push(op);
  }
  return lines;
}

function listAttribute(line: CanvasLine): string | null {
  if (line.kind === "bullet") return "bullet";
  if (line.kind === "ordered") return "ordered";
  if (line.kind === "checklist") return line.checked ? "checked" : "unchecked";
  return null;
}

function lineAttributes(line: CanvasLine): Record<string, unknown> {
  const list = listAttribute(line);
  return {
    sid: line.id,
    ...(line.kind === "heading" ? { header: line.level } : {}),
    ...(list ? { list } : {}),
    ...(list && line.indent > 0 ? { indent: line.indent } : {}),
  };
}

function framesOf(node: CanvasNode, depth: number): LayoutFrame[] {
  return node.frames.slice(depth);
}

export function nodesToOps(
  nodes: CanvasNode[],
  depth: number,
  doc: Pick<CanvasDocModel, "embeds" | "files">,
  names: CanvasNames,
): Op[] {
  const ops: Op[] = [];
  const resolve = (controlId: string) => embedToValue(doc.embeds.get(controlId), controlId, names);
  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    if (!node) break;
    index += 1;
    const frames = framesOf(node, depth);
    const [first] = frames;
    if (first?.kind === "columns") {
      const run = [node];
      while (nodes[index] && columnsId(nodes[index], depth) === first.id) {
        const next = nodes[index];
        if (next) run.push(next);
        index += 1;
      }
      ops.push(columnsOp(first.id, first.weights, run, depth, doc, names));
      continue;
    }
    const layout = layoutAttribute(frames);
    const withLayout = (attributes: Record<string, unknown>) =>
      layout ? { ...attributes, layout } : attributes;
    if (!isLineNode(node)) {
      ops.push(atomOp(node, withLayout, doc, resolve));
      continue;
    }
    if (node.kind === "divider") {
      ops.push({ attributes: withLayout({ sid: node.id }), insert: { [DIVIDER_EMBED]: true } });
      continue;
    }
    const inline = htmlToOps(node.html, resolve, node.kind === "code");
    if (node.kind === "code") {
      for (const part of splitOnSoftBreaks(inline))
        ops.push(...part, {
          attributes: withLayout({ "code-block": true, sid: node.id }),
          insert: "\n",
        });
      continue;
    }
    ops.push(...inline, { attributes: withLayout(lineAttributes(node)), insert: "\n" });
  }
  return ops;
}

function columnsId(node: CanvasNode | undefined, depth: number): string | null {
  const frame = node?.frames[depth];
  return frame?.kind === "columns" ? frame.id : null;
}

function columnsOp(
  id: string,
  weights: number[],
  run: CanvasNode[],
  depth: number,
  doc: Pick<CanvasDocModel, "embeds" | "files">,
  names: CanvasNames,
): Op {
  const byIndex = new Map<number, CanvasNode[]>();
  for (const node of run) {
    const frame = node.frames[depth];
    if (frame?.kind !== "columns") continue;
    byIndex.set(frame.index, [...(byIndex.get(frame.index) ?? []), node]);
  }
  const columns = [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, members]) => nodesToOps(members, depth + 1, doc, names));
  return {
    attributes: { sid: id },
    insert: { [COLUMNS_EMBED]: { columns, id, weights } },
  };
}

function atomOp(
  node: Exclude<CanvasNode, CanvasLine>,
  withLayout: (attributes: Record<string, unknown>) => Record<string, unknown>,
  doc: Pick<CanvasDocModel, "embeds" | "files">,
  resolve: (controlId: string) => Record<string, unknown>,
): Op {
  const attributes = withLayout({ sid: node.id });
  if (node.kind === "image")
    return {
      attributes,
      insert: { [IMAGE_EMBED]: { file: doc.files.get(node.fileId) ?? null, node } },
    };
  if (node.kind === "file")
    return {
      attributes,
      insert: { [FILE_EMBED]: { file: doc.files.get(node.fileId) ?? null, node } },
    };
  return {
    attributes,
    insert: {
      [TABLE_EMBED]: {
        columns: node.columns,
        id: node.id,
        rows: node.rows.map((row) => ({
          cells: row.cells.map((cell) => ({
            contentId: cell.contentId,
            ops: [...htmlToOps(cell.html, resolve, false), { insert: "\n" }],
          })),
          id: row.id,
        })),
      },
    },
  };
}

export function canvasToOps(doc: CanvasDocModel, names: CanvasNames): Op[] {
  return nodesToOps(doc.nodes, 0, doc, names);
}

export function canvasTitle(doc: Pick<CanvasDocument, "title">): string {
  return decodeTextEntities(doc.title).replaceAll("&nbsp;", " ");
}
