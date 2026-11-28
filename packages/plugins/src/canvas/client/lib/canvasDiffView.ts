import { defined } from "@slock/core";
import type { CanvasLine, CanvasNode, CanvasTable } from "@slock/types";
import type { Op } from "@slock/ui/editor/quill";
import type { DiffEntry } from "../../protocol/api";
import { type CanvasDocModel, lineOps, nodesToOps, type OpsView } from "./canvasDelta";
import { type CanvasNames, embedToValue } from "./canvasEmbeds";
import { htmlToOps } from "./canvasHtml";

interface Token {
  attributes: Op["attributes"];
  insert: Op["insert"];
  key: string;
}

const WORD_RE = /\s+|[^\s]+/g;

function tokens(ops: Op[]): Token[] {
  return ops.flatMap((op): Token[] => {
    const { attributes } = op;
    const suffix = JSON.stringify(attributes ?? {});
    if (typeof op.insert !== "string")
      return [{ attributes, insert: op.insert, key: `${JSON.stringify(op.insert)}${suffix}` }];
    return (op.insert.match(WORD_RE) ?? []).map((word) => ({
      attributes,
      insert: word,
      key: `${word}${suffix}`,
    }));
  });
}

function lcsTable(a: Token[], b: Token[]): number[][] {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      defined(table[i])[j] =
        a[i]?.key === b[j]?.key
          ? (table[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(table[i + 1]?.[j] ?? 0, table[i]?.[j + 1] ?? 0);
    }
  }
  return table;
}

function mark(token: Token, status: "added" | "removed"): Op {
  return { attributes: { ...token.attributes, diffmark: status }, insert: token.insert ?? "" };
}

function plain(token: Token): Op {
  return token.attributes
    ? { attributes: token.attributes, insert: token.insert ?? "" }
    : { insert: token.insert ?? "" };
}

function merge(ops: Op[]): Op[] {
  const merged: Op[] = [];
  for (const op of ops) {
    const last = merged.at(-1);
    if (
      last &&
      typeof last.insert === "string" &&
      typeof op.insert === "string" &&
      JSON.stringify(last.attributes) === JSON.stringify(op.attributes)
    )
      last.insert += op.insert;
    else merged.push({ ...op });
  }
  return merged;
}

function inlineDiff(previous: Op[], next: Op[]): Op[] {
  const a = tokens(previous);
  const b = tokens(next);
  const table = lcsTable(a, b);
  const out: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const left = a[i];
    const right = b[j];
    if (left && right && left.key === right.key) {
      out.push(plain(right));
      i += 1;
      j += 1;
    } else if (left && (!right || (table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0))) {
      out.push(mark(left, "removed"));
      i += 1;
    } else if (right) {
      out.push(mark(right, "added"));
      j += 1;
    }
  }
  return merge(out);
}

const marked = (ops: Op[], status: "added" | "removed"): Op[] =>
  ops.map((op) => ({ ...op, attributes: { ...op.attributes, diffmark: status } }));

// Removed rows stay in the diff, after the row they used to follow.
function withRemovedRows(previous: CanvasTable, next: CanvasTable): CanvasTable {
  const kept = new Set(next.rows.map((row) => row.id));
  const rows = [...next.rows];
  previous.rows.forEach((row, index) => {
    if (kept.has(row.id)) return;
    const before = previous.rows[index - 1]?.id;
    rows.splice(rows.findIndex((candidate) => candidate.id === before) + 1, 0, row);
  });
  return { ...next, rows };
}

const cellsOf = (table: CanvasNode | null | undefined) =>
  table?.kind === "table" ? table.rows.flatMap((row) => row.cells) : [];

export function diffToOps(
  entries: DiffEntry[],
  doc: Pick<CanvasDocModel, "embeds">,
  names: CanvasNames,
): Op[] {
  const byId = new Map(entries.map((entry) => [entry.node.id, entry]));
  const resolve = (node: CanvasNode) => byId.get(node.id);
  const view: OpsView = {
    attributes: (node) => {
      const status = resolve(node)?.status;
      return status && status !== "same" ? { diff: status } : {};
    },
    cell: (table, contentId, ops) => {
      const entry = resolve(table);
      if (entry?.status !== "changed") return ops;
      const before = cellsOf(entry.previous).find((cell) => cell.contentId === contentId);
      if (!before) return marked(ops, "added");
      if (!cellsOf(current.get(table.id)).some((cell) => cell.contentId === contentId))
        return marked(ops, "removed");
      const resolveEmbed = (id: string) => embedToValue(doc.embeds.get(id), id, names);
      return inlineDiff(htmlToOps(before.html, resolveEmbed, false), ops);
    },
    inline: (node: CanvasLine, ops) => {
      const entry = resolve(node);
      const previous = entry?.previous;
      if (entry?.status !== "changed" || !previous || !("html" in previous)) return ops;
      return inlineDiff(lineOps(previous, doc, names), ops);
    },
  };
  const current = new Map(entries.map(({ node }) => [node.id, node]));
  const nodes = entries.map(({ node, previous }) =>
    node.kind === "table" && previous?.kind === "table" ? withRemovedRows(previous, node) : node,
  );
  return nodesToOps(nodes, 0, doc, names, view);
}
