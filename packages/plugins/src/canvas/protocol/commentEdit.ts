import type { CanvasEdit, CanvasNode } from "@slock/types";
import { sameNode } from "./diff.ts";
import { htmlTokens } from "./htmlTokens.ts";

function formattedText(html: string): string {
  const open: { mark: string; tag: string }[] = [];
  const runs: { marks: string; text: string }[] = [];

  function push(text: string, marks: string) {
    const last = runs.at(-1);
    if (last?.marks === marks) last.text += text;
    else runs.push({ marks, text });
  }

  for (const token of htmlTokens(html)) {
    if ("text" in token) {
      const marks = [...new Set(open.map(({ mark }) => mark))].sort().join(" ");
      push(token.text, marks);
      continue;
    }
    const { closing, name: tag, target } = token.tag;
    if (tag === "br") push("\n", "");
    else if (tag === "control" && !closing) push(target, "control");
    else if (tag === "annotation" || tag === "control") continue;
    else if (closing) {
      const at = open.findLastIndex((entry) => entry.tag === tag);
      if (at >= 0) open.splice(at, 1);
    } else open.push({ mark: `${tag}:${target}`, tag });
  }
  return JSON.stringify(runs);
}

function comparable(node: CanvasNode): CanvasNode {
  if (node.kind === "table")
    return {
      ...node,
      rows: node.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) => ({ ...cell, html: formattedText(cell.html) })),
      })),
    };
  return "html" in node ? { ...node, html: formattedText(node.html) } : node;
}

export function onlyAnnotates(nodes: CanvasNode[], edit: CanvasEdit): boolean {
  if (edit.title !== null || edit.deleted.length > 0) return false;
  if (edit.controls.some((control) => control.kind !== "annotation")) return false;
  return edit.upserts.every(({ after, node }) => {
    const index = nodes.findIndex((candidate) => candidate.id === node.id);
    const current = nodes[index];
    return (
      !!current &&
      (nodes[index - 1]?.id ?? null) === after &&
      sameNode(comparable(current), comparable(node))
    );
  });
}
