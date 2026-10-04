import type { DiffEntry } from "@slock/canvas";
import type { CanvasLine, CanvasNode } from "@slock/types";
import type { Op } from "quill";
import { type CanvasDocModel, nodesToOps, type OpsView } from "./canvasDelta";
import type { CanvasNames } from "./canvasEmbeds";
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
      table[i][j] =
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

export function inlineDiff(previous: Op[], next: Op[]): Op[] {
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

export function diffToOps(
  entries: DiffEntry[],
  doc: Pick<CanvasDocModel, "embeds" | "files">,
  names: CanvasNames,
): Op[] {
  const byId = new Map(entries.map((entry) => [entry.node.id, entry]));
  const resolve = (node: CanvasNode) => byId.get(node.id);
  const view: OpsView = {
    attributes: (node) => {
      const status = resolve(node)?.status;
      return status && status !== "same" ? { diff: status } : {};
    },
    inline: (node: CanvasLine, ops) => {
      const entry = resolve(node);
      const previous = entry?.previous;
      if (entry?.status !== "changed" || !previous || !("html" in previous)) return ops;
      const resolveEmbed = () => ({});
      return inlineDiff(htmlToOps(previous.html, resolveEmbed, previous.kind === "code"), ops);
    },
  };
  return nodesToOps(
    entries.map((entry) => entry.node),
    0,
    doc,
    names,
    view,
  );
}
